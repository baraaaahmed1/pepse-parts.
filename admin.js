document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('adminLogin');
  const usernameInput = document.getElementById('adminUsername');
  const passwordInput = document.getElementById('adminPassword');
  const statusElement = document.getElementById('adminStatus');
  const ordersTable = document.getElementById('ordersTable');
  const ordersBody = document.getElementById('ordersBody');
  const refreshButton = document.getElementById('refreshOrders');
  const catalogUploadPanel = document.getElementById('catalogUploadPanel');
  const catalogUploadForm = document.getElementById('catalogUploadForm');
  const catalogUploadFile = document.getElementById('catalogUploadFile');
  const catalogUploadStatus = document.getElementById('catalogUploadStatus');
  let authorization = '';

  const statusLabels = {
    new: 'جديد',
    confirmed: 'تم التأكيد',
    shipped: 'تم الشحن',
    cancelled: 'ملغي',
  };
  const paymentMethodLabels = {
    cash_on_delivery: 'الدفع عند الاستلام',
    instapay: 'إنستا باي يدوي',
    wallet_transfer: 'تحويل محفظة',
  };
  const paymentStatusLabels = {
    unpaid: 'بانتظار التحصيل',
    paid: 'تم التحصيل',
  };

  const encodeBasicCredentials = (username, password) => {
    const bytes = new TextEncoder().encode(`${username}:${password}`);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return `Basic ${btoa(binary)}`;
  };

  const apiRequest = async (url, options = {}) => {
    const isFormData = options.body instanceof FormData;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: authorization,
        ...(!isFormData && options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      if (response.status === 401) authorization = '';
      throw new Error(data.error || 'تعذر إكمال العملية.');
    }
    return data;
  };

  const makeCell = (content) => {
    const cell = document.createElement('td');
    if (content instanceof Node) cell.append(content);
    else cell.textContent = content;
    return cell;
  };

  const loadOrders = async () => {
    statusElement.textContent = 'جارٍ تحميل الطلبات...';
    const { orders } = await apiRequest('/api/admin/orders');
    ordersBody.replaceChildren();

    orders.forEach((order) => {
      const row = document.createElement('tr');
      const orderDate = new Date(order.created_at).toLocaleString('ar-EG');
      row.append(makeCell(`#${order.id}${order.reference ? `\nمرجع واتساب: ${order.reference}` : ''}\n${orderDate}`));
      row.append(makeCell(order.type === 'catalog_order' ? 'طلب كتالوج' : order.request_type || 'رسالة'));
      const deliveryDetails = order.type !== 'catalog_order'
        ? ''
        : order.fulfillment_method === 'pickup'
          ? '\nطريقة الاستلام: استلام من المحل\nعنوان الاستلام: العتبة - شارع محمد علي، عمارة أبو الجوخ، الدور الثالث'
          : order.fulfillment_method === 'shipping'
            ? `\nطريقة الاستلام: شحن\nشركة الشحن: ${order.shipping_company || 'لم تُحدد'}\n` +
              `الشحن إلى: ${order.delivery_governorate || ''}\n${order.delivery_address || ''}` +
              (order.delivery_landmark ? `\nعلامة مميزة: ${order.delivery_landmark}` : '')
            : order.delivery_governorate
              ? `\nالشحن إلى: ${order.delivery_governorate}\n${order.delivery_address || ''}` +
                (order.delivery_landmark ? `\nعلامة مميزة: ${order.delivery_landmark}` : '')
              : '';
      row.append(makeCell(`${order.shop_name}\n${order.phone}${deliveryDetails}`));

      const details = document.createElement('div');
      if (order.items.length > 0) {
        const list = document.createElement('ul');
        list.className = 'admin-items';
        order.items.forEach((item) => {
          const entry = document.createElement('li');
          const unitPrice = Number.isFinite(item.unitPrice)
            ? ` — سعر القطعة: ${item.unitPrice} جنيه`
            : '';
          entry.textContent = `${item.name} — الكمية: ${item.quantity}${unitPrice}`;
          list.append(entry);
        });
        details.append(list);
        const note = document.createElement('small');
        note.textContent = order.details;
        details.append(note);
      } else {
        details.textContent = order.details;
      }
      row.append(makeCell(details));

      const paymentDetails = document.createElement('div');
      if (order.type === 'catalog_order') {
        const method = document.createElement('div');
        method.textContent = paymentMethodLabels[order.payment_method] || 'غير محدد';
        const paymentStatus = document.createElement('select');
        paymentStatus.setAttribute('aria-label', `حالة دفع الطلب رقم ${order.id}`);
        Object.entries(paymentStatusLabels).forEach(([value, label]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          option.selected = (order.payment_status || 'unpaid') === value;
          paymentStatus.append(option);
        });
        paymentStatus.addEventListener('change', async () => {
          paymentStatus.disabled = true;
          try {
            await apiRequest(`/api/admin/orders/${order.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ paymentStatus: paymentStatus.value }),
            });
            order.payment_status = paymentStatus.value;
            statusElement.textContent = `تم تحديث تحصيل الطلب رقم ${order.id}.`;
          } catch (error) {
            paymentStatus.value = order.payment_status || 'unpaid';
            statusElement.textContent = error.message;
          } finally {
            paymentStatus.disabled = false;
          }
        });
        paymentDetails.append(method, paymentStatus);
      } else {
        paymentDetails.textContent = '—';
      }
      row.append(makeCell(paymentDetails));

      const status = document.createElement('select');
      status.setAttribute('aria-label', `حالة الطلب رقم ${order.id}`);
      Object.entries(statusLabels).forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.selected = order.status === value;
        status.append(option);
      });
      status.addEventListener('change', async () => {
        status.disabled = true;
        try {
          await apiRequest(`/api/admin/orders/${order.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: status.value }),
          });
          order.status = status.value;
          statusElement.textContent = `تم تحديث حالة الطلب رقم ${order.id}.`;
        } catch (error) {
          status.value = order.status;
          statusElement.textContent = error.message;
        } finally {
          status.disabled = false;
        }
      });
      row.append(makeCell(status));
      ordersBody.append(row);
    });

    ordersTable.hidden = orders.length === 0;
    statusElement.textContent = orders.length
      ? `عدد الطلبات والرسائل المعروضة: ${orders.length} (حتى آخر 300 سجل).`
      : 'لا توجد طلبات أو رسائل محفوظة حتى الآن.';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    authorization = encodeBasicCredentials(usernameInput.value.trim(), passwordInput.value);
    try {
      await loadOrders();
      passwordInput.value = '';
      refreshButton.hidden = false;
      catalogUploadPanel.hidden = false;
    } catch (error) {
      ordersTable.hidden = true;
      statusElement.textContent = error.message;
    }
  });

  catalogUploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = catalogUploadFile.files[0];
    if (!file) {
      catalogUploadStatus.textContent = 'اختر ملف Excel أولًا.';
      return;
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      catalogUploadStatus.textContent = 'يجب اختيار ملف بصيغة XLSX.';
      return;
    }

    const submitButton = catalogUploadForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    catalogUploadStatus.textContent = 'جارٍ التحقق من الملف وحفظ نسخة احتياطية وتطبيق الكتالوج...';
    const formData = new FormData();
    formData.append('catalog', file);
    try {
      const data = await apiRequest('/api/admin/catalog/upload', {
        method: 'POST',
        body: formData,
      });
      catalogUploadStatus.textContent =
        `${data.message} عدد الأصناف المتاحة الآن: ${data.productCount}. النسخة الاحتياطية: ${data.backupName}`;
      catalogUploadFile.value = '';
      await loadOrders();
    } catch (error) {
      catalogUploadStatus.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });

  refreshButton.addEventListener('click', async () => {
    refreshButton.disabled = true;
    try {
      await loadOrders();
    } catch (error) {
      statusElement.textContent = error.message;
    } finally {
      refreshButton.disabled = false;
    }
  });

});
