import cookieParser from 'cookie-parser';
import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'site');
const app = express();
const port = 3000;
const authPass = process.env.AUTH_PASS;

if (!authPass) {
  console.error('AUTH_PASS environment variable is required');
  process.exit(1);
}

const cookieName = 'fantasy_realms_auth';
const cookieValue = createHmac('sha256', authPass)
  .update('fantasy-realms-auth-v1')
  .digest('base64url');
const cookieMaxAge = 365 * 24 * 60 * 60 * 1000;

app.disable('x-powered-by');
app.use(cookieParser());
app.use(express.urlencoded({ extended: false, limit: '4kb' }));

const loginHtml = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#0b0714">
  <title>Fantasy Realms · Login</title>
  <style>
    *{box-sizing:border-box}html,body{margin:0;min-height:100%}
    body{min-height:100svh;display:grid;place-items:center;padding:20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f6f1ff;background:radial-gradient(circle at 20% 0,rgba(143,103,255,.28),transparent 40%),radial-gradient(circle at 80% 100%,rgba(38,210,180,.15),transparent 42%),#0b0714}
    form{width:min(100%,360px);padding:34px 28px;border:1px solid rgba(255,255,255,.12);border-radius:22px;text-align:center;background:rgba(25,18,42,.94);box-shadow:0 24px 80px rgba(0,0,0,.45)}
    .mark{display:grid;place-items:center;width:58px;height:58px;margin:0 auto 18px;border-radius:18px;font:700 25px Georgia,serif;color:#f5c96c;background:linear-gradient(145deg,#6d3fc7,#30205d);box-shadow:0 10px 28px rgba(109,63,199,.35)}
    h1{margin:0 0 6px;font:700 1.35rem Georgia,serif;letter-spacing:.02em}p{margin:0 0 22px;color:#aaa0bc;font-size:.88rem}.error{margin:-8px 0 12px;color:#ff8f9d}
    input,button{width:100%;border-radius:12px;font:inherit}input{padding:13px 14px;border:1px solid rgba(255,255,255,.15);color:#fff;background:rgba(255,255,255,.07)}input:focus{outline:2px solid rgba(151,113,255,.55);border-color:transparent}
    button{margin-top:11px;padding:13px;border:0;font-weight:750;color:#fff;background:linear-gradient(135deg,#7950d8,#5631a3);cursor:pointer}button:active{transform:scale(.985)}
  </style>
</head>
<body>
  <form method="post" action="/login">
    <div class="mark" aria-hidden="true">FR</div>
    <h1>Fantasy Realms</h1>
    <p>Wertungs-App</p>
    {{ERROR}}
    <input name="pass" type="password" placeholder="Passwort" autocomplete="current-password" required autofocus>
    <button type="submit">Anmelden</button>
  </form>
</body>
</html>`;

function secureEqual(left, right) {
  const a = Buffer.from(String(left ?? ''));
  const b = Buffer.from(String(right ?? ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

function isAuthenticated(req) {
  return secureEqual(req.cookies[cookieName], cookieValue);
}

function sendLogin(res, error = '') {
  res.set({ 'X-Login': '1', 'Cache-Control': 'no-store' });
  res.send(loginHtml.replace('{{ERROR}}', error));
}

const publicPrefixes = ['/icons/', '/manifest.json', '/service-worker.js'];

app.use((req, res, next) => {
  if (req.path === '/login' || publicPrefixes.some((prefix) => req.path.startsWith(prefix))) return next();
  if (isAuthenticated(req)) return next();

  // Navigations get the login form. Subresource requests get a real 401 so
  // an older service worker cannot cache HTML under a JS/CSS URL.
  if (req.method === 'GET' && (
    req.path === '/' ||
    req.path.endsWith('.html') ||
    req.get('Sec-Fetch-Dest') === 'document'
  )) {
    return sendLogin(res);
  }
  res.set({ 'X-Login': '1', 'Cache-Control': 'no-store' }).status(401).send('Authentication required');
});

app.get('/login', (req, res) => {
  if (isAuthenticated(req)) return res.redirect('/');
  sendLogin(res);
});

app.post('/login', (req, res) => {
  if (!secureEqual(req.body.pass, authPass)) {
    return sendLogin(res, '<p class="error">Falsches Passwort.</p>');
  }
  res.cookie(cookieName, cookieValue, {
    httpOnly: true,
    maxAge: cookieMaxAge,
    sameSite: 'lax',
    secure: true,
  });
  res.redirect('/');
});

app.get('/service-worker.js', (req, res) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Service-Worker-Allowed': '/',
  });
  res.sendFile(join(root, 'service-worker.js'));
});

app.get('/manifest.json', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(join(root, 'manifest.json'));
});

app.use('/icons', express.static(join(root, 'icons'), { maxAge: '30d' }));

for (const directory of ['css', 'fonts', 'i18n', 'img', 'js', 'sound']) {
  app.use(`/${directory}`, express.static(join(root, directory), { maxAge: '1d' }));
}

for (const file of ['favicon.ico', 'browserconfig.xml', 'find-scores.html', 'tests.html']) {
  app.get(`/${file}`, (req, res) => res.sendFile(join(root, file)));
}

app.get('/{*splat}', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(join(root, 'index.html'));
});

app.listen(port, () => {
  console.log(`Fantasy Realms server running on port ${port}`);
});
