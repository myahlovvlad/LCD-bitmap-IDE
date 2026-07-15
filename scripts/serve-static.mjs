import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist/renderer');
const port = Number(process.argv[3] ?? 4173);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  const requested = normalize(join(root, pathname));
  const candidate = requested.startsWith(root) && existsSync(requested) && statSync(requested).isFile()
    ? requested
    : join(root, 'index.html');

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': mimeTypes[extname(candidate)] ?? 'application/octet-stream'
  });
  createReadStream(candidate).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Static renderer available at http://127.0.0.1:${port}`);
});
