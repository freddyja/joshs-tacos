// Cart model. All money is integer cents. Each pack (e.g. "3 tacos $8") is its own
// line; there is no automatic re-bundling or price optimisation.

export const CART_KEY = 'jt-cart-v1';
export const MAX_QTY = 99;

/** Build a lookup of every orderable SKU from menu.json. Inquiry-only items have no SKUs. */
export function indexMenu(menu) {
  const index = new Map();
  for (const cat of menu.categories) {
    for (const item of cat.items) {
      if (item.inquiryOnly) continue;
      for (const pack of item.packs) {
        if (!Number.isInteger(pack.priceCents) || pack.priceCents < 0) {
          throw new Error(`Invalid price for ${pack.sku}`);
        }
        index.set(pack.sku, { ...pack, itemId: item.id, categoryId: cat.id });
      }
    }
  }
  return index;
}

export function emptyCart() {
  return { lines: [], askMaria: false };
}

export function addSku(cart, sku, index) {
  if (!index.has(sku)) throw new Error(`Unknown or non-orderable item: ${sku}`);
  const existing = cart.lines.find((l) => l.sku === sku);
  if (existing) return setQty(cart, sku, existing.qty + 1);
  return { ...cart, lines: [...cart.lines, { sku, qty: 1 }] };
}

export function setQty(cart, sku, qty) {
  const n = Math.min(MAX_QTY, Math.trunc(Number(qty)) || 0);
  if (n <= 0) return { ...cart, lines: cart.lines.filter((l) => l.sku !== sku) };
  return { ...cart, lines: cart.lines.map((l) => (l.sku === sku ? { ...l, qty: n } : l)) };
}

export function setAskMaria(cart, value) {
  return { ...cart, askMaria: Boolean(value) };
}

export function lineTotalCents(line, index) {
  return index.get(line.sku).priceCents * line.qty;
}

export function subtotalCents(cart, index) {
  return cart.lines.reduce((sum, l) => sum + lineTotalCents(l, index), 0);
}

export function itemCount(cart) {
  return cart.lines.reduce((sum, l) => sum + l.qty, 0);
}

export function isCartEmpty(cart) {
  return cart.lines.length === 0 && !cart.askMaria;
}

/** "$15.00" from 1500, using integer math only. */
export function formatCents(cents) {
  if (!Number.isInteger(cents)) throw new Error('Cents must be an integer');
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Drop unknown SKUs / bad quantities from untrusted (stored) data. */
export function sanitizeCart(raw, index) {
  const cart = emptyCart();
  if (!raw || typeof raw !== 'object') return cart;
  cart.askMaria = raw.askMaria === true;
  if (Array.isArray(raw.lines)) {
    for (const l of raw.lines) {
      if (!l || !index.has(l.sku)) continue;
      const qty = Math.min(MAX_QTY, Math.trunc(Number(l.qty)));
      if (!(qty > 0) || cart.lines.some((x) => x.sku === l.sku)) continue;
      cart.lines.push({ sku: l.sku, qty });
    }
  }
  return cart;
}

export function loadCart(storage, index) {
  try {
    return sanitizeCart(JSON.parse(storage.getItem(CART_KEY) || 'null'), index);
  } catch {
    return emptyCart();
  }
}

export function saveCart(storage, cart) {
  try {
    storage.setItem(CART_KEY, JSON.stringify({ lines: cart.lines, askMaria: cart.askMaria }));
    return true;
  } catch {
    return false;
  }
}
