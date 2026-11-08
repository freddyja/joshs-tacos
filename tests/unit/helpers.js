import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const APP = path.join(ROOT, 'app');
export const readJSON = (rel) => JSON.parse(fs.readFileSync(path.join(APP, rel), 'utf8'));
export const readText = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8');

export function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}
