// Web-only release (owner request): no app-owned Android package/installer. The app is
// added to the home screen by the browser; installed launches run standalone.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, APP, readJSON, readText } from './helpers.js';

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}

const NATIVE_FILE = /\.(apk|aab|apks|xapk|ipa)$/i;
const NATIVE_REF = /\.apk\b|\.aab\b|\.ipa\b|play\.google\.com|market:\/\/|intent:\/\/|itms-services:|application\/vnd\.android\.package-archive|apps\.apple\.com/i;

describe('web-only: no app-provided native package or installer', () => {
  const files = walk(APP);
  const textFiles = files.filter((f) => /\.(html|js|json|css|webmanifest|htaccess)$/.test(f) || f.endsWith('.htaccess'));

  it('ships no APK/AAB/IPA files', () => {
    expect(files.filter((f) => NATIVE_FILE.test(f))).toEqual([]);
  });

  it('no source file links to an APK, app store, intent:// or package MIME type', () => {
    for (const f of textFiles) expect(fs.readFileSync(f, 'utf8'), path.relative(ROOT, f)).not.toMatch(NATIVE_REF);
  });

  it('no download links in the HTML', () => {
    expect(readText('index.html')).not.toMatch(/<a\b[^>]*\bdownload\b/i);
  });

  it('JS never creates download links or navigates to installers', () => {
    for (const f of files.filter((x) => x.endsWith('.js'))) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/\.download\s*=|setAttribute\(\s*['"]download['"]/);
      expect(src, f).not.toMatch(/window\.open\(/);
    }
  });

  it('manifest does not point to native apps', () => {
    const m = readJSON('manifest.webmanifest');
    expect(m.related_applications).toBeUndefined();
    expect(m.prefer_related_applications).toBe(false);
  });

  it('the release ZIP contains no native package', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-web-only-'));
    const zip = path.join(dir, 'r.zip');
    execFileSync('node', [path.join(ROOT, 'scripts/package.mjs'), zip], { cwd: ROOT });
    const names = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
    expect(names.filter((n) => NATIVE_FILE.test(n))).toEqual([]);
    expect(names).toContain('joshs-tacos/.htaccess');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('EN/ES install text describes a web app added by the browser, with no download', () => {
    const en = readJSON('i18n/en.json');
    const es = readJSON('i18n/es.json');
    expect(en['install.web']).toMatch(/web app/);
    expect(en['install.web']).toMatch(/no app store and no app file to download/);
    expect(es['install.web']).toMatch(/app web/);
    expect(es['install.web']).toMatch(/no hay tienda de apps ni archivo de app que descargar/);
    expect(en['install.heading']).toMatch(/home screen/);
    expect(es['install.heading']).toMatch(/pantalla de inicio/);
    // Truthful: no claims about WebAPKs, Play Protect, or store verification.
    for (const d of [en, es]) {
      expect(Object.values(d).join(' ')).not.toMatch(/webapk|play protect|google play|app store approved|verified by/i);
    }
  });
});

describe('app feel: standalone manifest, icons, splash inputs', () => {
  const m = readJSON('manifest.webmanifest');
  const pngSize = (rel) => {
    const b = fs.readFileSync(path.join(APP, rel));
    expect(b.subarray(1, 4).toString()).toBe('PNG');
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };

  it('installed launch is standalone (no browser address bar)', () => {
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('./');
    expect(m.scope).toBe('./');
    expect(readText('index.html')).toContain('<meta name="apple-mobile-web-app-capable" content="yes">');
  });

  it('has what browsers use to build the launch splash (name, colours, 512px icon)', () => {
    expect(m.name).toBe("Josh's Tacos");
    expect(m.short_name.length).toBeLessThanOrEqual(12);
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(readText('index.html')).toContain(`<meta name="theme-color" content="${m.theme_color}">`);
  });

  it('icons are real PNGs at their declared sizes, including maskable and apple-touch', () => {
    for (const icon of m.icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(icon.src), icon.src).toEqual([w, h]);
    }
    expect(m.icons.some((i) => i.purpose === 'any' && i.sizes === '192x192')).toBe(true);
    expect(m.icons.some((i) => i.purpose === 'any' && i.sizes === '512x512')).toBe(true);
    expect(m.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512')).toBe(true);
    expect(readText('index.html')).toContain('<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">');
    expect(pngSize('icons/apple-touch-icon.png')).toEqual([180, 180]);
  });
});
