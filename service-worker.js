/* =========================================================
   Everton Metais · Service Worker
   ========================================================= */
'use strict';

const CACHE_VERSION = 'everton-metais-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './logo.png'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      /* addAll falha por completo se 1 item falhar — fazemos um a um */
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch(() => {
            /* ignora itens ausentes (ex.: index.html pode ter outro nome) */
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_VERSION) return caches.delete(key);
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  /* Só intercepta GET */
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }

  /* Só lida com same-origin (deixa CDN, Drive, flagcdn etc. passarem direto) */
  if (url.origin !== self.location.origin) return;

  /* Apenas http(s) */
  if (!url.protocol.startsWith('http')) return;

  /* Navegação / HTML → network-first com fallback para cache */
  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION)
            .then((cache) => cache.put(req, copy))
            .catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) =>
            cached || caches.match('./index.html') || caches.match('./')
          )
        )
    );
    return;
  }

  /* Demais assets → cache-first com atualização em background */
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        /* Atualiza em background sem bloquear a resposta */
        fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE_VERSION)
                .then((cache) => cache.put(req, copy))
                .catch(() => {});
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_VERSION)
              .then((cache) => cache.put(req, copy))
              .catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});

/* ---------- MENSAGENS ---------- */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
