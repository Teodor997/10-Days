/* Stoc Paleți — face aplicația disponibilă fără internet. La fiecare versiune nouă se schimbă numele de mai jos. */
var CACHE = 'stoc-paleti-v1.1.0';
var FILES = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'vendor/xlsx.full.min.js',
  'vendor/firebase-app-compat.js', 'vendor/firebase-auth-compat.js', 'vendor/firebase-firestore-compat.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
/* cache: 'reload' ocolește memoria HTTP a browserului, ca o versiune nouă să nu fie instalată cu fișiere vechi */
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); })); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('stoc-paleti-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (/[/]config[.]js$/.test(url.pathname)) { // configurația: întâi din rețea, ca o schimbare să ajungă imediat pe dispozitive
    e.respondWith(fetch(e.request.url, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('config.js', copy); }); }
      return res;
    }).catch(function () { return caches.match('config.js'); }));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).catch(function () {
      return e.request.mode === 'navigate' ? caches.match('index.html') : Response.error();
    });
  }));
});
