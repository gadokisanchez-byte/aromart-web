// AromArt Shop — Admin conectado a Supabase

const db = window.aromartDb || window.supabaseClient;
let cloudReady = false;


// ======================================================
// SESIÓN ADMIN
// ======================================================

async function requireAdmin() {
  if (!db) {
    throw new Error('No se pudo iniciar la conexión con Supabase.');
  }

  const { data, error } = await db.auth.getSession();

  if (error) throw error;

  if (!data.session) {
    location.href = 'login.html';
    throw new Error('Sesión requerida');
  }
}


// ======================================================
// CREAR PRODUCTOS INICIALES SI SUPABASE ESTÁ VACÍO
// ======================================================

async function seedProductsIfEmpty() {
  const { count, error } = await db
    .from('products')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;

  if ((count || 0) > 0) return;

  const base = [
    ...(window.STOCK || []),
    ...(window.UPCOMING || [])
  ];

  if (!base.length) return;

  const rows = base.map((p, index) => ({
    id: idOf(p.name),
    name: p.name,
    sku: p.sku || null,
    category: p.cat || 'Perfumes',
    description: p.desc || '',
    image_url: p.img || '',
    price: Number(p.price || 0),
    cost: 0,
    stock: p.upcoming ? 0 : 1,
    status: p.upcoming ? 'proximamente' : 'disponible',
    is_custom: false,
    sort_order: index,
    updated_at: new Date().toISOString()
  }));

  const { error: insertError } = await db
    .from('products')
    .insert(rows);

  if (insertError) throw insertError;
}


// ======================================================
// CARGAR DATOS DESDE SUPABASE
// ======================================================

async function cloudLoad() {
  await requireAdmin();
  await seedProductsIfEmpty();

  const [pr, sr, cr, nr] = await Promise.all([
    db
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true }),

    db
      .from('sales')
      .select('*')
      .order('sold_on', { ascending: false })
      .limit(500),

    db
      .from('coupons')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1),

    db
      .from('notices')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
  ]);

  if (pr.error) throw pr.error;
  if (sr.error) throw sr.error;
  if (cr.error) throw cr.error;
  if (nr.error) throw nr.error;

  customProducts = (pr.data || []).map(x => ({
    name: x.name,
    img: x.image_url,
    price: Number(x.price || 0),
    upcoming: x.status === 'proximamente',
    desc: x.description || '',
    cat: x.category || 'Perfumes',
    sku: x.sku || '',
    custom: !!x.is_custom,
    _cloud: true
  }));

  inv = {};

  (pr.data || []).forEach(x => {
    inv[x.id] = {
      qty: Number(x.stock || 0),
      cost: Number(x.cost || 0),
      price: Number(x.price || 0),
      status: x.status || 'disponible',
      sku: x.sku || ''
    };
  });

  sales = (sr.data || []).map(x => ({
    id: x.id,
    productId: x.product_id,
    name: x.product_name,
    qty: Number(x.qty || 0),
    price: Number(x.unit_price || 0),
    cost: Number(x.unit_cost || 0),
    date: x.sold_on
  }));

  window._cloudCoupon = cr.data?.[0] || null;
  window._cloudNotice = nr.data?.[0] || null;

  cloudReady = true;
}


// ======================================================
// USAR PRODUCTOS DE SUPABASE
// ======================================================

allBase = () => customProducts;

// Evitamos que el sistema antiguo guarde otra copia local.
persist = function () {};
persistCustom = function () {};
persistSales = function () {};


// ======================================================
// INVENTARIO
// ======================================================

setField = async function (id, fieldName, value) {
  try {
    const fields = {
      qty: 'stock',
      cost: 'cost',
      price: 'price',
      status: 'status'
    };

    const field = fields[fieldName];

    if (!field) return;

    const val =
      fieldName === 'status'
        ? value
        : Number(value || 0);

    const patch = {
      [field]: val,
      updated_at: new Date().toISOString()
    };

    if (
      fieldName === 'qty' &&
      val <= 0 &&
      inv[id]?.status === 'disponible'
    ) {
      patch.status = 'agotado';
    }

    const { error } = await db
      .from('products')
      .update(patch)
      .eq('id', id);

    if (error) throw error;

    if (!inv[id]) inv[id] = {};

    inv[id][fieldName] = val;

    if (patch.status) {
      inv[id].status = patch.status;
    }

    renderInventory();
  } catch (error) {
    console.error('Inventory update:', error);
    alert(
      'No se pudo actualizar el producto: ' +
      (error.message || error)
    );
  }
};


