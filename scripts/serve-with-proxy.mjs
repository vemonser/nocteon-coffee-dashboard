// A tiny static server + API proxy, so the e2e can run on a port of its own.
//
// WHY: the backend's CORS allows ONE origin (http://localhost:4200), and
// this repository is shared with a second session that takes that port —
// its dev server, its builds and its cleanups move the ground under a test
// run. This server serves the production build and forwards /api to the
// backend SERVER-SIDE, so the browser never does a CORS dance and the
// suite can run from any port:
//
//   npx ng build --output-path /tmp/opencode/dist-mine
//   cp -r /tmp/opencode/dist-mine/browser/* /tmp/opencode/dash-proxy/
//   # the bundle is patched to call the API on its own origin:
//   #   "http://localhost:8080" -> ""   (one bundle, one replacement)
//   node scripts/serve-with-proxy.mjs /tmp/opencode/dash-proxy 4300
//   E2E_BASE_URL=http://localhost:4300 E2E_NO_WEBSERVER=1 npx playwright test
//
// It adds no dependency: node:http only.
import { createServer, request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = process.argv[2] ?? '/tmp/opencode/dash-proxy';
const PORT = Number(process.argv[3] ?? 4300);
const API = process.argv[4] ?? 'http://localhost:8080';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  // The API: forwarded, server-side, so the browser never does CORS.
  if (url.pathname.startsWith('/api/')) {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.origin;
    delete headers.referer;
    const upstream = httpRequest(
      `${API}${url.pathname}${url.search}`,
      { method: req.method, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, {
          ...up.headers,
          'access-control-allow-origin': '*',
        });
        up.pipe(res);
      },
    );
    upstream.on('error', (err) => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    });
    req.pipe(upstream);
    return;
  }

  // The static files (the SPA: every unknown path is the app).
  const clean = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, clean);
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(ROOT, 'index.html');
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}).listen(PORT, () => {
  console.log(`serving ${ROOT} on http://localhost:${PORT} (the API is proxied to ${API})`);
});
