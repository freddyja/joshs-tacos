import { describe, it, expect } from 'vitest';
import { readJSON } from './helpers.js';
import { indexMenu } from '../../app/js/cart.js';

const menu = readJSON('menu.json');
const index = indexMenu(menu);

// Transcribed from docs/joshs-tacos-menu-reference-v001.jpg and spec v005 section 2.
const POSTER = {
  'taco-1': 300, 'taco-3': 800, 'taco-5': 1200,
  'empanada-1': 300, 'empanada-2': 500, 'empanada-3': 700,
  rice: 300, beans: 300, chips: 100, cornbread: 100, tea: 200,
  'combo-taco': 1000, 'combo-big': 1300, 'combo-sides': 1200, 'combo-full': 1500,
};

describe('menu.json', () => {
  it('has a version and an updated date', () => {
    expect(menu.version).toMatch(/\S/);
    expect(menu.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches the poster prices exactly (integer cents)', () => {
    const actual = Object.fromEntries([...index].map(([sku, p]) => [sku, p.priceCents]));
    expect(actual).toEqual(POSTER);
    for (const cents of Object.values(actual)) expect(Number.isInteger(cents)).toBe(true);
  });

  it('pack counts match the SKU labels', () => {
    expect(index.get('taco-5').count).toBe(5);
    expect(index.get('empanada-2').count).toBe(2);
  });

  it('combos include what the poster says', () => {
    const combos = Object.fromEntries(
      menu.categories.find((c) => c.id === 'combos').items.map((i) => [i.id, i.includes])
    );
    expect(combos).toEqual({
      'combo-taco': ['taco-3', 'rice', 'tea'],
      'combo-big': ['taco-5', 'rice', 'tea'],
      'combo-sides': ['taco-3', 'rice', 'beans', 'chips', 'tea'],
      'combo-full': ['taco-5', 'rice', 'beans', 'chips', 'tea'],
    });
  });

  it('Maria Special is inquiry-only and never priced', () => {
    const maria = menu.categories.flatMap((c) => c.items).find((i) => i.id === 'maria');
    expect(maria.inquiryOnly).toBe(true);
    expect(maria.packs).toEqual([]);
    expect([...index.keys()].some((k) => k.includes('maria'))).toBe(false);
  });

  it('does not invent hours, address, tax, minimums, delivery or payment providers', () => {
    const raw = JSON.stringify(menu).toLowerCase();
    for (const word of ['hours', 'address', 'tax', 'minimum', 'delivery', 'paypal', 'venmo', 'cashapp', 'zelle']) {
      expect(raw).not.toContain(word);
    }
  });
});
