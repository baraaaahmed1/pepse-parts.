const getCatalogApiUrl = () => {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    if (window.location.port && window.location.port !== '3000') {
      return `${window.location.protocol}//${host}:3000/api/catalog`;
    }
  }
  return '/api/catalog';
};

// بيانات تجريبية لنسخة العرض (Demo) في حالة عدم وجود سيرفر
const demoProducts = [
  {
    id: 1,
    name: 'بطارية آيفون 8 بلس أصلية (iPhone 8 Plus Battery)',
    category: 'بطاريات',
    price: 450,
    maxQuantity: 15,
    imageUrl: 'battery-placeholder.svg'
  },
  {
    id: 2,
    name: 'شاشة سامسونج A25 كاملة أوليد (Samsung A25 OLED)',
    category: 'شاشات',
    price: 1850,
    maxQuantity: 8,
    imageUrl: 'lcd-placeholder.svg'
  },
  {
    id: 3,
    name: 'بطارية هواوي P30 عالية السعة (HB416492EFW)',
    category: 'بطاريات',
    price: 380,
    maxQuantity: 20,
    imageUrl: 'battery-placeholder.svg'
  },
  {
    id: 4,
    name: 'شاشة أوبو A71 كاملة (Oppo A71 Full LCD)',
    category: 'شاشات',
    price: 650,
    maxQuantity: 12,
    imageUrl: 'lcd-placeholder.svg'
  },
  {
    id: 5,
    name: 'بطارية آيفون 11 برو ماكس (iPhone 11 Pro Max)',
    category: 'بطاريات',
    price: 750,
    maxQuantity: 10,
    imageUrl: 'battery-placeholder.svg'
  },
  {
    id: 6,
    name: 'شاشة شاومي ريدمي نوت 12 (Redmi Note 12 LCD)',
    category: 'شاشات',
    price: 1100,
    maxQuantity: 9,
    imageUrl: 'lcd-placeholder.svg'
  }
];

window.catalogProductsReady = fetch(getCatalogApiUrl(), {
  headers: { Accept: 'application/json' },
})
  .then(async (response) => {
    const data = await response.json();
    if (!response.ok || !data.success || !Array.isArray(data.products)) {
      throw new Error(data.error || 'تعذر تحميل كتالوج المنتجات.');
    }

    const validProducts = data.products.every((product) =>
      product &&
      typeof product.name === 'string' &&
      typeof product.category === 'string' &&
      Number.isFinite(product.price) &&
      (product.maxQuantity === null ||
        (Number.isSafeInteger(product.maxQuantity) && product.maxQuantity > 0))
    );
    if (!validProducts) throw new Error('بيانات الكتالوج غير صالحة.');

    const apiUrl = new URL(getCatalogApiUrl(), window.location.href);
    return data.products.map((product) => ({
      ...product,
      imageUrl: product.imageUrl
        ? new URL(product.imageUrl, apiUrl.origin).toString()
        : null,
    }));
  })
  .catch(() => {
    // تشغيل البيانات التجريبية تلقائياً على Vercel
    return demoProducts;
  });
