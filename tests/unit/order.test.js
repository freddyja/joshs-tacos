import { describe, it, expect } from 'vitest';
import { readJSON, readText } from './helpers.js';
import { indexMenu, emptyCart, addSku, setAskMaria, setQty } from '../../app/js/cart.js';
import { createT } from '../../app/js/i18n.js';
import { buildOrderText, smsHref, telHref, isIOS, SELLER_PHONE } from '../../app/js/order.js';

const index = indexMenu(readJSON('menu.json'));
const en = createT(readJSON('i18n/en.json'));
const es = createT(readJSON('i18n/es.json'));

function sampleCart() {
  let c = emptyCart();
  c = addSku(c, 'combo-taco', index);
  c = addSku(c, 'empanada-2', index);
  return setAskMaria(c, true);
}

describe('order text', () => {
  it('matches the spec v005 English template exactly', () => {
    expect(buildOrderText(sampleCart(), index, en)).toBe(
      "Hi Josh's Tacos! Pickup order: 1× Taco Combo ($10.00); 1× 2 empanadas ($5.00). Estimated subtotal $15.00. Ask about Maria Special: yes. Name: ___. Please confirm price & pickup time."
    );
  });

  it('has the same structure in Spanish', () => {
    expect(buildOrderText(sampleCart(), index, es, { name: 'Ana' })).toBe(
      '¡Hola, Josh\'s Tacos! Pedido para recoger: 1× Combo de Tacos ($10.00); 1× 2 empanadas ($5.00). Subtotal estimado $15.00. Preguntar por el Especial de María: sí. Nombre: Ana. Por favor confirmen precio y hora de recogida.'
    );
  });

  it('uses line totals for quantities and says "estimated", never "total"/"accepted"', () => {
    const c = setQty(addSku(emptyCart(), 'taco-3', index), 'taco-3', 2);
    const text = buildOrderText(c, index, en, { name: '  Josh   Fan ' });
    expect(text).toContain('2× 3 tacos ($16.00)');
    expect(text).toContain('Estimated subtotal $16.00.');
    expect(text).toContain('Name: Josh Fan.');
    expect(text).not.toMatch(/accepted|final total|order confirmed/i);
    expect(text).not.toContain('Maria');
  });

  it('a Maria-only question has no prices', () => {
    const text = buildOrderText(setAskMaria(emptyCart(), true), index, en);
    expect(text).toBe("Hi Josh's Tacos! Ask about Maria Special: yes. Name: ___. Please confirm price & pickup time.");
  });
});

describe('links', () => {
  const body = 'Hi! 1× Taco Combo ($10.00); A&B #1 ?=x\nnew line';

  it('Android/others use ?body= with full encoding', () => {
    const href = smsHref(body);
    expect(href.startsWith(`sms:${SELLER_PHONE}?body=`)).toBe(true);
    expect(decodeURIComponent(href.split('?body=')[1])).toBe(body);
    expect(href).not.toMatch(/[ &#\n]/);
  });

  it('iOS uses &body=', () => {
    const href = smsHref(body, { ios: true });
    expect(href.startsWith('sms:+13526068731&body=')).toBe(true);
    expect(decodeURIComponent(href.split('&body=')[1])).toBe(body);
  });

  it('detects iOS, including iPadOS desktop mode', () => {
    expect(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
    expect(isIOS('Mozilla/5.0 (Linux; Android 14; Pixel 7)')).toBe(false);
  });

  it('tel link goes to the seller', () => {
    expect(telHref()).toBe('tel:+13526068731');
  });

  it('the app never auto-sends: no programmatic navigation to sms:', () => {
    const src = readText('js/app.js') + readText('js/order.js');
    expect(src).not.toMatch(/location(\.href)?\s*=\s*[^=]*sms/);
    expect(src).not.toMatch(/window\.open\([^)]*sms/);
    expect(src).not.toMatch(/\.click\(\)/);
  });
});
