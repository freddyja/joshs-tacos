import { describe, it, expect } from 'vitest';
import { readJSON, memoryStorage } from './helpers.js';
import {
  indexMenu, emptyCart, addSku, setQty, setAskMaria, subtotalCents, lineTotalCents,
  itemCount, isCartEmpty, formatCents, sanitizeCart, loadCart, saveCart, CART_KEY, MAX_QTY,
} from '../../app/js/cart.js';

const index = indexMenu(readJSON('menu.json'));

describe('pricing', () => {
  it('formats integer cents', () => {
    expect(formatCents(0)).toBe('$0.00');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(1500)).toBe('$15.00');
    expect(formatCents(123456)).toBe('$1234.56');
    expect(() => formatCents(1.5)).toThrow();
  });

  it('adds pack prices exactly', () => {
    let c = emptyCart();
    c = addSku(c, 'combo-taco', index);
    c = addSku(c, 'empanada-2', index);
    expect(subtotalCents(c, index)).toBe(1500);
  });

  it('line totals are qty x pack price', () => {
    expect(lineTotalCents({ sku: 'taco-3', qty: 3 }, index)).toBe(2400);
  });

  it('has no float drift across many small items', () => {
    let c = emptyCart();
    c = setQty(addSku(c, 'chips', index), 'chips', 99);
    c = setQty(addSku(c, 'tea', index), 'tea', 99);
    expect(subtotalCents(c, index)).toBe(99 * 100 + 99 * 200);
    expect(formatCents(subtotalCents(c, index))).toBe('$297.00');
  });
});

describe('cart', () => {
  it('adds each pack as its own line and merges repeats', () => {
    let c = emptyCart();
    c = addSku(c, 'taco-1', index);
    c = addSku(c, 'taco-1', index);
    c = addSku(c, 'taco-3', index);
    expect(c.lines).toEqual([{ sku: 'taco-1', qty: 2 }, { sku: 'taco-3', qty: 1 }]);
    expect(itemCount(c)).toBe(3);
  });

  it('never re-bundles (3 single tacos stay 3 x $3 = $9, not $8)', () => {
    let c = emptyCart();
    c = setQty(addSku(c, 'taco-1', index), 'taco-1', 3);
    expect(c.lines).toEqual([{ sku: 'taco-1', qty: 3 }]);
    expect(subtotalCents(c, index)).toBe(900);
  });

  it('qty +/- and removal at zero', () => {
    let c = addSku(emptyCart(), 'rice', index);
    c = setQty(c, 'rice', 4);
    expect(c.lines[0].qty).toBe(4);
    c = setQty(c, 'rice', 0);
    expect(c.lines).toEqual([]);
  });

  it('caps quantity', () => {
    const c = setQty(addSku(emptyCart(), 'rice', index), 'rice', 1000);
    expect(c.lines[0].qty).toBe(MAX_QTY);
  });

  it('is immutable', () => {
    const a = emptyCart();
    const b = addSku(a, 'rice', index);
    expect(a.lines).toEqual([]);
    expect(b).not.toBe(a);
  });

  it('refuses Maria Special and unknown items as priced lines', () => {
    expect(() => addSku(emptyCart(), 'maria', index)).toThrow();
    expect(() => addSku(emptyCart(), 'nope', index)).toThrow();
  });

  it('Maria question adds no money', () => {
    const c = setAskMaria(addSku(emptyCart(), 'rice', index), true);
    expect(c.askMaria).toBe(true);
    expect(subtotalCents(c, index)).toBe(300);
    expect(isCartEmpty(setAskMaria(emptyCart(), true))).toBe(false);
    expect(isCartEmpty(emptyCart())).toBe(true);
  });

  it('survives a reload via localStorage', () => {
    const store = memoryStorage();
    let c = addSku(emptyCart(), 'combo-full', index);
    c = setAskMaria(setQty(c, 'combo-full', 2), true);
    expect(saveCart(store, c)).toBe(true);
    expect(loadCart(store, index)).toEqual(c);
  });

  it('sanitizes bad stored data', () => {
    expect(sanitizeCart(null, index)).toEqual(emptyCart());
    const c = sanitizeCart({ lines: [{ sku: 'maria', qty: 1 }, { sku: 'rice', qty: -2 }, { sku: 'tea', qty: '2' }, { sku: 'tea', qty: 5 }], askMaria: 'yes' }, index);
    expect(c).toEqual({ lines: [{ sku: 'tea', qty: 2 }], askMaria: false });
    const store = memoryStorage({ [CART_KEY]: '{not json' });
    expect(loadCart(store, index)).toEqual(emptyCart());
  });

  it('saveCart reports storage failure', () => {
    const broken = { setItem() { throw new Error('quota'); } };
    expect(saveCart(broken, emptyCart())).toBe(false);
  });
});
