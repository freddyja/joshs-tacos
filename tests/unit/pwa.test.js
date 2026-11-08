import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { APP, ROOT, readJSON, readText } from './helpers.js';
import { APP_VERSION, CACHE_NAME } from '../../app/js/version.js';

describe('PWA config for /joshs-tacos/', () => {
  const manifest = readJSON('manifest.webmanifest');

  it('manifest uses relative start_url and scope', () => {
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.display).toBe('standalone');
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/')).toBe(false);
      expect(fs.existsSync(path.join(APP, icon.src)), icon.src).toBe(true);
    }
    expect(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
  });

  it('HTML has no root-absolute URLs', () => {
    const html = readText('index.html');
    expect(html).not.toMatch(/(href|src)="\//);
  });

  it('service worker precaches files that exist, only relative paths', () => {
    const sw = readText('sw.js');
    const assets = [...sw.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]);
    expect(assets.length).toBeGreaterThan(10);
    for (const a of assets) {
      const rel = a === './' ? 'index.html' : a.slice(2);
      expect(fs.existsSync(path.join(APP, rel)), a).toBe(true);
    }
    // every JS module is cached
    for (const f of fs.readdirSync(path.join(APP, 'js'))) expect(assets).toContain(`./js/${f}`);
  });

  it('versions agree (package.json, version.js, sw.js) and caches are jt- prefixed', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const sw = readText('sw.js');
    expect(pkg.version).toBe(APP_VERSION);
    expect(sw).toContain(`const VERSION = '${APP_VERSION}';`);
    expect(CACHE_NAME).toBe(`jt-v${APP_VERSION}`);
    expect(sw).toMatch(/k\.startsWith\(CACHE_PREFIX\)/);
    expect(sw).toContain('self.clients.claim()');
    expect(sw).toContain("data.type === 'SKIP_WAITING'");
  });

  it('commits no secrets', () => {
    const files = ['index.html', 'sw.js', ...fs.readdirSync(path.join(APP, 'js')).map((f) => `js/${f}`)];
    for (const f of files) expect(readText(f)).not.toMatch(/api[_-]?key|secret|password|token\s*[:=]/i);
  });
});

// WCAG 2.x contrast
function lum(hex) {
  const [r, g, b] = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('brand palette contrast (WCAG AA)', () => {
  const css = readText('styles.css');
  const v = (name) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))[1];
  const pairs = [
    ['cream', 'black', 4.5], ['gold', 'black', 4.5], ['cream-dim', 'black', 4.5],
    ['black', 'gold', 4.5], ['black', 'cream', 4.5], ['red-dark', 'cream', 4.5],
    ['ink', 'cream', 4.5], ['cream', 'red', 4.5], ['red', 'black', 3], // red on black only for large display text
  ];
  for (const [fg, bg, min] of pairs) {
    it(`${fg} on ${bg} >= ${min}:1`, () => {
      expect(ratio(v(fg), v(bg))).toBeGreaterThanOrEqual(min);
    });
  }
  it('white on red buttons >= 4.5:1', () => expect(ratio('#ffffff', v('red'))).toBeGreaterThanOrEqual(4.5));
  it('cream panel/cream-dim on panel', () => expect(ratio(v('cream-dim'), v('panel'))).toBeGreaterThanOrEqual(4.5));
});