// ======================================================
// REGISTRAR VENTA
// ======================================================

addSale = async function (id, qty, price, date) {
  try {
    const product = allBase().find(
      p => idOf(p.name) === id
    );

    if (!product) return;

    const item = inv[id];

    if (!item) return;

    const quantity = Math.max(
      1,
      Number(qty || 1)
    );

    const salePrice = Number(price || 0);
    const saleCost = Number(item.cost || 0);

    const saleRow = {
      product_id: id,
      product_name: product.name,
      qty: quantity,
      unit_price: salePrice,
      unit_cost: saleCost,
      sold_on:
        date ||
        new Date().toISOString().slice(0, 10)
    };

    const { data, error } = await db
      .from('sales')
      .insert(saleRow)
      .select()
      .single();

    if (error) throw error;

    const newStock = Math.max(
      0,
      Number(item.qty || 0) - quantity
    );

    const productPatch = {
      stock: newStock,
      updated_at: new Date().toISOString()
    };

    if (
      newStock === 0 &&
      item.status === 'disponible'
    ) {
      productPatch.status = 'agotado';
    }

    const { error: stockError } = await db
      .from('products')
      .update(productPatch)
      .eq('id', id);

    if (stockError) throw stockError;

    item.qty = newStock;

    if (productPatch.status) {
      item.status = productPatch.status;
    }

    sales.unshift({
      id: data.id,
      productId: id,
      name: product.name,
      qty: quantity,
      price: salePrice,
      cost: saleCost,
      date: saleRow.sold_on
    });

    renderInventory();
    renderSales();

    showCloudMessage(
      '✓ Venta registrada correctamente.'
    );
  } catch (error) {
    console.error('Sale:', error);

    showCloudMessage(
      'No se pudo registrar la venta: ' +
      (error.message || String(error)),
      false
    );
  }
};


quickSale = async function (id) {
  await addSale(
    id,
    1,
    inv[id]?.price || 0,
    new Date().toISOString().slice(0, 10)
  );
};


// ======================================================
// ELIMINAR HISTORIAL DE VENTAS
// ======================================================

clearSales = async function () {
  if (
    !confirm(
      '¿Borrar todo el historial de ventas? Esta acción no se puede deshacer.'
    )
  ) {
    return;
  }

  try {
    const ids = sales
      .map(x => x.id)
      .filter(Boolean);

    if (ids.length) {
      const { error } = await db
        .from('sales')
        .delete()
        .in('id', ids);

      if (error) throw error;
    }

    sales = [];

    renderSales();

    showCloudMessage(
      '✓ Historial de ventas eliminado.'
    );
  } catch (error) {
    console.error(error);

    showCloudMessage(
      'No se pudo borrar el historial: ' +
      (error.message || String(error)),
      false
    );
  }
};


// ======================================================
// ELEMENTOS DE CUPÓN Y AVISO
// ======================================================

function promoEls() {
  return {
    couponForm:
      document.getElementById('couponForm'),

    couponActive:
      document.getElementById('couponActive'),

    couponCode:
      document.getElementById('couponCode'),

    couponPercent:
      document.getElementById('couponPercent'),

    couponMinQty:
      document.getElementById('couponMinQty'),

    couponStart:
      document.getElementById('couponStart'),

    couponEnd:
      document.getElementById('couponEnd'),

    couponStatus:
      document.getElementById('couponStatus'),

    noticeForm:
      document.getElementById('noticeForm'),

    noticeActive:
      document.getElementById('noticeActive'),

    noticeTitle:
      document.getElementById('noticeTitle'),

    noticeText:
      document.getElementById('noticeText'),

    noticeStart:
      document.getElementById('noticeStart'),

    noticeEnd:
      document.getElementById('noticeEnd'),

    noticeStatus:
      document.getElementById('noticeStatus'),

    noticePreview:
      document.getElementById('noticePreview')
  };
}


// ======================================================
// ESTADO DE PROMOCIONES
// ======================================================

