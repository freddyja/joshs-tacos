// Tiny static server that mounts a directory under a base path (default /joshs-tacos/),
// mirroring the production URL. The root can be swapped at runtime (used by the
// v1 -> v2 upgrade test).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

export function createStaticServer({ root, base = '/joshs-tacos/', port = 0 } = {}) {
  let currentRoot = path.resolve(root);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/' || url.pathname === base.slice(0, -1)) {
      res.writeHead(302, { Location: base });
      return res.end();
    }
    if (!url.pathname.startsWith(base)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    let rel = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(currentRoot, rel);
    if (!file.startsWith(currentRoot + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  });
  return {
    server,
    setRoot(dir) { currentRoot = path.resolve(dir); },
    listen() {
      return new Promise((resolve) => server.listen(port, '127.0.0.1', () => {
        const { port: p } = server.address();
        resolve(`http://127.0.0.1:${p}${base}`);
      }));
    },
    close() { return new Promise((resolve) => server.close(resolve)); },
  };
}
