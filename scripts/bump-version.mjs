// npm run bump -- 1.0.1   -> updates package.json, app/sw.js and app/js/version.js
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setAppVersion } from './version-lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];
setAppVersion(path.join(root, 'app'), version);
const pkgFile = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Version set to ${version} (cache jt-v${version})`);
