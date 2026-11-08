import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { APP, readJSON, readText, memoryStorage } from './helpers.js';
import { LANGS, detectLang, getSavedLang, saveLang, createT, LANG_KEY } from '../../app/js/i18n.js';
import { indexMenu } from '../../app/js/cart.js';

const en = readJSON('i18n/en.json');
const es = readJSON('i18n/es.json');
const menu = readJSON('menu.json');

describe('i18n completeness', () => {
  it('only English and Spanish exist', () => {
    expect(LANGS).toEqual(['en', 'es']);
    expect(fs.readdirSync(path.join(APP, 'i18n')).sort()).toEqual(['en.json', 'es.json']);
  });

  it('EN and ES have identical key sets with no empty values', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
    for (const d of [en, es]) for (const [k, v] of Object.entries(d)) expect(v.trim(), k).not.toBe('');
  });

  it('placeholders match between languages', () => {
    const ph = (s) => (s.match(/\{\w+\}/g) || []).sort();
    for (const k of Object.keys(en)) expect(ph(es[k]), k).toEqual(ph(en[k]));
  });

  it('every menu category, item, SKU and combo description is translated', () => {
    const needed = [];
    for (const c of menu.categories) {
      needed.push(`cat.${c.id}`);
      for (const i of c.items) {
        needed.push(`item.${i.id}`);
        if (c.id === 'combos') needed.push(`desc.${i.id}`);
      }
    }
    for (const sku of indexMenu(menu).keys()) needed.push(`sku.${sku}`);
    for (const k of needed) {
      expect(en, k).toHaveProperty([k]);
      expect(es, k).toHaveProperty([k]);
    }
  });

  it('every key used in the HTML and JS exists', () => {
    const html = readText('index.html');
    const used = new Set([...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((m) => m[1]));
    for (const f of fs.readdirSync(path.join(APP, 'js'))) {
      const src = readText(`js/${f}`);
      for (const m of src.matchAll(/\bt\('([a-z][\w.-]*)'/g)) used.add(m[1]);
    }
    // update status keys are built dynamically: update.<status>
    for (const s of ['checking', 'current', 'updating', 'deferred', 'error', 'unsupported']) used.add(`update.${s}`);
    expect(used.size).toBeGreaterThan(40);
    for (const k of used) {
      expect(en, k).toHaveProperty([k]);
      expect(es, k).toHaveProperty([k]);
    }
  });

  it('spec v005 sample strings are used verbatim', () => {
    const samples = {
      'order.cta': ['Text my order', 'Enviar pedido por mensaje'],
      'cart.subtotal': ['Estimated subtotal', 'Subtotal estimado'],
      'cart.note': ['Seller confirms price, pickup time & availability', 'El vendedor confirma precio, hora de recogida y disponibilidad'],
      share: ['Share', 'Compartir'],
      install: ['Install app', 'Instalar app'],
      update: ['Check for updates', 'Buscar actualizaciones'],
      maria: ['Ask about the Maria Special', 'Preguntar por el Especial de María'],
      pickup: ['Pickup only', 'Solo para recoger'],
      offline: ['Offline — prices may be out of date. Confirm with the seller.', 'Sin conexión — los precios pueden no estar actualizados. Confirma con el vendedor.'],
    };
    for (const [k, [e, s]] of Object.entries(samples)) {
      expect(en[k]).toBe(e);
      expect(es[k]).toBe(s);
    }
  });

  it('never claims an order is accepted', () => {
    for (const d of [en, es]) {
      const all = Object.values(d).join(' ').toLowerCase();
      expect(all).not.toMatch(/order accepted|pedido aceptado|order confirmed|pedido confirmado/);
    }
  });

  it('contains no Portuguese', () => {
    const all = Object.values(es).join(' ');
    expect(all).not.toMatch(/\b(obrigad|você|pedido feito|não|ção\b)/i);
  });
});

describe('language toggle', () => {
  it('detects Spanish from the browser, defaults to English', () => {
    expect(detectLang(['es-MX', 'en'])).toBe('es');
    expect(detectLang(['en-US'])).toBe('en');
    expect(detectLang(['pt-BR', 'fr'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });

  it('persists the choice', () => {
    const s = memoryStorage();
    expect(getSavedLang(s)).toBe(null);
    saveLang(s, 'es');
    expect(s.getItem(LANG_KEY)).toBe('es');
    expect(getSavedLang(s)).toBe('es');
    expect(() => saveLang(s, 'pt')).toThrow();
    expect(getSavedLang(memoryStorage({ [LANG_KEY]: 'pt' }))).toBe(null);
  });

  it('interpolates variables', () => {
    const t = createT({ a: 'Hi {name}, {name}!' });
    expect(t('a', { name: 'Jo' })).toBe('Hi Jo, Jo!');
    expect(t('missing')).toBe('missing');
  });
});
