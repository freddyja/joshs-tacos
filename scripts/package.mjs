// npm run package [-- <output.zip>]
// Builds a static ZIP whose top folder is joshs-tacos/ (upload it to
// computingmadeeasy.org so the app lives at /joshs-tacos/). It includes
// app/.htaccess, which serves .webmanifest as application/manifest+json.
// Default output: dist/joshs-tacos-v<version>.zip
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const out = path.resolve(root, process.argv[2] || `dist/joshs-tacos-v${version}.zip`);

const stageRoot = path.join(root, 'dist', '.stage');
const stage = path.join(stageRoot, 'joshs-tacos');
fs.rmSync(stageRoot, { recursive: true, force: true });
fs.mkdirSync(stageRoot, { recursive: true });
fs.cpSync(path.join(root, 'app'), stage, { recursive: true });
if (!fs.existsSync(path.join(stage, '.htaccess'))) throw new Error('app/.htaccess is missing');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });
// -X: no extra file attributes, -D: no directory entries -> stable, minimal archive
execFileSync('zip', ['-rqXD', out, 'joshs-tacos'], { cwd: stageRoot });
fs.rmSync(stageRoot, { recursive: true, force: true });
console.log(path.relative(root, out));