function promoState(p) {
  const today =
    new Date().toISOString().slice(0, 10);

  if (!p || !p.active) {
    return ['INACTIVO', 'off'];
  }

  if (p.start && today < p.start) {
    return ['PROGRAMADO', 'scheduled'];
  }

  if (p.end && today > p.end) {
    return ['FINALIZADO', 'expired'];
  }

  return ['ACTIVO', 'active'];
}


// ======================================================
// RELLENAR CUPÓN / AVISO
// ======================================================

function fillCloudPromos() {
  const e = promoEls();

  const c = window._cloudCoupon;
  const n = window._cloudNotice;

  if (c && e.couponForm) {
    if (e.couponActive) {
      e.couponActive.checked = !!c.active;
    }

    if (e.couponCode) {
      e.couponCode.value = c.code || '';
    }

    if (e.couponPercent) {
      e.couponPercent.value =
        c.percent || 10;
    }

    if (e.couponMinQty) {
      e.couponMinQty.value =
        c.min_qty || 1;
    }

    if (e.couponStart) {
      e.couponStart.value =
        c.starts_on || '';
    }

    if (e.couponEnd) {
      e.couponEnd.value =
        c.ends_on || '';
    }
  }

  if (n && e.noticeForm) {
    if (e.noticeActive) {
      e.noticeActive.checked = !!n.active;
    }

    if (e.noticeTitle) {
      e.noticeTitle.value =
        n.title || '';
    }

    if (e.noticeText) {
      e.noticeText.value =
        n.message || '';
    }

    if (e.noticeStart) {
      e.noticeStart.value =
        n.starts_on || '';
    }

    if (e.noticeEnd) {
      e.noticeEnd.value =
        n.ends_on || '';
    }
  }

  paintCloudStatus();
}


// ======================================================
// MOSTRAR ESTADO CUPÓN / AVISO
// ======================================================

function paintCloudStatus() {
  const e = promoEls();

  const cc = window._cloudCoupon;
  const nn = window._cloudNotice;

  const c = cc
    ? {
        active: cc.active,
        code: cc.code,
        minQty: cc.min_qty,
        start: cc.starts_on,
        end: cc.ends_on
      }
    : {
        active: false
      };

  const n = nn
    ? {
        active: nn.active,
        title: nn.title,
        text: nn.message,
        start: nn.starts_on,
        end: nn.ends_on
      }
    : {
        active: false
      };

  const cs = promoState(c);
  const ns = promoState(n);

  if (e.couponStatus) {
    e.couponStatus.className =
      'promo-status ' + cs[1];

    e.couponStatus.textContent =
      'Estado del cupón: ' +
      cs[0] +
      (c.code ? ' · ' + c.code : '') +
      (c.minQty
        ? ' · mínimo ' + c.minQty
        : '') +
      ' · NUBE';
  }

  if (e.noticeStatus) {
    e.noticeStatus.className =
      'promo-status ' + ns[1];

    e.noticeStatus.textContent =
      'Estado del aviso: ' +
      ns[0] +
      ' · NUBE';
  }

  if (e.noticePreview) {
    e.noticePreview.innerHTML =
      n.title || n.text
        ? `<b>${n.title || 'AromArt Shop'}</b>
           <span>${n.text || ''}</span>`
        : '<span>La vista previa aparecerá aquí.</span>';
  }
}


// ======================================================
// MENSAJE ABAJO A LA DERECHA
// ======================================================

function showCloudMessage(message, ok = true) {
  let box =
    document.getElementById(
      'cloudSaveMessage'
    );

  if (!box) {
    box = document.createElement('div');

    box.id = 'cloudSaveMessage';

    box.style.cssText = `
      position:fixed;
      right:18px;
      bottom:18px;
      z-index:99999;
      padding:14px 18px;
      border-radius:12px;
      background:#111;
      color:#fff;
      border:1px solid #c9a227;
      max-width:380px;
      font:600 14px system-ui;
      box-shadow:0 10px 35px rgba(0,0,0,.35);
    `;

    document.body.appendChild(box);
  }

  box.textContent = message;

  box.style.borderColor =
    ok ? '#c9a227' : '#e35d6a';

  clearTimeout(
    window._cloudMsgTimer
  );

  window._cloudMsgTimer =
    setTimeout(() => {
      box.remove();
    }, 5000);
}


