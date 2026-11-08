import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, APP, readText } from './helpers.js';

describe('static release ZIP', () => {
  it('app/.htaccess serves the manifest with the right MIME type', () => {
    expect(readText('.htaccess')).toContain('AddType application/manifest+json .webmanifest');
  });

  it('packages everything under a top-level joshs-tacos/ folder, .htaccess included', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jt-zip-'));
    const zip = path.join(dir, 'test.zip');
    execFileSync('node', [path.join(ROOT, 'scripts/package.mjs'), zip], { cwd: ROOT });
    const names = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
    expect(names.every((n) => n.startsWith('joshs-tacos/'))).toBe(true);
    for (const f of ['.htaccess', 'index.html', 'sw.js', 'manifest.webmanifest', 'menu.json', 'i18n/en.json', 'i18n/es.json', 'js/app.js', 'icons/icon-512.png']) {
      expect(names, f).toContain(`joshs-tacos/${f}`);
    }
    const appFiles = execFileSync('git', ['ls-files', '--others', '--cached', '--exclude-standard', 'app'], { cwd: ROOT, encoding: 'utf8' })
      .trim().split('\n').map((f) => f.replace(/^app\//, 'joshs-tacos/'));
    expect(names.sort()).toEqual(appFiles.sort());
    fs.rmSync(dir, { recursive: true, force: true });
  });

});
