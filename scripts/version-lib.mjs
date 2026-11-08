import fs from 'node:fs';
import path from 'node:path';

const SEMVER = /^\d+\.\d+\.\d+$/;

/** Rewrites the version in <appDir>/sw.js and <appDir>/js/version.js. */
export function setAppVersion(appDir, version) {
  if (!SEMVER.test(version)) throw new Error(`Not a semver x.y.z: ${version}`);
  const edits = [
    ['sw.js', /const VERSION = '[^']*';/, `const VERSION = '${version}';`],
    ['js/version.js', /export const APP_VERSION = '[^']*';/, `export const APP_VERSION = '${version}';`],
  ];
  for (const [rel, re, repl] of edits) {
    const file = path.join(appDir, rel);
    const src = fs.readFileSync(file, 'utf8');
    if (!re.test(src)) throw new Error(`Version marker not found in ${rel}`);
    fs.writeFileSync(file, src.replace(re, repl));
  }
}
