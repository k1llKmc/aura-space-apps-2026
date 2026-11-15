import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
const root = path.resolve('apps/web/out');
const prefix = '/aura-space-apps-2026';
http
  .createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent(
        new URL(request.url, 'http://localhost').pathname,
      );
      if (pathname.startsWith(prefix)) pathname = pathname.slice(prefix.length);
      const target = path.resolve(
        root,
        '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname),
      );
      if (!target.startsWith(root + path.sep)) throw new Error('Invalid path');
      const data = await readFile(target);
      const mime = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.txt': 'text/plain',
      };
      response.writeHead(200, {
        'Content-Type':
          mime[path.extname(target)] || 'application/octet-stream',
      });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  })
  .listen(4173, '127.0.0.1', () =>
    console.log('Public demo: http://127.0.0.1:4173/aura-space-apps-2026/'),
  );
