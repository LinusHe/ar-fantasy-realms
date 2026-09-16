var APP_PREFIX = 'fantasy-realms-';
var VERSION = '4.0.1';
var CACHE_NAME = APP_PREFIX + VERSION;
var PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/img/cursed-hoard.png',
  '/img/wizkids.png',
  '/img/globe.png',
  '/css/style.css',
  '/fonts/cinzel-latin.woff2',
  '/fonts/cinzel-latin-ext.woff2',
  '/js/app.js',
  '/js/ui.js',
  '/js/fx.js',
  '/js/vendor/gsap.min.js',
  '/js/vendor/three.min.js',
  '/js/deck.js',
  '/js/discard.js',
  '/js/hand.js',
  '/js/handlebars.min-v4.7.7.js',
  '/js/jquery.i18n.properties.min.js',
  '/js/jquery-3.6.0.min.js',
  '/i18n/Messages.properties',
  '/i18n/Messages_en.properties',
  '/i18n/Messages_cz.properties',
  '/i18n/Messages_de.properties',
  '/i18n/Messages_es.properties',
  '/i18n/Messages_fr.properties',
  '/i18n/Messages_pl.properties',
  '/i18n/Messages_pt.properties',
  '/i18n/Messages_ua.properties',
  '/i18n/Messages_kr.properties',
  '/i18n/Messages_ru.properties',
  '/i18n/Messages_zh.properties',
  '/sound/clear.mp3',
  '/sound/click.mp3',
  '/sound/magic.mp3',
  '/sound/swoosh.mp3',
  '/icons/android-icon-192x192.png',
  '/icons/android-icon-512x512.png',
  '/icons/apple-icon-180x180.png'
];

function cacheIfAppResponse(cache, key, response) {
  if (!response.ok || response.headers.get('X-Login')) {
    return response;
  }
  cache.put(key, response.clone());
  return response;
}

async function precacheAll() {
  var cache = await caches.open(CACHE_NAME);
  await Promise.all(PRECACHE.map(async function (url) {
    var response = await fetch(url, { credentials: 'same-origin', cache: 'reload' });
    if (!response.ok || response.headers.get('X-Login')) {
      throw new Error('Precache failed: ' + url);
    }
    await cache.put(url, response);
  }));
}

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(precacheAll());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf(APP_PREFIX) === 0 && key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/service-worker.js' || url.pathname === '/login') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then(function (cached) {
        return cached || fetch(request).then(function (response) {
          return caches.open(CACHE_NAME).then(function (cache) {
            return cacheIfAppResponse(cache, '/', response);
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      var network = fetch(request).then(function (response) {
        return caches.open(CACHE_NAME).then(function (cache) {
          return cacheIfAppResponse(cache, request, response);
        });
      }).catch(function () {
        return cached;
      });
      return cached || network;
    })
  );
});
