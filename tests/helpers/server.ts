import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(fileURLToPath(new URL('../../', import.meta.url)), 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.xml': 'application/xml', '.json': 'application/json', '.txt': 'text/plain', '.woff2': 'font/woff2',
};

export interface TestServer { origin: string; close: () => Promise<void> }

/** Minimal static server over dist/, mirroring Netlify's directory-index behaviour. */
export function startServer(port = 4399): Promise<TestServer> {
  const server: Server = createServer(async (req, res) => {
    try {
      const p = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
      let fp = normalize(join(DIST, p));
      if (!fp.startsWith(DIST)) { res.writeHead(403).end(); return; }
      try { if ((await stat(fp)).isDirectory()) fp = join(fp, 'index.html'); }
      catch { if (!extname(fp)) fp = join(fp, 'index.html'); }
      let data: Buffer;
      try { data = await readFile(fp); }
      catch { fp = join(DIST, '404.html'); data = await readFile(fp); res.statusCode = 404; }
      res.setHeader('Content-Type', MIME[extname(fp)] || 'application/octet-stream');
      res.end(data);
    } catch (e) { res.writeHead(500).end(String(e)); }
  });
  return new Promise((resolve) => {
    server.listen(port, () => resolve({
      origin: `http://localhost:${port}`,
      close: () => new Promise((r) => server.close(() => r())),
    }));
  });
}
