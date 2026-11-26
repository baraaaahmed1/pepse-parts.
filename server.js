const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { get: getBlob, put: putBlob } = require('@vercel/blob');

let DatabaseSync = null;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (error) {
  console.warn('node:sqlite is unavailable in this runtime; running without SQLite persistence.');
}

const app = express();
const PORT = process.env.PORT || 3000;
const WHATSAPP_NUMBER = '201286664149';
const CATALOG_BLOB_PATH = 'catalog/current.xlsx';
const CATALOG_PATH = path.resolve(
  process.env.CATALOG_PATH || path.join(__dirname, 'لسته كامله.xls.xlsx')
);
const DATABASE_PATH = path.resolve(
  process.env.DB_PATH ||
    (process.env.VERCEL
      ? path.join('/tmp', 'pepse-parts-data', 'orders.sqlite')
      : path.join(__dirname, '..', 'pepse-parts-data', 'orders.sqlite'))
);
const MAX_ORDER_QUANTITY = 9999;
const STORE_PICKUP_ADDRESS = 'العتبة - شارع محمد علي، عمارة أبو الجوخ، الدور الثالث';
let catalogImageMap = new Map();
const EGYPT_GOVERNORATES = new Set([
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'القليوبية',
  'البحيرة',
  'مطروح',
  'دمياط',
  'الدقهلية',
  'كفر الشيخ',
  'الغربية',
  'المنوفية',
  'الشرقية',
  'الإسماعيلية',
  'بورسعيد',
  'السويس',
  'شمال سيناء',
  'جنوب سيناء',
  'بني سويف',
  'الفيوم',
  'المنيا',
  'أسيوط',
  'الوادي الجديد',
  'سوهاج',
  'قنا',
  'الأقصر',
  'أسوان',
  'البحر الأحمر',
]);
let catalogByName = new Map();
let catalogInitPromise = null;

let database = null;
if (DatabaseSync) {
  fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

  database = new DatabaseSync(DATABASE_PATH);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('catalog_order', 'contact')),
      shop_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      request_type TEXT,
      details TEXT NOT NULL,
      items_json TEXT NOT NULL DEFAULT '[]',
      reference TEXT,
      status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'confirmed', 'shipped', 'cancelled')),
      payment_method TEXT
        CHECK (payment_method IN ('cash_on_delivery', 'instapay', 'wallet_transfer')),
      fulfillment_method TEXT NOT NULL DEFAULT 'shipping'
        CHECK (fulfillment_method IN ('shipping', 'pickup')),
      shipping_company TEXT,
      delivery_governorate TEXT,
      delivery_address TEXT,
      delivery_landmark TEXT,
      payment_status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'paid')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
  `);
  const orderColumns = database.prepare('PRAGMA table_info(orders)').all();
  if (!orderColumns.some((column) => column.name === 'reference')) {
    database.exec('ALTER TABLE orders ADD COLUMN reference TEXT');
  }
  if (!orderColumns.some((column) => column.name === 'payment_method')) {
    database.exec('ALTER TABLE orders ADD COLUMN payment_method TEXT');
  }
  if (!orderColumns.some((column) => column.name === 'fulfillment_method')) {
    database.exec(`
      ALTER TABLE orders ADD COLUMN fulfillment_method TEXT NOT NULL DEFAULT 'shipping'
        CHECK (fulfillment_method IN ('shipping', 'pickup'))
    `);
  }
  if (!orderColumns.some((column) => column.name === 'shipping_company')) {
    database.exec('ALTER TABLE orders ADD COLUMN shipping_company TEXT');
  }
  if (!orderColumns.some((column) => column.name === 'delivery_governorate')) {
    database.exec('ALTER TABLE orders ADD COLUMN delivery_governorate TEXT');
  }
  if (!orderColumns.some((column) => column.name === 'delivery_address')) {
    database.exec('ALTER TABLE orders ADD COLUMN delivery_address TEXT');
  }
  if (!orderColumns.some((column) => column.name === 'delivery_landmark')) {
    database.exec('ALTER TABLE orders ADD COLUMN delivery_landmark TEXT');
  }
  if (!orderColumns.some((column) => column.name === 'payment_status')) {
    database.exec(`
      ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'paid'))
    `);
  }
  const orderTableSql = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'orders'")
    .get().sql;
  const paymentMethodCheck = orderTableSql.match(/check\s*\(\s*payment_method\b[^)]*/i);
  if (paymentMethodCheck && !/wallet_transfer/i.test(paymentMethodCheck[0])) {
    const previousSequence =
      database.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'orders'").get()?.seq || 0;
    database.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE orders_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('catalog_order', 'contact')),
        shop_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        request_type TEXT,
        details TEXT NOT NULL,
        items_json TEXT NOT NULL DEFAULT '[]',
        reference TEXT,
        status TEXT NOT NULL DEFAULT 'new'
          CHECK (status IN ('new', 'confirmed', 'shipped', 'cancelled')),
        payment_method TEXT
          CHECK (payment_method IN ('cash_on_delivery', 'instapay', 'wallet_transfer')),
        fulfillment_method TEXT NOT NULL DEFAULT 'shipping'
          CHECK (fulfillment_method IN ('shipping', 'pickup')),
        shipping_company TEXT,
        delivery_governorate TEXT,
        delivery_address TEXT,
        delivery_landmark TEXT,
        payment_status TEXT NOT NULL DEFAULT 'unpaid'
          CHECK (payment_status IN ('unpaid', 'paid')),
        created_at TEXT NOT NULL
      );
      INSERT INTO orders_new (
        id, type, shop_name, phone, request_type, details, items_json, reference, status,
        payment_method, fulfillment_method, shipping_company, delivery_governorate,
        delivery_address, delivery_landmark, payment_status, created_at
      )
      SELECT
        id, type, shop_name, phone, request_type, details, items_json, reference, status,
        payment_method, fulfillment_method, shipping_company, delivery_governorate,
        delivery_address, delivery_landmark, payment_status, created_at
      FROM orders;
      DROP TABLE orders;
      ALTER TABLE orders_new RENAME TO orders;
      COMMIT;
    `);
    const currentSequence = database
      .prepare("SELECT seq FROM sqlite_sequence WHERE name = 'orders'")
      .get()?.seq || 0;
    if (previousSequence > currentSequence) {
      database.prepare("UPDATE sqlite_sequence SET seq = ? WHERE name = 'orders'")
        .run(previousSequence);
    }
  }
  database.exec('CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC)');
  database.exec('CREATE UNIQUE INDEX IF NOT EXISTS orders_reference_idx ON orders(reference)');
}

