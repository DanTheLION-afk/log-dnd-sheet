/* Party Ledger offline cache. Keep this file next to index.html.
   It only answers for the Party Ledger page and the few files that page loads; every other page on the site is left alone. */
const CACHE = 'party-ledger-v2';
const here = u => new URL(u, self.location).href;
const DIR = here('./');
const PAGE = here('index.html');
const SHELL = ['party-manifest.json', 'party-icon-192.png', 'party-icon-512.png', 'party.html'].map(here);
const LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdn.jsdelivr.net/npm/firebase@10.12.2/firebase-app-compat.js",
  "https://cdn.jsdelivr.net/npm/firebase@10.12.2/firebase-auth-compat.js",
  "https://cdn.jsdelivr.net/npm/firebase@10.12.2/firebase-firestore-compat.js"
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all([PAGE].concat(SHELL).map(u => fetch(u, { cache: 'reload' }).then(r => (r.ok ? c.put(u, r) : null)).catch(() => null)));
    await Promise.all(LIBS.map(u => fetch(u, { mode: 'cors', credentials: 'omit' }).then(r => (r.ok ? c.put(u, r) : null)).catch(() => null)));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('party-ledger-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* the page itself: always try the internet first so a new build shows up at once; fall back to the saved copy */
async function page() {
  const c = await caches.open(CACHE);
  const saved = await c.match(PAGE);
  const net = fetch(PAGE, { cache: 'no-cache' }).then(r => { if (r && r.ok) c.put(PAGE, r.clone()); return r; });
  if (!saved) return net;
  try {
    const r = await Promise.race([net, new Promise((_, no) => setTimeout(no, 4000))]);
    if (r && r.ok) return r;
  } catch (e) { }
  net.catch(() => null);
  return saved;
}
/* libraries and fonts never change at the same address: saved copy first */
async function kept(url, fallback) {
  const c = await caches.open(CACHE);
  const saved = await c.match(url);
  if (saved) return saved;
  try {
    const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (r.ok) c.put(url, r.clone());
    return r;
  } catch (e) { return fetch(fallback); }
}
/* small files next to the page: saved copy now, refresh it in the background */
async function fresh(url) {
  const c = await caches.open(CACHE);
  const saved = await c.match(url);
  const net = fetch(url, { cache: 'no-cache' }).then(r => { if (r && r.ok) c.put(url, r.clone()); return r; });
  if (saved) { net.catch(() => null); return saved; }
  return net;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url; try { url = new URL(req.url); } catch (err) { return; }
  const bare = url.origin + url.pathname;
  if (bare === PAGE || bare === DIR) e.respondWith(page());
  else if (SHELL.includes(bare)) e.respondWith(fresh(bare));
  else if (LIBS.includes(req.url) || FONT_HOSTS.includes(url.hostname)) e.respondWith(kept(req.url, req));
});
