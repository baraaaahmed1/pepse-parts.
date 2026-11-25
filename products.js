const getCatalogApiUrl = () => {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    if (window.location.port && window.location.port !== '3000') {
      return `${window.location.protocol}//${host}:3000/api/catalog`;
    }
  }
  return '/api/catalog';
};

const fetchCatalog = async (attempt = 1) => {
  const apiUrl = new URL(getCatalogApiUrl(), window.location.href);
  apiUrl.searchParams.set('_', String(Date.now()));

  try {
    const response = await fetch(apiUrl.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
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

    return data.products.map((product) => ({
      ...product,
      imageUrl: product.imageUrl
        ? new URL(product.imageUrl, apiUrl.origin).toString()
        : null,
    }));
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt * 500));
      return fetchCatalog(attempt + 1);
    }
    throw error;
  }
};

window.catalogProductsReady = fetchCatalog();