app.use(express.json({ limit: '1mb' }));

const catalogUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    const allowedMime = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (path.extname(file.originalname).toLowerCase() !== '.xlsx') {
      return callback(new Error('يجب رفع ملف Excel بصيغة XLSX.'));
    }
    if (!allowedMime.includes(file.mimetype) && file.mimetype !== 'application/octet-stream') {
      return callback(new Error('نوع الملف المرفوع غير صالح.'));
    }
    callback(null, true);
  },
});

app.disable('x-powered-by');

const requestCounts = new Map();
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://localhost:3000 http://127.0.0.1:3000; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'Cross-Origin-Opener-Policy': 'same-origin',
  });

  if (req.path.startsWith('/api/') && req.method !== 'GET') {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const state = requestCounts.get(key) || { count: 0, resetAt: now + 60_000 };
    if (now > state.resetAt) {
      state.count = 0;
      state.resetAt = now + 60_000;
    }
    state.count += 1;
    requestCounts.set(key, state);
    if (state.count > 60) {
      res.set('Retry-After', '60');
      return res.status(429).json({ success: false, error: 'طلبات كثيرة جدًا. حاول بعد دقيقة.' });
    }
  }
  next();
});

function isNonEmptyString(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function getCellValue(row, column) {
  const value = row.getCell(column).value;
  if (value && typeof value === 'object') {
    if ('result' in value) return value.result;
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
  }
  return value;
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const number = Number(value.trim());
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function isEmptyCell(value) {
  return value === null || value === undefined || value === '';
}

function getCatalogSection(value) {
  if (typeof value !== 'string') return '';
  const normalized = value
    .trim()
    .toLocaleLowerCase('ar')
    .replace(/[\u0640_\-\s]+/g, '');

  if (['lcd', 'شاشات', 'شاشة'].includes(normalized)) return 'lcd';
  if (['بطاريه', 'بطارية', 'بطاريات'].includes(normalized)) return 'battery';
  return '';
}

function getCatalogPrice(name, category, basePrice) {
  const isBattery = category === 'battery';
  const isJt = /(?:^|[^A-Za-z0-9])JT(?=$|[^A-Za-z0-9]|\d)/i.test(name);
  const isOrNew = /(?:^|[^A-Za-z0-9])OR(?:G)?\s*NEW(?=$|[^A-Za-z0-9])/i.test(name);
  const lcdMarkup = toFiniteNumber(process.env.CATALOG_LCD_MARKUP) ?? 10;
  return basePrice + (isBattery || isJt || isOrNew ? 0 : lcdMarkup);
}

const LCD_IMAGE_DIR = path.join(__dirname, 'lcd-images');

function normalizeImageModel(value) {
  return value
    .toLocaleLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, ' ')
    .replace(/\b(lcd|org|new|jt|vip|or|the|plus)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getImageQuality(value) {
  if (/(?:^|[^a-z0-9])jt(?:$|[^a-z0-9])/i.test(value)) return 'jt';
  if (/(?:^|[^a-z0-9])vip(?:$|[^a-z0-9])/i.test(value)) return 'vip';
  if (/(?:OR(?:G)?\s*NEW)/i.test(value)) return 'ornew';
  return '';
}

function buildCatalogImageMap(catalog) {
  const imageMap = new Map();
  if (!fs.existsSync(LCD_IMAGE_DIR)) return imageMap;

  const normalizeText = (value) =>
    String(value || '')
      .toLocaleLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/100\s*%/g, ' ')
      .replace(/[^a-z0-9\u0600-\u06ff+]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const extractModelTokens = (value) =>
    normalizeText(value)
      .replace(/\b(lcd|org|new|jt|vip|or|the|plus|incell|oled|hd|copy|توكيل|سيلفر|اورنج|خلع|باغه|باغة|فرام|بفرام)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter((t) => t.length >= 2);

  const imageFiles = fs.readdirSync(LCD_IMAGE_DIR).filter((file) =>
    /\.(?:jpe?g|png|webp)$/i.test(file)
  );

  for (const imageFile of imageFiles) {
    const stem = path.parse(imageFile).name;
    const imageQuality = getImageQuality(stem);
    const stemTokens = extractModelTokens(stem);
    if (stemTokens.length === 0) continue;

    const candidates = [];
    for (const name of catalog.keys()) {
      if (/بطاريه|بطارية|battery/i.test(name)) continue;

      if (imageQuality === 'jt' && !/(?:^|[^a-z0-9])jt(?:$|[^a-z0-9])/i.test(name)) {
        continue;
      }
      if (imageQuality === 'vip' && !/(?:^|[^a-z0-9])vip(?:$|[^a-z0-9])/i.test(name)) {
        continue;
      }
      if (
        imageQuality === 'ornew' &&
        !/(?:^|[^a-z0-9])(?:or(?:g)?\s*new)(?:$|[^a-z0-9])/i.test(name)
      ) {
        continue;
      }

      const nameTokens = extractModelTokens(name);
      if (nameTokens.length === 0) continue;

      const matchedCount = stemTokens.filter((sTok) =>
        nameTokens.some(
          (nTok) =>
            nTok === sTok ||
            (sTok.length >= 3 && nTok.startsWith(sTok)) ||
            (nTok.length >= 3 && sTok.startsWith(nTok))
        )
      ).length;

      if (matchedCount === stemTokens.length) {
        candidates.push({ name, score: matchedCount / nameTokens.length });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    for (const item of candidates) {
      if (!imageMap.has(item.name)) {
        imageMap.set(item.name, `/lcd-images/${encodeURIComponent(imageFile)}`);
      }
    }
  }

  return imageMap;
}

function hasSharedCatalogStorage() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  );
}

async function getSharedCatalogBuffer() {
  if (!hasSharedCatalogStorage()) return null;

  const blob = await getBlob(CATALOG_BLOB_PATH, {
    access: 'private',
    useCache: false,
  });
  if (!blob) return null;
  if (blob.statusCode !== 200 || !blob.stream) {
    throw new Error('تعذر قراءة ملف الكتالوج من التخزين المشترك.');
  }
  return Buffer.from(await new Response(blob.stream).arrayBuffer());
}

async function refreshSharedCatalog() {
  const buffer = await getSharedCatalogBuffer();
  if (buffer) {
    await loadCatalog(buffer);
  } else if (catalogByName.size === 0) {
    await ensureCatalogReady();
  }
}

async function parseCatalog(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const spreadsheetNamespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const appPropertiesNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';
  const xmlEntries = Object.values(zip.files).filter((entry) =>
    !entry.dir && entry.name.endsWith('.xml')
  );
  for (const entry of xmlEntries) {
    const xml = await entry.async('string');
    const normalizedXml = xml
      .replace(new RegExp(`xmlns:x="${spreadsheetNamespace}"`, 'g'), `xmlns="${spreadsheetNamespace}"`)
      .replace(/(<\/?)x:/g, '$1')
      .replace(new RegExp(`xmlns:ap="${appPropertiesNamespace}"`, 'g'), `xmlns="${appPropertiesNamespace}"`)
      .replace(/(<\/?)ap:/g, '$1');
    zip.file(entry.name, normalizedXml);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await zip.generateAsync({ type: 'nodebuffer' }), {
    ignoreNodes: ['tableParts'],
  });
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('The catalog workbook has no worksheets.');

  const extractText = (cellVal) => {
    if (cellVal === null || cellVal === undefined) return '';
    if (typeof cellVal === 'object') {
      if (cellVal.text) return String(cellVal.text).trim();
      if (Array.isArray(cellVal.richText)) return cellVal.richText.map((p) => p.text).join('').trim();
      if (cellVal.result !== undefined) return String(cellVal.result).trim();
    }
    return String(cellVal).trim();
  };

  let headerRowNum = 0;
  let nameCol = 2;
  let priceCol = 4;
  let mainBranchCol = 4;
  let shopCol = 6;
  let totalQtyCol = null;
  let qtyCol = null;

  for (let r = 1; r <= Math.min(5, sheet.rowCount); r += 1) {
    const row = sheet.getRow(r);
    for (let col = 1; col <= sheet.columnCount; col += 1) {
      const txt = extractText(getCellValue(row, col));
      if (txt === 'الصنف') {
        headerRowNum = r;
        nameCol = col;
      }
    }
    if (headerRowNum > 0) {
      for (let col = 1; col <= sheet.columnCount; col += 1) {
        const txt = extractText(getCellValue(row, col));
        if (txt === 'سعر1' || txt === 'السعر') priceCol = col;
        else if (txt === 'الفرع الرئيسى' || txt === 'الفرع الرئيسي') mainBranchCol = col;
        else if (txt === 'المحل') shopCol = col;
        else if (txt === 'إجمالي الكمية' || txt === 'اجمالي الكمية') totalQtyCol = col;
        else if (txt === 'كمية' || txt === 'الكمية') qtyCol = col;
      }
      break;
    }
  }

  console.log('Detected Columns:', { headerRowNum, nameCol, priceCol, totalQtyCol, qtyCol, mainBranchCol, shopCol });

  const nextCatalog = new Map();
  let section = '';
  const startRow = headerRowNum > 0 ? headerRowNum + 1 : 1;

  for (let rowNumber = startRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const name = extractText(getCellValue(row, nameCol));
    if (!name) continue;

    let hasOtherData = false;
    for (let col = 1; col <= sheet.columnCount; col += 1) {
      if (col === nameCol) continue;
      const val = extractText(getCellValue(row, col));
      if (val !== '') {
        hasOtherData = true;
        break;
      }
    }

    if (!hasOtherData) {
      section = name;
      continue;
    }

    const normalizedSection = getCatalogSection(section);
    if (!normalizedSection) continue;

    const basePrice = toFiniteNumber(extractText(getCellValue(row, priceCol)));
    let stockQuantity = 0;

    if (totalQtyCol !== null) {
      stockQuantity = toFiniteNumber(extractText(getCellValue(row, totalQtyCol))) || 0;
    } else if (qtyCol !== null && sheet.columnCount < 9) {
      stockQuantity = toFiniteNumber(extractText(getCellValue(row, qtyCol))) || 0;
    } else {
      const mainBranchQuantity = toFiniteNumber(extractText(getCellValue(row, mainBranchCol))) || 0;
      const shopQuantity = toFiniteNumber(extractText(getCellValue(row, shopCol))) || 0;
      stockQuantity = mainBranchQuantity + shopQuantity;
    }

    if (basePrice === null || basePrice <= 0 || stockQuantity <= 0) continue;
    if (nextCatalog.has(name)) {
      throw new Error(`Duplicate product name in catalog: ${name}`);
    }

    nextCatalog.set(name, {
      name,
      category: normalizedSection === 'lcd' ? 'lcd' : 'battery',
      price: getCatalogPrice(name, normalizedSection === 'lcd' ? 'lcd' : 'battery', basePrice),
      stockQuantity,
      maxQuantity: null,
    });
  }

  if (nextCatalog.size === 0) {
    throw new Error('No priced, in-stock LCD or battery products were found in the catalog.');
  }

  return {
    products: nextCatalog,
    images: buildCatalogImageMap(nextCatalog),
  };
}

async function loadCatalog(buffer = null) {
  let source = buffer;
  let sourceName = path.basename(CATALOG_PATH);

  if (!source) {
    source = await getSharedCatalogBuffer();
    if (source) {
      sourceName = 'Vercel Blob';
    } else {
      source = await fs.promises.readFile(CATALOG_PATH);
    }
  }

  const catalog = await parseCatalog(source);
  catalogByName = catalog.products;
  catalogImageMap = catalog.images;
  console.log(`Loaded ${catalogByName.size} catalog products from ${sourceName}.`);
  return catalog;
}

async function loadCatalogWithLocalRecovery() {
  try {
    await loadCatalog();
  } catch (originalError) {
    const backupDirectory = path.join(__dirname, '..', 'pepse-parts-catalog-backups');
    let backupFiles = [];
    try {
      backupFiles = (await fs.promises.readdir(backupDirectory))
        .filter((file) => file.endsWith('.xlsx'))
        .map((file) => path.join(backupDirectory, file))
        .sort((first, second) =>
          fs.statSync(second).mtimeMs - fs.statSync(first).mtimeMs
        );
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    for (const backupPath of backupFiles) {
      try {
        const catalog = await parseCatalog(await fs.promises.readFile(backupPath));
        catalogByName = catalog.products;
        catalogImageMap = catalog.images;
        if (!process.env.VERCEL) {
          await fs.promises.copyFile(backupPath, CATALOG_PATH);
        }
        console.warn(`Recovered catalog from backup ${path.basename(backupPath)}.`);
        return;
      } catch (error) {
        console.error(`Catalog backup could not be loaded (${path.basename(backupPath)}):`, error);
      }
    }

    throw originalError;
  }
}

function ensureCatalogReady() {
  if (!catalogInitPromise) {
    catalogInitPromise = loadCatalogWithLocalRecovery().catch((error) => {
      catalogInitPromise = null;
      throw error;
    });
  }
  return catalogInitPromise;
}

function makeWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function getFulfillmentMessageLines({
  fulfillmentMethod,
  shippingCompany,
  governorate,
  address,
  landmark,
}) {
  if (fulfillmentMethod === 'pickup') {
    return ['طريقة الاستلام: استلام من المحل', `عنوان الاستلام: ${STORE_PICKUP_ADDRESS}`];
  }

  return [
    'طريقة الاستلام: شحن',
    `شركة الشحن: ${shippingCompany || 'لم تُحدد بعد'}`,
    `المحافظة: ${governorate}`,
    `العنوان: ${address}`,
    ...(landmark ? [`علامة مميزة: ${landmark}`] : []),
  ];
}

function requireAdmin(req, res, next) {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    return res.status(503).json({ success: false, error: 'لوحة الطلبات غير مفعّلة بعد.' });
  }

  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Basic\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, error: 'بيانات الدخول غير صحيحة.' });
  }

  let credentials;
  try {
    credentials = Buffer.from(match[1], 'base64').toString('utf8');
  } catch (error) {
    return res.status(401).json({ success: false, error: 'بيانات الدخول غير صحيحة.' });
  }

  const separator = credentials.indexOf(':');
  const username = credentials.slice(0, separator);
  const password = credentials.slice(separator + 1);
  const supplied = Buffer.from(password);
  const expected = Buffer.from(expectedPassword);
  const passwordMatches = supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected);

  if (separator < 0 || username !== 'admin' || !passwordMatches) {
    return res.status(401).json({ success: false, error: 'بيانات الدخول غير صحيحة.' });
  }

  next();
}

