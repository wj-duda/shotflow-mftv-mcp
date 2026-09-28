import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..', 'site');
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '127.0.0.1';
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
};

const server = createServer(async (request, response) => {
  try {
    const requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    const relativePath = requestPath === '/'
      ? 'index.html'
      : `${requestPath.replace(/^\/+/, '')}${requestPath.endsWith('/') ? 'index.html' : ''}`;
    const filePath = path.resolve(root, relativePath);
    const relative = path.relative(root, filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !(await stat(filePath)).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.listen(port, host, () => {
  console.log(`Przeglądarka świata: http://${host}:${port}`);
  console.log('Zatrzymaj serwer skrótem Ctrl+C.');
});
