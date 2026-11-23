document.addEventListener('DOMContentLoaded', async function () {
  const formatPrice = (price) => `${Number(price).toLocaleString('en-EG')} جنيه`;

  const setFormStatus = (element, message, linkUrl) => {
    if (!element) return;
    element.replaceChildren(document.createTextNode(message));
    if (linkUrl) {
      const link = document.createElement('a');
      link.href = linkUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'افتح واتساب';
      element.append(document.createTextNode(' '), link);
    }
  };

  const yearElement = document.getElementById('year');
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  const header = document.querySelector('header');
  const scrollProgress = document.querySelector('.scroll-progress');
  const backToTop = document.querySelector('.back-to-top');
  let scrollUpdateScheduled = false;
  const revealItems = document.querySelectorAll(
    '.section-heading, .stats-bar, .category-card, .product-card, .feature-box, .step-card, .testimonial, .contact-info, .contact-form, .cta'
  );

  revealItems.forEach((item, index) => {
    item.classList.add('reveal');
    if (item.matches('.category-card, .product-card, .feature-box, .step-card, .testimonial')) {
      item.style.setProperty('--reveal-delay', `${(index % 6) * 70}ms`);
    }
  });

  const tiltItems = document.querySelectorAll(
    '.hero-card, .category-card, .feature-box, .step-card, .contact-info, .contact-form, .cta'
  );

  tiltItems.forEach((item) => {
    item.addEventListener('pointermove', (event) => {
      const rect = item.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      item.style.transform = `perspective(1000px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateY(-4px)`;
      item.style.transition = 'transform 0.08s ease, box-shadow 0.2s ease';
    });

    item.addEventListener('pointerleave', () => {
      item.style.transform = '';
      item.style.transition = 'transform 0.35s ease, box-shadow 0.25s ease';
    });
  });

  const updateScrollState = () => {
    if (header) {
      header.classList.toggle('scrolled', window.scrollY > 30);
    }
    if (scrollProgress) {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
      scrollProgress.style.transform = `scaleX(${progress})`;
    }
    if (backToTop) {
      backToTop.classList.toggle('visible', window.scrollY > 500);
    }
  };

  updateScrollState();
  window.addEventListener('scroll', () => {
    if (scrollUpdateScheduled) return;
    scrollUpdateScheduled = true;
    requestAnimationFrame(() => {
      updateScrollState();
      scrollUpdateScheduled = false;
    });
  }, { passive: true });

  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -24px 0px' }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add('visible'));
  }

  const mobileButton = document.querySelector('.mobile-btn');
  const navLinks = document.querySelector('.nav-links');

  if (mobileButton && navLinks) {
    const setMenuState = (isOpen) => {
      navLinks.classList.toggle('is-open', isOpen);
      mobileButton.setAttribute('aria-expanded', String(isOpen));
    };

    mobileButton.addEventListener('click', function () {
      const shouldOpen = !navLinks.classList.contains('is-open');
      setMenuState(shouldOpen);
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMenuState(false));
    });

    document.addEventListener('click', (event) => {
      if (!navLinks.classList.contains('is-open')) return;
      const clickedInsideNav = navLinks.contains(event.target) || mobileButton.contains(event.target);
      if (!clickedInsideNav) {
        setMenuState(false);
      }
    });
  }

  const contactDialog = document.getElementById('contactDialog');
  if (contactDialog && typeof contactDialog.showModal === 'function') {
    const openContactDialog = (event) => {
      event.preventDefault();
      contactDialog.showModal();
    };

    document.querySelectorAll('[data-contact-dialog-trigger]').forEach((trigger) => {
      trigger.addEventListener('click', openContactDialog);
    });

    document.querySelectorAll('[data-order-trigger]').forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        contactDialog.showModal();
      });
    });

    const closeButton = contactDialog.querySelector('[data-contact-dialog-close]');
    closeButton?.addEventListener('click', () => contactDialog.close());

    contactDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      contactDialog.close();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && contactDialog.open) {
        event.preventDefault();
        contactDialog.close();
      }
    });

    contactDialog.addEventListener('click', (event) => {
      const bounds = contactDialog.getBoundingClientRect();
      const clickedOutside = event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom;
      if (clickedOutside) contactDialog.close();
    });
  }

  const sections = document.querySelectorAll('main section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a');

  const setActiveNav = () => {
    let currentId = sections[0]?.id;

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= 140 && rect.bottom >= 140) {
        currentId = section.id;
      }
    });

    navAnchors.forEach((link) => {
      const href = link.getAttribute('href');
      const isActive = href === '#' + currentId;
      link.classList.toggle('active', isActive);
    });
  };

  setActiveNav();
  window.addEventListener('scroll', setActiveNav, { passive: true });

  const orderForm = document.getElementById('orderForm');

  if (orderForm) {
    orderForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      const shopName = orderForm.querySelector('[name="shopName"]').value.trim() || 'غير محدد';
      const phone = orderForm.querySelector('[name="phone"]').value.trim() || 'غير محدد';
      const requestType = orderForm.querySelector('[name="requestType"]').value || 'استفسار';
      const details = orderForm.querySelector('[name="details"]').value.trim() || 'بدون تفاصيل';
      const status = document.getElementById('contactFormStatus');
      const whatsappWindow = window.open('about:blank', '_blank');

      const payload = {
        shopName,
        phone,
        requestType,
        details,
      };

      try {
        const response = await fetch('/api/order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'تعذر حفظ الرسالة.');
        }

        if (whatsappWindow) whatsappWindow.location.href = data.whatsappUrl;
        orderForm.reset();
        setFormStatus(
          status,
          `تم حفظ رسالتك برقم ${data.orderId}.`,
          whatsappWindow ? null : data.whatsappUrl
        );
      } catch (error) {
        if (whatsappWindow) whatsappWindow.close();
        console.error('Contact message submission failed:', error);
        setFormStatus(status, error.message || 'تعذر حفظ الرسالة. حاول مرة أخرى.');
      }
    });
  }

  const catalogGrid = document.getElementById('catalogGrid');
  const catalogSearch = document.getElementById('catalogSearch');
  const catalogSort = document.getElementById('catalogSort');
  const catalogCount = document.getElementById('catalogCount');
  const catalogEmpty = document.getElementById('catalogEmpty');
  const catalogSuggestions = document.getElementById('catalogSuggestions');
  const catalogPagination = document.getElementById('catalogPagination');
  const qualityFilters = document.getElementById('qualityFilters');
  const catalogCategoryBar = document.querySelector('.catalog-category-nav');
  const productDetail = document.getElementById('productDetail');
  const catalogView = document.getElementById('catalogView');
  const requestedProduct = new URLSearchParams(window.location.search).get('product');
  const requestedQuality = new URLSearchParams(window.location.search).get('quality');
  const catalogProductByName = new Map();
  let catalogLoadError = null;

  if (catalogGrid && qualityFilters) {
    try {
      const products = await window.catalogProductsReady;
      products.forEach((product) => catalogProductByName.set(product.name, product));
      window.catalogProducts = products.map((product) => product.name);
    } catch (error) {
      catalogLoadError = error;
      window.catalogProducts = [];
      console.error('Catalog could not be loaded:', error);
      catalogCount.textContent = 'تعذر تحميل الأصناف.';
      catalogEmpty.textContent = 'تعذر تحميل الكتالوج الآن. حاول مرة أخرى لاحقًا.';
      catalogEmpty.hidden = false;
    }
  }

  const updateCatalogCategoryOffset = () => {
    if (header && catalogCategoryBar) {
      catalogCategoryBar.style.setProperty('--catalog-category-top', `${header.offsetHeight}px`);
    }
  };

  updateCatalogCategoryOffset();
  window.addEventListener('resize', updateCatalogCategoryOffset);

  if (catalogGrid && qualityFilters && Array.isArray(window.catalogProducts) && !catalogLoadError) {
    const pageSize = 24;
    let currentPage = 1;
    let selectedQuality = '';
    const qualityOptions = [
      { label: 'كل المنتجات', term: '' },
      { label: 'بطاريات', term: 'battery', category: 'battery' },
      { label: 'GX', term: 'GX', excludeTerms: ['GX INCELL'] },
      { label: 'GX INCELL', term: 'GX INCELL', allTerms: ['GX', 'Incell'], gxIncell: true },
      { label: 'Incell', term: 'Incell', terms: ['Incell', 'inell'], regularIncell: true },
      { label: 'OLED', term: 'OLED' },
      { label: 'JK', term: 'JK' },
      { label: 'VIP', term: 'VIP', terms: ['VIP', 'سيلفر', 'silver'], excludeTerms: ['VIP P&P'] },
      { label: 'VIP P&P', term: 'P&P' },
      { label: 'ORG NEW', term: 'ORG NEW', terms: ['OR NEW', 'ORG NEW'] },
      {
        label: '100%',
        term: '100%',
        excludeTerms: ['VIP 100%', '100% VIP'],
        excludeAllTerms: ['JT', '100%'],
      },
      { label: 'توكيل', term: 'توكيل', terms: ['توكيل', 'NOTE 20 ULTRA', 'NOTE20 ULTRA'] },
      {
        label: 'ايفونات خلع',
        term: 'ايفونات خلع',
        terms: ['أصلي', 'اصلي', 'اصلى', 'أصليه', 'اصليه', 'باغة', 'باغه', 'خلع'],
        excludeTerms: ['NOTE 20 ULTRA', 'NOTE20 ULTRA'],
      },
      { label: 'JT الأصلي', term: 'JT' },
      { label: 'OC', term: 'OC' },
      { label: 'OR', term: 'OR', terms: ['OR'], wholeWord: true, excludeTerms: ['OR NEW', 'ORG NEW'] },
      { label: 'AA', term: 'AA', terms: ['AA', 'COPY'], wholeWord: true, unclassifiedGroup: 'remaining' },
      { label: 'NOKIA / لحام', term: 'NOKIA', unclassifiedGroup: 'nokia' },
      { label: 'IPH INCELL', term: 'IPH INCELL', unclassifiedGroup: 'iph-incell' },
      { label: 'HD / HD+', term: 'HD / HD+', terms: ['HD', 'HD+'] },
      { label: 'XJE', term: 'XJE' },
      { label: 'SVC', term: 'SVC' },
      { label: 'DD', term: 'DD', terms: ['DD'], wholeWord: true },
      { label: 'موستي', term: 'موستي' },
      { label: 'JOKER', term: 'JOKER', hidden: true },
      { label: 'نواقص السوق', term: 'market-shortages', products: [] },
    ];
    if (qualityOptions.some((quality) => !quality.hidden && quality.term === requestedQuality)) {
      selectedQuality = requestedQuality;
    }

    const matchesQualityTerm = (name, term, quality) => {
      if (quality.wholeWord) {
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?:^|[^A-Za-z0-9])${escapedTerm}(?:$|[^A-Za-z0-9])`, 'i').test(name);
      }
      return name.toLocaleLowerCase().includes(term.toLocaleLowerCase());
    };

    const matchesSpecifiedQuality = (name, quality) => {
      const lowerName = name.toLocaleLowerCase();
      const terms = quality.terms || (quality.term ? [quality.term] : []);
      const matchesAnyTerm = terms.some((term) => matchesQualityTerm(name, term, quality));
      const matchesAllTerms = quality.allTerms?.every((term) => lowerName.includes(term.toLocaleLowerCase()));
      const excludedByAllTerms = Boolean(quality.excludeAllTerms?.length) &&
        quality.excludeAllTerms.every((term) => lowerName.includes(term.toLocaleLowerCase()));
      const excluded = (quality.excludeTerms || []).some((term) => lowerName.includes(term.toLocaleLowerCase())) ||
        excludedByAllTerms;
      return (quality.allTerms ? matchesAllTerms : matchesAnyTerm) && !excluded;
    };

    const specifiedQualityOptions = qualityOptions.filter((quality) => !quality.unclassifiedGroup);
    const isSolderingScreen = (name) =>
      ['PIN', 'رجل'].some((term) => matchesQualityTerm(name, term, { wholeWord: true }));
    const isUnclassified = (name) =>
      !isSolderingScreen(name) &&
      !specifiedQualityOptions.some((quality) => matchesSpecifiedQuality(name, quality));
    const hasBWEnding = (name) => /(?:^|[\s\\/])(?:B|W)$/i.test(name.trim());
    const hasIncellQuality = (name) =>
      ['Incell', 'inell'].some((term) => matchesQualityTerm(name, term, {}));
    const startsWithIph = (name) => /^(?:Lcd\s+)?IPH\b/i.test(name.trim());
    const endsWithOrange = (name) => /(?:أورنج|اورنج|orange)\s*$/i.test(name.trim());
    const isGxIncellProduct = (name) =>
      hasIncellQuality(name) &&
      (/\bGX\b/i.test(name) || startsWithIph(name) || endsWithOrange(name));

    const matchesQuality = (name, quality) => {
      const product = catalogProductByName.get(name);
      if (quality.category) return product?.category === quality.category;
      if (product?.category === 'battery') return false;
      if (quality.products) return quality.products.includes(name);
      if (quality.gxIncell) return isGxIncellProduct(name);
      if (quality.regularIncell) return hasIncellQuality(name) && !isGxIncellProduct(name);
      if (!quality.unclassifiedGroup) return matchesSpecifiedQuality(name, quality);

      const unclassified = isUnclassified(name);
      const isNokia = /nokia/i.test(name);
      const endsWithBW = hasBWEnding(name);

      if (quality.unclassifiedGroup === 'nokia') return isSolderingScreen(name) || (unclassified && isNokia);
      if (quality.unclassifiedGroup === 'iph-incell') return unclassified && endsWithBW;
      if (quality.unclassifiedGroup === 'remaining') {
        return matchesSpecifiedQuality(name, quality) || (unclassified && !isNokia && !endsWithBW);
      }

      return false;
    };

    const batterySearchTerms = new Set([
      'battery', 'batteries', 'بطاريه', 'بطارية', 'بطاريات', 'البطاريه', 'البطارية', 'البطاريات',
    ]);
    const brandSearchTerms = new Set([
      'samsung', 'سامسونج', 'galaxy', 'جالكسي', 'جالاكسي',
      'oppo', 'اوبو', 'شاومي', 'xiaomi', 'redmi', 'ريدمي',
      'huawei', 'هواوي', 'realme', 'ريلمي',
    ]);

    const getSearchTerms = (value, removeBrandAliases = false) => {
      const normalized = value.toLocaleLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
        .replace(/i[\s-]*phone|apple/gi, ' iph ')
        .replace(/ايفون/g, ' iph ')
        .replace(/\b(?:screen|screens|display|displays)\b/gi, ' lcd ')
        .replace(/(?:الشاشة|الشاشه|شاشة|شاشه|الشاشات|شاشات)/g, ' lcd ')
        .replace(/[^a-z0-9\u0600-\u06ff]+/gi, ' ')
        .trim();
      let tokens = normalized ? normalized.split(/\s+/) : [];
      let category = null;
      tokens = tokens.filter((token) => {
        if (batterySearchTerms.has(token)) {
          category = 'battery';
          return false;
        }
        return true;
      });

      if (removeBrandAliases && tokens.some((token) => !brandSearchTerms.has(token))) {
        tokens = tokens.filter((token) => !brandSearchTerms.has(token));
      }

      const compactedTokens = [];
      for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        const nextToken = tokens[index + 1];
        if (token === 'p' && nextToken === 'p') {
          compactedTokens.push('pp');
          index += 1;
        } else if ((token === 'or' || token === 'org') && nextToken === 'new') {
          compactedTokens.push('ornew');
          index += 1;
        } else {
          compactedTokens.push(token);
        }
      }

      return { tokens: compactedTokens, category };
    };

    const getEditDistance = (first, second) => {
      if (first.length === second.length) {
        const differences = [];
        for (let index = 0; index < first.length; index += 1) {
          if (first[index] !== second[index]) differences.push(index);
        }
        if (differences.length === 2 &&
          differences[1] === differences[0] + 1 &&
          first[differences[0]] === second[differences[1]] &&
          first[differences[1]] === second[differences[0]]) {
          return 1;
        }
      }

      let previousRow = Array.from({ length: second.length + 1 }, (_, index) => index);
      for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
        const currentRow = [firstIndex];
        for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
          const substitutionCost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;
          currentRow[secondIndex] = Math.min(
            currentRow[secondIndex - 1] + 1,
            previousRow[secondIndex] + 1,
            previousRow[secondIndex - 1] + substitutionCost
          );
        }
        previousRow = currentRow;
      }
      return previousRow[second.length];
    };

    const getFuzzyTokenScore = (queryToken, productToken) => {
      if (queryToken === productToken) return 0;
      if (queryToken.length >= 2 && productToken.startsWith(queryToken)) {
        return 0.2 + (productToken.length - queryToken.length) * 0.01;
      }
      if (queryToken.length < 3) return null;

      const maxDistance = queryToken.length >= 7 ? 2 : 1;
      const distance = getEditDistance(queryToken, productToken);
      return distance <= maxDistance ? 1 + distance * 0.1 : null;
    };

    const getFuzzySearchScore = (queryTokens, productName) => {
      const availableTokens = getSearchTerms(productName).tokens;
      const orderedQueryTokens = [...queryTokens].sort((first, second) => second.length - first.length);
      let score = 0;

      for (const queryToken of orderedQueryTokens) {
        let bestScore = null;
        let bestIndex = -1;
        availableTokens.forEach((productToken, index) => {
          const tokenScore = getFuzzyTokenScore(queryToken, productToken);
          if (tokenScore !== null && (bestScore === null || tokenScore < bestScore)) {
            bestScore = tokenScore;
            bestIndex = index;
          }
        });
        if (bestIndex < 0) return null;
        score += bestScore;
        availableTokens.splice(bestIndex, 1);
      }

      return score;
    };

    const getFilteredProducts = () => {
      const rawQuery = catalogSearch.value.trim();
      const search = getSearchTerms(rawQuery, true);
      const direction = catalogSort.value === 'desc' ? -1 : 1;
      const selectedOption = qualityOptions.find((quality) => quality.term === selectedQuality);
      const matchesSelectedFilters = (name) => {
        const product = catalogProductByName.get(name);
        const matchesSelectedQuality = !selectedQuality || matchesQuality(name, selectedOption);
        const matchesSearchCategory = !search.category || product?.category === search.category;
        return matchesSelectedQuality && matchesSearchCategory;
      };

      const exactProducts = window.catalogProducts.filter((name) => {
        if (!matchesSelectedFilters(name)) return false;
        if (!rawQuery) return true;
        if (search.tokens.length === 0) return Boolean(search.category);

        const productTokens = getSearchTerms(name).tokens;
        return search.tokens.every((queryToken) =>
          productTokens.some((productToken) => productToken.includes(queryToken))
        );
      }).sort((first, second) =>
        direction * first.localeCompare(second, 'en', { numeric: true, sensitivity: 'base' })
      );

      if (exactProducts.length > 0 || !rawQuery || search.tokens.length === 0) {
        return { products: exactProducts, suggestions: [] };
      }

      const suggestions = window.catalogProducts
        .filter(matchesSelectedFilters)
        .map((name) => ({ name, score: getFuzzySearchScore(search.tokens, name) }))
        .filter((product) => product.score !== null)
        .sort((first, second) =>
          first.score - second.score ||
          direction * first.name.localeCompare(second.name, 'en', { numeric: true, sensitivity: 'base' })
        )
        .slice(0, 5)
        .map((product) => product.name);

      return { products: exactProducts, suggestions };
    };

    const renderCatalog = () => {
      const { products: filteredProducts, suggestions } = getFilteredProducts();
      const rawQuery = catalogSearch.value.trim();
      const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
      currentPage = Math.min(currentPage, pageCount);
      const startIndex = (currentPage - 1) * pageSize;
      const visibleProducts = filteredProducts.slice(startIndex, startIndex + pageSize);

      catalogGrid.replaceChildren();
      visibleProducts.forEach((name) => {
        const product = catalogProductByName.get(name);
        const card = document.createElement('article');
        card.className = 'product-card catalog-card';

        const imageWrap = document.createElement('div');
        imageWrap.className = 'product-image';
        const productUrl = `products.html?product=${encodeURIComponent(name)}`;
        const imageLink = document.createElement('a');
        imageLink.className = 'catalog-product-link';
        imageLink.href = productUrl;
        const image = document.createElement('img');
        image.src = product.imageUrl ||
          (product.category === 'battery' ? 'battery-placeholder.svg' : 'lcd-placeholder.svg');
        image.alt = product.imageUrl
          ? `صورة الشاشة: ${name}`
          : (product.category === 'battery' ? 'صورة توضيحية لبطارية هاتف' : 'صورة توضيحية لشاشة هاتف');
        image.loading = 'lazy';
        imageLink.append(image);
        imageWrap.append(imageLink);

        const body = document.createElement('div');
        body.className = 'product-body';
        const heading = document.createElement('h3');
        const headingLink = document.createElement('a');
        headingLink.className = 'catalog-product-link';
        headingLink.href = productUrl;
        headingLink.textContent = name;
        heading.append(headingLink);
        const description = document.createElement('p');
        description.textContent = 'التوافر النهائي يؤكده فريق المبيعات.';

        const price = document.createElement('div');
        price.className = 'catalog-card-price';
        const priceLabel = document.createElement('span');
        priceLabel.textContent = 'سعر القطعة';
        const priceValue = document.createElement('strong');
        priceValue.textContent = formatPrice(product.price);
        price.append(priceLabel, priceValue);

        const imageRequest = document.createElement('a');
        imageRequest.className = 'product-image-request';
        imageRequest.href = `https://wa.me/201286664149?text=${encodeURIComponent(`لو سمحت، أرسل صورة الصنف: ${name}`)}`;
        imageRequest.target = '_blank';
        imageRequest.rel = 'noopener noreferrer';
        imageRequest.textContent = 'اطلب صورة الصنف عبر واتساب';

        const priceRequest = document.createElement('a');
        priceRequest.className = 'product-image-request';
        priceRequest.href = `https://wa.me/201286664149?text=${encodeURIComponent(`لو سمحت، أريد مراجعة سعر الصنف: ${name}`)}`;
        priceRequest.target = '_blank';
        priceRequest.rel = 'noopener noreferrer';
        priceRequest.textContent = 'راجع السعر مع المبيعات';

        const footer = document.createElement('div');
        footer.className = 'product-footer';
        const addButton = document.createElement('button');
        addButton.className = 'btn btn-primary catalog-add-button';
        addButton.type = 'button';
        addButton.dataset.productName = name;
        addButton.textContent = 'أضف للسلة';

        const orderLink = document.createElement('a');
        orderLink.className = 'btn btn-secondary';
        orderLink.href = productUrl;
        orderLink.textContent = 'التفاصيل';

        footer.append(addButton, orderLink);
        body.append(heading, price, description, imageRequest, priceRequest, footer);
        card.append(imageWrap, body);
        catalogGrid.append(card);
      });

      catalogSuggestions.replaceChildren();
      catalogSuggestions.hidden = suggestions.length === 0;
      if (suggestions.length > 0) {
        const heading = document.createElement('strong');
        heading.textContent = 'مفيش تطابق كامل؛ يمكن تقصد واحد من دول:';
        const suggestionList = document.createElement('div');
        suggestionList.className = 'catalog-suggestion-list';
        suggestions.forEach((name) => {
          const suggestion = document.createElement('button');
          suggestion.type = 'button';
          suggestion.dataset.searchSuggestion = name;
          suggestion.textContent = name;
          suggestionList.append(suggestion);
        });
        catalogSuggestions.append(heading, suggestionList);
      }

      catalogCount.textContent = suggestions.length > 0
        ? `${suggestions.length} مقترحات قريبة`
        : `${filteredProducts.length} صنف`;
      catalogEmpty.textContent = rawQuery
        ? 'ملقيناش أصناف قريبة من البحث. جرّب اسمًا أو رقم موديل مختلفًا.'
        : 'لا توجد منتجات تطابق التصنيف المختار.';
      catalogEmpty.hidden = filteredProducts.length > 0 || suggestions.length > 0;
      catalogPagination.hidden = suggestions.length > 0 || pageCount <= 1;
      document.getElementById('catalogPage').textContent = `صفحة ${currentPage} من ${pageCount}`;
      document.getElementById('catalogPrevious').disabled = currentPage === 1;
      document.getElementById('catalogNext').disabled = currentPage === pageCount;
    };

    catalogSuggestions.addEventListener('click', (event) => {
      const suggestion = event.target.closest('[data-search-suggestion]');
      if (!suggestion) return;
      catalogSearch.value = suggestion.dataset.searchSuggestion;
      currentPage = 1;
      renderCatalog();
      catalogSearch.focus();
    });

    const updateCategorySelection = () => {
      qualityFilters.querySelectorAll('.quality-filter').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.qualityTerm === selectedQuality));
      });
    };

    const setSelectedQuality = (term) => {
      selectedQuality = term;
      currentPage = 1;
      updateCategorySelection();
      renderCatalog();
    };

    qualityOptions.filter((quality) => !quality.hidden).forEach((quality) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quality-filter';
      button.setAttribute('aria-pressed', String(quality.term === selectedQuality));
      button.dataset.qualityTerm = quality.term;
      button.textContent = quality.label;
      button.addEventListener('click', () => {
        setSelectedQuality(quality.term);
      });
      button.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const buttons = Array.from(qualityFilters.querySelectorAll('.quality-filter'));
          const currentIndex = buttons.indexOf(button);
          const direction = (event.key === 'ArrowRight' ? 1 : -1) *
            (getComputedStyle(qualityFilters).direction === 'rtl' ? -1 : 1);
          const nextButton = buttons[(currentIndex + direction + buttons.length) % buttons.length];
          nextButton.focus();
          nextButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      });
      qualityFilters.append(button);
    });

    catalogSearch.addEventListener('input', () => {
      currentPage = 1;
      renderCatalog();
    });
    catalogSort.addEventListener('change', () => {
      currentPage = 1;
      renderCatalog();
    });
    document.getElementById('catalogPrevious').addEventListener('click', () => {
      currentPage -= 1;
      renderCatalog();
    });
    document.getElementById('catalogNext').addEventListener('click', () => {
      currentPage += 1;
      renderCatalog();
    });
    renderCatalog();
  }

  const cartDialog = document.getElementById('cartDialog');
  const cartItemsContainer = document.getElementById('cartItems');
  const cartCount = document.getElementById('cartCount');
  const cartTotalQuantity = document.getElementById('cartTotalQuantity');
  const cartTotalPrice = document.getElementById('cartTotalPrice');
  const cartEmpty = document.getElementById('cartEmpty');
  const sendCartButton = document.getElementById('sendCartButton');
  const checkoutStartButton = document.getElementById('checkoutStartButton');
  const checkoutBackButton = document.getElementById('checkoutBackButton');
  const checkoutForm = document.getElementById('checkoutForm');
  const cartCheckoutActions = document.getElementById('cartCheckoutActions');
  const cartOrderStatus = document.getElementById('cartOrderStatus');
  const paymentMethodNote = document.getElementById('paymentMethodNote');
  const fulfillmentMethodNote = document.getElementById('fulfillmentMethodNote');
  const shippingCompanyInput = document.getElementById('cartShippingCompany');
  const cartShopName = document.getElementById('cartShopName');
  const cartPhone = document.getElementById('cartPhone');
  const cartStorageKey = 'pepsi-parts-cart';

  if (cartDialog && cartItemsContainer && cartCount && cartTotalQuantity && cartTotalPrice &&
    cartEmpty && sendCartButton && checkoutStartButton && checkoutBackButton && checkoutForm &&
    cartCheckoutActions) {
    let cartItems = [];
    let pendingCatalogOrder = null;
    let updatedSavedCart = false;
    try {
      const savedCart = JSON.parse(localStorage.getItem(cartStorageKey) || '[]');
      if (Array.isArray(savedCart)) {
        cartItems = savedCart.flatMap((item) => {
          if (!item || typeof item.name !== 'string' ||
            !Number.isInteger(item.quantity) || item.quantity < 1) {
            updatedSavedCart = true;
            return [];
          }

          const product = catalogProductByName.get(item.name);
          if (!product) {
            updatedSavedCart = true;
            return [];
          }

          const maximum = product.maxQuantity || 9999;
          if (item.quantity > maximum) updatedSavedCart = true;
          return [{ name: item.name, quantity: Math.min(item.quantity, maximum) }];
        });
      }
    } catch (error) {
      cartItems = [];
    }

    const saveCart = () => {
      try {
        localStorage.setItem(cartStorageKey, JSON.stringify(cartItems));
      } catch (error) {
        console.warn('Cart changes will not persist after leaving this page.');
      }
    };

    const renderCart = () => {
      cartItemsContainer.replaceChildren();
      const totalQuantity = cartItems.reduce((total, item) => total + item.quantity, 0);
      const totalPrice = cartItems.reduce((total, item) => {
        const product = catalogProductByName.get(item.name);
        return total + (product ? product.price * item.quantity : 0);
      }, 0);
      cartCount.textContent = String(totalQuantity);
      cartTotalQuantity.textContent = String(totalQuantity);
      cartTotalPrice.textContent = formatPrice(totalPrice);
      cartEmpty.hidden = cartItems.length > 0;
      checkoutStartButton.disabled = cartItems.length === 0 || Boolean(pendingCatalogOrder);
      sendCartButton.disabled = cartItems.length === 0;

      cartItems.forEach((item) => {
        const product = catalogProductByName.get(item.name);
        const maximum = product?.maxQuantity || 9999;
        const row = document.createElement('article');
        row.className = 'cart-item';

        const details = document.createElement('div');
        details.className = 'cart-item-details';
        const name = document.createElement('h3');
        name.textContent = item.name;
        const type = document.createElement('span');
        type.textContent = product?.category === 'battery' ? 'بطارية' : 'LCD';
        const price = document.createElement('span');
        price.textContent = product ? formatPrice(product.price) : '';
        details.append(name, type, price);

        const controls = document.createElement('div');
        controls.className = 'cart-item-controls';
        const decrease = document.createElement('button');
        decrease.type = 'button';
        decrease.dataset.cartAction = 'decrease';
        decrease.dataset.productName = item.name;
        decrease.setAttribute('aria-label', `تقليل كمية ${item.name}`);
        decrease.textContent = '−';
        decrease.disabled = item.quantity <= 1;
        const quantity = document.createElement('span');
        quantity.textContent = String(item.quantity);
        const increase = document.createElement('button');
        increase.type = 'button';
        increase.dataset.cartAction = 'increase';
        increase.dataset.productName = item.name;
        increase.setAttribute('aria-label', `زيادة كمية ${item.name}`);
        increase.textContent = '+';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'cart-item-remove';
        remove.dataset.cartAction = 'remove';
        remove.dataset.productName = item.name;
        remove.textContent = 'إزالة';
        decrease.disabled = item.quantity <= 1 || Boolean(pendingCatalogOrder);
        increase.disabled = Boolean(pendingCatalogOrder) || item.quantity >= maximum;
        remove.disabled = Boolean(pendingCatalogOrder);
        controls.append(decrease, quantity, increase, remove);

        row.append(details, controls);
        cartItemsContainer.append(row);
      });
    };

    const setCheckoutMode = (isCheckout) => {
      checkoutForm.hidden = !isCheckout;
      cartCheckoutActions.hidden = isCheckout;
    };

    const setCheckoutFieldsDisabled = (disabled) => {
      checkoutForm.querySelectorAll('input, select, textarea').forEach((field) => {
        field.disabled = disabled;
      });
      checkoutBackButton.disabled = disabled;
    };

    const updatePaymentMethodNote = () => {
      const selectedMethod = checkoutForm.querySelector('[name="paymentMethod"]:checked')?.value;
      const fulfillmentMethod =
        checkoutForm.querySelector('[name="fulfillmentMethod"]:checked')?.value;
      document.getElementById('instapayPaymentDetails').hidden = selectedMethod !== 'instapay';
      if (selectedMethod === 'instapay') {
        paymentMethodNote.textContent =
          'حوّل إلى البيانات الموضحة أعلاه، ثم أرسل إيصال التحويل للمبيعات عبر واتساب. لن يتأكد الدفع إلا بعد المراجعة.';
      } else if (selectedMethod === 'wallet_transfer') {
        paymentMethodNote.textContent =
          'رقم المحفظة متغير؛ أرسل الطلب أولًا وسترسل لك المبيعات رقم التحويل الحالي عبر واتساب.';
      } else {
        paymentMethodNote.textContent = fulfillmentMethod === 'pickup'
          ? 'سيتم تحصيل قيمة الطلب عند استلامه من المحل.'
          : 'سيتم تحصيل قيمة الطلب عند استلام الشحنة. التوافر ومصاريف الشحن النهائية يؤكدهما فريق المبيعات.';
      }
    };

    const updateFulfillmentFields = () => {
      const fulfillmentMethod =
        checkoutForm.querySelector('[name="fulfillmentMethod"]:checked')?.value;
      const isShipping = fulfillmentMethod === 'shipping';
      document.querySelectorAll('.shipping-order-field').forEach((field) => {
        field.hidden = !isShipping;
        const input = field.querySelector('input, select, textarea');
        if (input) {
          input.required = isShipping && field.dataset.shippingRequired === 'true';
          if (!isShipping) input.value = '';
        }
      });
      document.getElementById('storePickupDetails').hidden = isShipping;
      fulfillmentMethodNote.textContent = isShipping
        ? 'الإجمالي لا يشمل مصاريف الشحن. اكتب شركة الشحن والعنوان المطلوب.'
        : 'الاستلام من المحل على العنوان الموضح أعلاه، ولا تُضاف مصاريف شحن.';
      updatePaymentMethodNote();
    };

    checkoutStartButton.addEventListener('click', () => {
      if (cartItems.length === 0) return;
      setCheckoutMode(true);
      cartOrderStatus.textContent = '';
      updateFulfillmentFields();
    });

    checkoutBackButton.addEventListener('click', () => {
      if (pendingCatalogOrder) return;
      setCheckoutMode(false);
      cartOrderStatus.textContent = '';
    });

    checkoutForm.querySelectorAll('[name="paymentMethod"]').forEach((option) => {
      option.addEventListener('change', updatePaymentMethodNote);
    });
    checkoutForm.querySelectorAll('[name="fulfillmentMethod"]').forEach((option) => {
      option.addEventListener('change', updateFulfillmentFields);
    });

    const addItemToCart = (name, quantity, statusTarget) => {
      const product = catalogProductByName.get(name);
      if (!product) {
        setFormStatus(statusTarget, 'هذا الصنف غير متاح حاليًا.');
        return;
      }

      const maximum = product.maxQuantity || 9999;
      const existingItem = cartItems.find((item) => item.name === name);
      if (existingItem && existingItem.quantity + quantity > maximum) {
        setFormStatus(statusTarget, `الحد الأقصى لهذا الصنف هو ${maximum} قطعة.`);
        return;
      }

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cartItems.push({ name, quantity });
      }
      saveCart();
      renderCart();
      setFormStatus(statusTarget, 'اتضاف الصنف للعربة. افتح علامة العربة لما تحب تكمل طلبك.');
    };

    catalogGrid?.addEventListener('click', (event) => {
      const addButton = event.target.closest('.catalog-add-button');
      if (!addButton) return;
      addItemToCart(
        addButton.dataset.productName,
        1,
        document.getElementById('catalogCartStatus')
      );
    });

    document.getElementById('cartOpenButton')?.addEventListener('click', () => cartDialog.showModal());
    document.getElementById('cartQuickOpenButton')?.addEventListener('click', () => cartDialog.showModal());
    document.getElementById('cartCloseButton')?.addEventListener('click', () => cartDialog.close());

    cartDialog.addEventListener('click', (event) => {
      const bounds = cartDialog.getBoundingClientRect();
      const clickedOutside = event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom;
      if (clickedOutside) cartDialog.close();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && cartDialog.open) {
        event.preventDefault();
        cartDialog.close();
      }
    });

    cartItemsContainer.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-cart-action]');
      if (!actionButton) return;

      const item = cartItems.find((cartItem) => cartItem.name === actionButton.dataset.productName);
      if (!item) return;

      if (actionButton.dataset.cartAction === 'increase') {
        const product = catalogProductByName.get(item.name);
        const maximum = product?.maxQuantity || 9999;
        if (item.quantity >= maximum) {
          setFormStatus(cartOrderStatus, `الحد الأقصى لطلب هذا الصنف هو ${maximum} قطعة.`);
          return;
        }
        item.quantity += 1;
      }
      if (actionButton.dataset.cartAction === 'decrease' && item.quantity > 1) item.quantity -= 1;
      if (actionButton.dataset.cartAction === 'remove') {
        cartItems = cartItems.filter((cartItem) => cartItem.name !== item.name);
      }

      saveCart();
      renderCart();
    });

    checkoutForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (cartItems.length === 0) return;
      const shopName = cartShopName.value.trim();
      const phone = cartPhone.value.trim();
      const fulfillmentMethod =
        checkoutForm.querySelector('[name="fulfillmentMethod"]:checked')?.value;
      const shippingCompany = shippingCompanyInput.value.trim();
      const governorate = document.getElementById('cartGovernorate').value;
      const address = document.getElementById('cartAddress').value.trim();
      const landmark = document.getElementById('cartLandmark').value.trim();
      const paymentMethod = checkoutForm.querySelector('[name="paymentMethod"]:checked')?.value;
      if (!shopName || !phone || !fulfillmentMethod || !paymentMethod ||
        (fulfillmentMethod === 'shipping' && (!shippingCompany || !governorate || !address))) {
        setFormStatus(cartOrderStatus, 'أكمل بيانات التواصل والاستلام وطريقة الدفع.');
        return;
      }

      sendCartButton.disabled = true;
      let whatsappWindow = null;

      try {
        if (pendingCatalogOrder) {
          setFormStatus(cartOrderStatus, 'جارٍ تسجيل الطلب بعد تأكيد الإرسال...');
          const response = await fetch('/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'catalog_order',
              action: 'confirm',
              reference: pendingCatalogOrder.reference,
              shopName: pendingCatalogOrder.shopName,
              phone: pendingCatalogOrder.phone,
              fulfillmentMethod: pendingCatalogOrder.fulfillmentMethod,
              shippingCompany: pendingCatalogOrder.shippingCompany,
              governorate: pendingCatalogOrder.governorate,
              address: pendingCatalogOrder.address,
              landmark: pendingCatalogOrder.landmark,
              paymentMethod: pendingCatalogOrder.paymentMethod,
              items: pendingCatalogOrder.items,
            }),
          });
          const data = await response.json();
          if (!response.ok || !data.success) {
            throw new Error(data.error || 'تعذر تسجيل الطلب.');
          }

          pendingCatalogOrder = null;
          cartItems = [];
          saveCart();
          renderCart();
          checkoutForm.reset();
          setCheckoutFieldsDisabled(false);
          setCheckoutMode(false);
          sendCartButton.textContent = 'متابعة إلى واتساب';
          updateFulfillmentFields();
          setFormStatus(
            cartOrderStatus,
            `تم تسجيل الطلب رقم ${data.orderId}. حالة الدفع: بانتظار التحصيل أو مراجعة التحويل.`
          );
          return;
        }

        whatsappWindow = window.open('about:blank', '_blank');
        setFormStatus(cartOrderStatus, 'جارٍ تجهيز رسالة واتساب...');
        const orderItems = cartItems.map((item) => ({ name: item.name, quantity: item.quantity }));
        const response = await fetch('/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'catalog_order',
            action: 'prepare',
            shopName,
            phone,
            fulfillmentMethod,
            shippingCompany,
            governorate,
            address,
            landmark,
            paymentMethod,
            items: orderItems,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'تعذر تجهيز رسالة واتساب.');
        }

        if (whatsappWindow) whatsappWindow.location.href = data.whatsappUrl;
        pendingCatalogOrder = {
          reference: data.reference,
          shopName,
          phone,
          fulfillmentMethod,
          shippingCompany,
          governorate,
          address,
          landmark,
          paymentMethod,
          items: orderItems,
        };
        setCheckoutFieldsDisabled(true);
        sendCartButton.textContent = 'تم إرسال الطلب - سجّله';
        renderCart();
        setFormStatus(
          cartOrderStatus,
          paymentMethod === 'instapay'
            ? 'بعد إرسال الطلب، استخدم بيانات إنستا باي الموضحة وأرسل الإيصال للمبيعات عبر واتساب. ارجع لهذه الصفحة واضغط «تم إرسال الطلب - سجّله» لتسجيله بانتظار مراجعة الدفع.'
            : paymentMethod === 'wallet_transfer'
              ? 'بعد إرسال الطلب، انتظر رقم المحفظة الحالي من المبيعات عبر واتساب. ارجع لهذه الصفحة واضغط «تم إرسال الطلب - سجّله» لتسجيله بانتظار مراجعة الدفع.'
              : 'بعد إرسال الطلب في واتساب ارجع لهذه الصفحة واضغط «تم إرسال الطلب - سجّله». إذا لم ترسله، لا تضغط الزر.',
          data.whatsappUrl
        );
      } catch (error) {
        if (whatsappWindow) whatsappWindow.close();
        console.error('Catalog order workflow failed:', error);
        setFormStatus(cartOrderStatus, error.message || 'تعذر حفظ الطلب. حاول مرة أخرى.');
      } finally {
        sendCartButton.disabled = cartItems.length === 0;
        if (pendingCatalogOrder) sendCartButton.disabled = false;
      }
    });

    renderCart();
    updateFulfillmentFields();
    if (updatedSavedCart) {
      saveCart();
      setFormStatus(cartOrderStatus, 'تم تحديث العربة حسب الأصناف والحدود المتاحة حاليًا.');
    }

    if (productDetail && catalogView && requestedProduct && window.catalogProducts.includes(requestedProduct)) {
      const product = catalogProductByName.get(requestedProduct);
      const maximum = product.maxQuantity || 9999;
      catalogView.hidden = true;
      productDetail.hidden = false;
      document.getElementById('catalogEyebrow').textContent = 'تفاصيل المنتج';
      document.querySelector('#catalog .section-heading h1').textContent = 'إضافة المنتج إلى العربة';
      catalogCount.hidden = true;
      document.getElementById('productDetailName').textContent = requestedProduct;
      document.getElementById('productTypeLabel').textContent =
        product.category === 'battery' ? 'بطارية' : 'شاشة LCD';
      document.getElementById('productDetailPrice').textContent =
        `السعر الموحد: ${formatPrice(product.price)}`;
      document.getElementById('productMaxQuantity').textContent = product.maxQuantity
        ? `الحد الأقصى لكل صنف: ${product.maxQuantity} قطع.`
        : '';
      const detailImage = productDetail.querySelector('.product-detail-image img');
      detailImage.src = product.imageUrl ||
        (product.category === 'battery' ? 'battery-placeholder.svg' : 'lcd-placeholder.svg');
      detailImage.alt = product.imageUrl
        ? `صورة الشاشة: ${requestedProduct}`
        : (product.category === 'battery' ? 'صورة توضيحية لبطارية هاتف' : 'صورة توضيحية لشاشة هاتف');
      const imageRequest = document.getElementById('productImageRequest');
      imageRequest.href =
        `https://wa.me/201286664149?text=${encodeURIComponent(`لو سمحت، أرسل صورة الصنف: ${requestedProduct}`)}`;
      imageRequest.textContent = product.category === 'battery'
        ? 'اطلب صورة البطارية عبر واتساب'
        : 'اطلب صورة الشاشة عبر واتساب';
      document.getElementById('productPriceRequest').href =
        `https://wa.me/201286664149?text=${encodeURIComponent(`لو سمحت، أريد مراجعة سعر الصنف: ${requestedProduct}`)}`;

      const quantityInput = document.getElementById('productQuantity');
      quantityInput.max = String(maximum);
      const normalizeQuantity = () => {
        const quantity = Number.parseInt(quantityInput.value, 10);
        quantityInput.value = String(
          Number.isInteger(quantity) && quantity > 0 ? Math.min(quantity, maximum) : 1
        );
      };

      document.getElementById('productQuantityMinus').addEventListener('click', () => {
        normalizeQuantity();
        quantityInput.value = String(Math.max(1, Number(quantityInput.value) - 1));
      });
      document.getElementById('productQuantityPlus').addEventListener('click', () => {
        normalizeQuantity();
        quantityInput.value = String(Math.min(maximum, Number(quantityInput.value) + 1));
      });
      quantityInput.addEventListener('change', normalizeQuantity);

      document.getElementById('addToCartButton').addEventListener('click', () => {
        normalizeQuantity();
        const quantity = Number(quantityInput.value);
        addItemToCart(requestedProduct, quantity, document.getElementById('productCartStatus'));
      });
    } else if (productDetail && requestedProduct && !catalogLoadError) {
      catalogEmpty.textContent = 'هذا الصنف غير متاح حاليًا.';
      catalogEmpty.hidden = false;
    }
  }
});