app.get('/api/catalog', async (req, res) => {
  try {
    await refreshSharedCatalog();

    res.set('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (origin && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
    }
    res.json({
      success: true,
      products: Array.from(catalogByName.values(), ({ name, category, price, maxQuantity }) => ({
        name,
        category,
        price,
        maxQuantity,
        imageUrl: catalogImageMap.get(name) || null,
      })),
    });
  } catch (error) {
    console.error('Catalog could not be refreshed:', error);
    res.status(503).json({ success: false, error: 'تعذر تحميل الكتالوج الآن. حاول مرة أخرى لاحقًا.' });
  }
});

app.post('/api/order', async (req, res) => {
  const body = req.body || {};
  const type = body.type === undefined || body.type === 'contact' ? 'contact' : body.type;
  if (type === 'catalog_order') {
    try {
      await refreshSharedCatalog();
    } catch (error) {
      console.error('Catalog could not be refreshed before order validation:', error);
      return res.status(503).json({
        success: false,
        error: 'تعذر التحقق من أصناف الكتالوج الآن. حاول مرة أخرى لاحقًا.',
      });
    }
  }
  if (!['catalog_order', 'contact'].includes(type)) {
    return res.status(400).json({ success: false, error: 'نوع الطلب غير صالح.' });
  }
  const shopName = typeof body.shopName === 'string' ? body.shopName.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

  if (!isNonEmptyString(shopName, 120) || !isNonEmptyString(phone, 40)) {
    return res.status(400).json({ success: false, error: 'أدخل اسم المحل ورقم الهاتف بشكل صحيح.' });
  }

  let requestType = null;
  let details = '';
  let items = [];
  let paymentMethod = null;
  let fulfillmentMethod = 'shipping';
  let shippingCompany = null;
  let deliveryGovernorate = null;
  let deliveryAddress = null;
  let deliveryLandmark = null;

  if (type === 'catalog_order') {
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
      return res.status(400).json({ success: false, error: 'سلة الطلب غير صالحة.' });
    }

    const quantitiesByName = new Map();
    for (const requestedItem of body.items) {
      const name = requestedItem && typeof requestedItem.name === 'string'
        ? requestedItem.name.trim()
        : '';
      const quantity = requestedItem && requestedItem.quantity;
      if (!isNonEmptyString(name, 160) ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > MAX_ORDER_QUANTITY) {
        return res.status(400).json({ success: false, error: 'تحقق من أصناف الطلب وكمياتها.' });
      }

      quantitiesByName.set(name, (quantitiesByName.get(name) || 0) + quantity);
    }

    if (quantitiesByName.size > 100) {
      return res.status(400).json({ success: false, error: 'سلة الطلب غير صالحة.' });
    }

    items = [];
    for (const [name, quantity] of quantitiesByName) {
      const product = catalogByName.get(name);
      if (!product) {
        return res.status(400).json({ success: false, error: 'يوجد صنف غير متاح في الكتالوج.' });
      }
      if (quantity > (product.maxQuantity || MAX_ORDER_QUANTITY)) {
        return res.status(400).json({
          success: false,
          error: `الحد الأقصى لطلب ${name} هو ${product.maxQuantity || MAX_ORDER_QUANTITY} قطعة.`,
        });
      }
      if (quantity > product.stockQuantity) {
        return res.status(400).json({ success: false, error: 'الكمية المطلوبة غير متاحة حاليًا.' });
      }
      items.push({
        name,
        quantity,
        unitPrice: product.price,
        category: product.category,
      });
    }
    paymentMethod = body.paymentMethod;
    fulfillmentMethod = body.fulfillmentMethod === undefined ? 'shipping' : body.fulfillmentMethod;
    shippingCompany = typeof body.shippingCompany === 'string' ? body.shippingCompany.trim() : '';
    deliveryGovernorate = typeof body.governorate === 'string' ? body.governorate.trim() : '';
    deliveryAddress = typeof body.address === 'string' ? body.address.trim() : '';
    deliveryLandmark = typeof body.landmark === 'string' ? body.landmark.trim() : '';
    if (!['cash_on_delivery', 'instapay', 'wallet_transfer'].includes(paymentMethod) ||
      !['shipping', 'pickup'].includes(fulfillmentMethod) ||
      shippingCompany.length > 120 ||
      deliveryLandmark.length > 160 ||
      (fulfillmentMethod === 'shipping' &&
      (!isNonEmptyString(shippingCompany, 120) ||
        !EGYPT_GOVERNORATES.has(deliveryGovernorate) ||
          !isNonEmptyString(deliveryAddress, 500)))) {
      return res.status(400).json({ success: false, error: 'أكمل بيانات الاستلام واختر طريقة دفع صحيحة.' });
    }
    if (fulfillmentMethod === 'pickup') {
      shippingCompany = '';
      deliveryGovernorate = '';
      deliveryAddress = '';
      deliveryLandmark = '';
    }
    shippingCompany = shippingCompany || null;
    deliveryGovernorate = deliveryGovernorate || null;
    deliveryAddress = deliveryAddress || null;
    deliveryLandmark = deliveryLandmark || null;
    details = 'السعر موحد؛ يمكن مراجعة السعر والتوافر مع فريق المبيعات.';
  } else {
    requestType = body.requestType;
    if (!['استفسار', 'شكوى'].includes(requestType) ||
      !isNonEmptyString(body.details, 4000)) {
      return res.status(400).json({ success: false, error: 'أدخل نوع الرسالة وتفاصيلها.' });
    }
    details = body.details.trim();
  }

  if (type === 'catalog_order' && body.action === 'prepare') {
    const reference = crypto.randomBytes(5).toString('hex').toUpperCase();
    const totalPrice = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
    const paymentLabel = paymentMethod === 'instapay'
      ? 'إنستا باي يدوي - بانتظار مراجعة التحويل'
      : paymentMethod === 'wallet_transfer'
        ? 'تحويل محفظة - بانتظار رقم المحفظة من المبيعات'
        : 'الدفع عند الاستلام';
    const message = [
      `مرجع الطلب: ${reference}`,
      'طلب توريد من كتالوج PEPSE PARTS',
      `اسم المحل: ${shopName}`,
      `رقم الهاتف: ${phone}`,
      ...getFulfillmentMessageLines({
        fulfillmentMethod,
        shippingCompany,
        governorate: deliveryGovernorate,
        address: deliveryAddress,
        landmark: deliveryLandmark,
      }),
      `طريقة الدفع: ${paymentLabel}`,
      ...items.map((item, index) =>
        `${index + 1}. ${item.name} - الكمية: ${item.quantity} - سعر القطعة: ${item.unitPrice} جنيه`
      ),
      `إجمالي الأصناف حسب الأسعار المعروضة: ${totalPrice} جنيه ${
        fulfillmentMethod === 'pickup'
          ? '(قبل مراجعة المبيعات).'
          : '(قبل الشحن ومراجعة المبيعات).'
      }`,
      ...(paymentMethod === 'instapay' || paymentMethod === 'wallet_transfer'
        ? ['لا يُعد الطلب مدفوعًا حتى تراجع المبيعات التحويل.']
        : []),
      'إذا كان السعر غير مناسب، يرجى طلب مراجعته من فريق المبيعات.',
      'التوافر النهائي بحاجة إلى التأكيد.',
    ].join('\n');

    return res.json({
      success: true,
      reference,
      whatsappUrl: makeWhatsAppUrl(message),
    });
  }

  if (type === 'catalog_order' &&
    (body.action !== 'confirm' || !/^[A-F0-9]{10}$/.test(body.reference || ''))) {
    return res.status(400).json({ success: false, error: 'ابدأ إرسال الطلب عبر واتساب أولًا.' });
  }

  try {
    let orderId = Date.now();
    if (database) {
      if (type === 'catalog_order') {
        database.prepare(`
          INSERT INTO orders (
            type, shop_name, phone, request_type, details, items_json, reference,
            payment_method, fulfillment_method, shipping_company, delivery_governorate,
            delivery_address, delivery_landmark, payment_status, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?)
          ON CONFLICT(reference) DO NOTHING
        `).run(
          type,
          shopName,
          phone,
          requestType,
          details,
          JSON.stringify(items),
          body.reference,
          paymentMethod,
          fulfillmentMethod,
          shippingCompany,
          deliveryGovernorate,
          deliveryAddress,
          deliveryLandmark || null,
          new Date().toISOString()
        );
        orderId = database.prepare('SELECT id FROM orders WHERE reference = ?').get(body.reference).id;
      } else {
        const result = database.prepare(`
          INSERT INTO orders (type, shop_name, phone, request_type, details, items_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          type,
          shopName,
          phone,
          requestType,
          details,
          JSON.stringify(items),
          new Date().toISOString()
        );
        orderId = Number(result.lastInsertRowid);
      }
    }

    const message = type === 'catalog_order'
      ? [
          `طلب رقم: ${orderId}`,
          `مرجع واتساب: ${body.reference}`,
          'طلب توريد من كتالوج PEPSE PARTS',
          `اسم المحل: ${shopName}`,
          `رقم الهاتف: ${phone}`,
          ...getFulfillmentMessageLines({
            fulfillmentMethod,
            shippingCompany,
            governorate: deliveryGovernorate,
            address: deliveryAddress,
            landmark: deliveryLandmark,
          }),
          `طريقة الدفع: ${
            paymentMethod === 'instapay'
              ? 'إنستا باي يدوي'
              : paymentMethod === 'wallet_transfer'
                ? 'تحويل محفظة'
                : 'الدفع عند الاستلام'
          }`,
          ...items.map((item, index) =>
            `${index + 1}. ${item.name} - الكمية: ${item.quantity} - سعر القطعة: ${item.unitPrice} جنيه`
          ),
          `إجمالي الأصناف حسب الأسعار المعروضة: ${items.reduce((total, item) => total + item.unitPrice * item.quantity, 0)} جنيه ${
            fulfillmentMethod === 'pickup'
              ? '(قبل مراجعة المبيعات).'
              : '(قبل الشحن ومراجعة المبيعات).'
          }`,
          ...(paymentMethod === 'instapay' || paymentMethod === 'wallet_transfer'
            ? ['حالة الدفع: بانتظار مراجعة المبيعات للتحويل.']
            : []),
          'السعر موحد، ويمكن طلب مراجعته من فريق المبيعات.',
          'التوافر النهائي بحاجة إلى التأكيد.',
        ].join('\n')
      : [
          `رقم الرسالة: ${orderId}`,
          `نوع الرسالة: ${requestType}`,
          `اسم المحل: ${shopName}`,
          `رقم الهاتف: ${phone}`,
          `التفاصيل: ${details}`,
        ].join('\n');

    res.status(201).json({
      success: true,
      orderId,
      ...(type === 'contact' ? { whatsappUrl: makeWhatsAppUrl(message) } : {}),
    });
  } catch (error) {
    console.error('Order could not be saved:', error);
    res.status(500).json({ success: false, error: 'تعذر حفظ الطلب. حاول مرة أخرى لاحقًا.' });
  }
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  if (!database) {
    return res.json({ success: true, orders: [] });
  }
  try {
    const rows = database.prepare(`
      SELECT id, type, shop_name, phone, request_type, details, items_json, reference, status,
        payment_method, fulfillment_method, shipping_company, delivery_governorate,
        delivery_address, delivery_landmark, payment_status, created_at
      FROM orders
      ORDER BY id DESC
      LIMIT 300
    `).all();
    const orders = rows.map((row) => ({
      ...row,
      items: JSON.parse(row.items_json),
      items_json: undefined,
    }));
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Orders could not be loaded:', error);
    res.status(500).json({ success: false, error: 'تعذر تحميل الطلبات.' });
  }
});

app.post('/api/admin/catalog/upload', requireAdmin, catalogUpload.single('catalog'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'اختر ملف Excel أولًا.' });
  }

  if (process.env.VERCEL && !hasSharedCatalogStorage()) {
    return res.status(503).json({
      success: false,
      error: 'التخزين المشترك غير مربوط. اربط Vercel Blob قبل رفع ملف الكتالوج.',
    });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  try {
    const newCatalog = await parseCatalog(req.file.buffer);
    let backupName = 'لا توجد نسخة سابقة';
    const sharedStorage = hasSharedCatalogStorage();

    if (sharedStorage) {
      const previousBuffer = await getSharedCatalogBuffer();
      if (previousBuffer) {
        backupName = `catalog-${stamp}.xlsx`;
        await putBlob(`catalog/backups/${backupName}`, previousBuffer, {
          access: 'private',
          addRandomSuffix: false,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
      }
      await putBlob(CATALOG_BLOB_PATH, req.file.buffer, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    } else {
      const backupDirectory = path.join(__dirname, '..', 'pepse-parts-catalog-backups');
      fs.mkdirSync(backupDirectory, { recursive: true });
      const backupPath = path.join(backupDirectory, `catalog-${stamp}.xlsx`);
      const temporaryPath = path.join(__dirname, `.catalog-upload-${process.pid}-${Date.now()}.xlsx`);
      let hasBackup = false;

      try {
        if (fs.existsSync(CATALOG_PATH)) {
          await fs.promises.copyFile(CATALOG_PATH, backupPath);
          backupName = path.basename(backupPath);
          hasBackup = true;
        }
        await fs.promises.writeFile(temporaryPath, req.file.buffer, { flag: 'wx' });
        await fs.promises.copyFile(temporaryPath, CATALOG_PATH);
      } catch (error) {
        if (hasBackup) await fs.promises.copyFile(backupPath, CATALOG_PATH);
        throw error;
      } finally {
        await fs.promises.rm(temporaryPath, { force: true });
      }
    }

    catalogByName = newCatalog.products;
    catalogImageMap = newCatalog.images;
    res.json({
      success: true,
      message: sharedStorage
        ? 'تم تحديث الكتالوج المشترك؛ سيظهر التحديث على الموقع المحلي وVercel.'
        : 'تم تحديث كتالوج هذا الجهاز فقط. ليتزامن مع Vercel، اربط هذا الجهاز بتخزين الكتالوج المشترك.',
      productCount: catalogByName.size,
      backupName,
      sharedStorage,
    });
  } catch (error) {
    console.error('Catalog upload failed:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'تعذر التحقق من ملف Excel. لم يتم استبدال الكتالوج.',
    });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: 'الملف كبير جدًا أو غير مقبول.' });
  }
  if (error) {
    if (req.path.startsWith('/api/admin/catalog/upload')) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
  next(error);
});

app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
  if (!database) {
    return res.status(503).json({ success: false, error: 'قاعدة بيانات الطلبات غير متاحة.' });
  }
  const orderId = Number(req.params.id);
  const body = req.body || {};
  const updates = [];
  const values = [];
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    if (!['new', 'confirmed', 'shipped', 'cancelled'].includes(body.status)) {
      return res.status(400).json({ success: false, error: 'حالة الطلب غير صالحة.' });
    }
    updates.push('status = ?');
    values.push(body.status);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'paymentStatus')) {
    if (!['unpaid', 'paid'].includes(body.paymentStatus)) {
      return res.status(400).json({ success: false, error: 'حالة الدفع غير صالحة.' });
    }
    updates.push('payment_status = ?');
    values.push(body.paymentStatus);
  }
  if (!Number.isSafeInteger(orderId) || orderId < 1 || updates.length === 0) {
    return res.status(400).json({ success: false, error: 'رقم الطلب أو الحالة غير صالحين.' });
  }

  try {
    values.push(orderId);
    const result = database.prepare(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود.' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Order status could not be updated:', error);
    res.status(500).json({ success: false, error: 'تعذر تحديث حالة الطلب.' });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/lcd-images/:file', (req, res, next) => {
  if (!/^[^/\\]+\.(?:jpe?g|png|webp)$/i.test(req.params.file)) return next();
  const requestedFile = path.basename(req.params.file);
  if (!fs.existsSync(path.join(LCD_IMAGE_DIR, requestedFile))) return next();
  res.set('Cache-Control', 'public, max-age=604800, immutable');
  res.sendFile(path.join(LCD_IMAGE_DIR, requestedFile));
});

const publicFiles = new Set([
  'pag2.html',
  'products.html',
  'admin.html',
  'styles.css',
  'script.js',
  'products.js',
  'admin.js',
  'lcd-placeholder.svg',
  'battery-placeholder.svg',
  'instapay-icon.svg',
  'wallet-icon.svg',
  'WhatsApp Image 2026-10-11 at 2.39.20 PM.jpeg',
]);

app.get('*', (req, res, next) => {
  let requestedFile;
  try {
    requestedFile = decodeURIComponent(req.path).replace(/^\/+/, '');
  } catch (error) {
    return next(error);
  }

  if (!publicFiles.has(requestedFile)) return next();
  if (/\.(?:css|js|svg|jpeg|jpg|png|webp|pdf)$/i.test(requestedFile)) {
    res.set('Cache-Control', 'public, max-age=3600');
  } else {
    res.set('Cache-Control', 'no-cache');
  }
  res.sendFile(path.join(__dirname, requestedFile), (error) => {
    if (error) next(error);
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pag2.html'));
});

app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.sendStatus(404);
  res.sendFile(path.join(__dirname, 'pag2.html'));
});

async function startServer() {
  await ensureCatalogReady();
  app.listen(PORT, () => {
    if (!process.env.ADMIN_PASSWORD) {
      console.warn('Set ADMIN_PASSWORD to enable the orders dashboard at /admin.');
    } else if (process.env.ADMIN_PASSWORD.length < 12) {
      console.warn('ADMIN_PASSWORD should be at least 12 characters long.');
    }
    console.log(`PEPSE PARTS server is running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('The catalog could not be loaded:', error);
    if (database) database.close();
    process.exitCode = 1;
  });
}

module.exports = app;