// ======================================================
// GUARDAR CUPÓN Y AVISO
// ======================================================

function setupCloudPromos() {
  const old = promoEls();

  if (
    !old.couponForm ||
    !old.noticeForm
  ) {
    return;
  }

  // Quitamos eventos antiguos.
  const cf =
    old.couponForm.cloneNode(true);

  const nf =
    old.noticeForm.cloneNode(true);

  old.couponForm.replaceWith(cf);
  old.noticeForm.replaceWith(nf);

  fillCloudPromos();


  // -----------------------------
  // CUPÓN
  // -----------------------------

  document
    .getElementById('couponForm')
    .addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        const e = promoEls();

        const code =
          e.couponCode
            ?.value
            .trim()
            .toUpperCase();

        if (!code) {
          showCloudMessage(
            'Escribe un código de descuento.',
            false
          );

          return;
        }

        const row = {
          code,

          percent: Math.min(
            100,
            Math.max(
              1,
              Number(
                e.couponPercent?.value || 1
              )
            )
          ),

          min_qty: Math.max(
            1,
            Math.floor(
              Number(
                e.couponMinQty?.value || 1
              )
            )
          ),

          starts_on:
            e.couponStart?.value ||
            null,

          ends_on:
            e.couponEnd?.value ||
            null,

          active:
            !!e.couponActive?.checked,

          updated_at:
            new Date().toISOString()
        };

        try {
          const current =
            window._cloudCoupon;

          let result;

          if (current?.id) {
            result = await db
              .from('coupons')
              .update(row)
              .eq('id', current.id)
              .select()
              .single();
          } else {
            result = await db
              .from('coupons')
              .insert(row)
              .select()
              .single();
          }

          if (result.error) {
            throw result.error;
          }

          window._cloudCoupon =
            result.data;

          fillCloudPromos();

          showCloudMessage(
            '✓ Cupón guardado en Supabase y publicado.'
          );
        } catch (error) {
          console.error(
            'Coupon save:',
            error
          );

          showCloudMessage(
            'No se guardó el cupón: ' +
            (
              error.message ||
              String(error)
            ),
            false
          );
        }
      }
    );


  // -----------------------------
  // AVISO
  // -----------------------------

  document
    .getElementById('noticeForm')
    .addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        const e = promoEls();

        const row = {
          title:
            e.noticeTitle
              ?.value
              .trim() || '',

          message:
            e.noticeText
              ?.value
              .trim() || '',

          starts_on:
            e.noticeStart?.value ||
            null,

          ends_on:
            e.noticeEnd?.value ||
            null,

          active:
            !!e.noticeActive?.checked,

          updated_at:
            new Date().toISOString()
        };

        try {
          const current =
            window._cloudNotice;

          let result;

          if (current?.id) {
            result = await db
              .from('notices')
              .update(row)
              .eq('id', current.id)
              .select()
              .single();
          } else {
            result = await db
              .from('notices')
              .insert(row)
              .select()
              .single();
          }

          if (result.error) {
            throw result.error;
          }

          window._cloudNotice =
            result.data;

          fillCloudPromos();

          showCloudMessage(
            '✓ Aviso guardado en Supabase y publicado.'
          );
        } catch (error) {
          console.error(
            'Notice save:',
            error
          );

          showCloudMessage(
            'No se guardó el aviso: ' +
            (
              error.message ||
              String(error)
            ),
            false
          );
        }
      }
    );
}


// ======================================================
// INICIAR PANEL
// ======================================================

document.addEventListener(
  'DOMContentLoaded',
  async () => {
    if (
      !document.querySelector(
        '.panel-body'
      )
    ) {
      return;
    }

    try {
      await cloudLoad();

      renderInventory();
      renderSales();

      if (
        typeof setupCloudProductManager ===
        'function'
      ) {
        setupCloudProductManager();
      } else if (
        typeof setupProductManager ===
        'function'
      ) {
        setupProductManager();
      }

      setupCloudPromos();

      console.log(
        'AromArt Admin conectado a Supabase ✓'
      );
    } catch (error) {
      console.error(
        'AromArt Admin:',
        error
      );

      alert(
        'No se pudo iniciar el panel conectado a Supabase.\n\nDetalle: ' +
        (
          error.message ||
          String(error)
        )
      );
    }
  }
);
