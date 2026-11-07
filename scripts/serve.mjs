import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../www/', import.meta.url));
const types = {
  '.svg': 'image/svg+xml',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.map': 'application/json'
};
http
  .createServer(async (req, res) => {
    try {
      let name = decodeURIComponent(
        new URL(req.url, 'http://localhost').pathname
      );
      if (name.endsWith('/')) {
        name += 'index.html';
      }
      const file = path.resolve(root, '.' + name);
      if (!file.startsWith(root)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(data);
    }
    catch {
      res.writeHead(404);
      res.end('Not found');
    }
  })
  .listen(Number(process.env.PORT || 4174), '127.0.0.1', () =>
    console.log('Solid Workbench: http://127.0.0.1:' + (process.env.PORT || 4174))
  );
