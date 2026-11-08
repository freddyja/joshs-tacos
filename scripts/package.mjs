// npm run package -> dist/joshs-tacos-v<version>.zip containing a joshs-tacos/ folder
// ready to upload to computingmadeeasy.org/joshs-tacos/.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dist = path.join(root, 'dist');
const stage = path.join(dist, 'joshs-tacos');
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.cpSync(path.join(root, 'app'), stage, { recursive: true });
const zip = `joshs-tacos-v${version}.zip`;
fs.rmSync(path.join(dist, zip), { force: true });
execFileSync('zip', ['-rq', zip, 'joshs-tacos'], { cwd: dist });
console.log(`dist/${zip}`);
