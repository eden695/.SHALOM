// Service Worker for SHALOM - Full Offline Support (CacheFirst hashed assets, NetworkFirst HTML)
const CACHE_NAME = 'shalom-cache-v12-5fc3f150';
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./shalom_logo.jpg",
  "./shalom_logo_512x512.png",
  "./shalom_logo_512x512.jpg",
  "./icon.png",
  "./assets/index-CuS9GNbK.css",
  "./assets/index-DyOxqjMQ.js",
  "./assets/outfit-latin-500-normal-ClnHRwRh.woff",
  "./assets/outfit-latin-500-normal-DKnIMDSk.woff2",
  "./assets/outfit-latin-600-normal-B7SfZ07L.woff2",
  "./assets/outfit-latin-600-normal-BEfTtDA7.woff",
  "./assets/outfit-latin-700-normal-Cu9v6i1X.woff2",
  "./assets/outfit-latin-700-normal-D4itBLBr.woff",
  "./assets/outfit-latin-800-normal-BRHLSPcU.woff",
  "./assets/outfit-latin-800-normal-CQna6-G7.woff2",
  "./assets/outfit-latin-ext-500-normal-DrCvqoFD.woff",
  "./assets/outfit-latin-ext-500-normal-zeox_O30.woff2",
  "./assets/outfit-latin-ext-600-normal-B85nYjL1.woff2",
  "./assets/outfit-latin-ext-600-normal-CWJcPgd7.woff",
  "./assets/outfit-latin-ext-700-normal-CI4iH74K.woff2",
  "./assets/outfit-latin-ext-700-normal-fjS8-Gm7.woff",
  "./assets/outfit-latin-ext-800-normal-DRv2ic_2.woff2",
  "./assets/outfit-latin-ext-800-normal-DyhPHUt-.woff",
  "./assets/playfair-display-cyrillic-400-italic-24vVh5t9.woff",
  "./assets/playfair-display-cyrillic-400-italic-drKdN10-.woff2",
  "./assets/playfair-display-cyrillic-400-normal-CjW2EstV.woff2",
  "./assets/playfair-display-cyrillic-400-normal-ZiRag6zj.woff",
  "./assets/playfair-display-cyrillic-700-normal-Dk1mTcxf.woff",
  "./assets/playfair-display-cyrillic-700-normal-Dw3uKy19.woff2",
  "./assets/playfair-display-latin-400-italic-LeeEXsx5.woff2",
  "./assets/playfair-display-latin-400-italic-hIeePEuE.woff",
  "./assets/playfair-display-latin-400-normal-CFtfchNt.woff2",
  "./assets/playfair-display-latin-400-normal-DHYHbkg3.woff",
  "./assets/playfair-display-latin-700-normal-Bc_1Q1cG.woff",
  "./assets/playfair-display-latin-700-normal-CuDiGg7c.woff2",
  "./assets/playfair-display-latin-ext-400-italic-CZOjvne0.woff",
  "./assets/playfair-display-latin-ext-400-italic-zVOgzDMq.woff2",
  "./assets/playfair-display-latin-ext-400-normal-BxlSGspa.woff2",
  "./assets/playfair-display-latin-ext-400-normal-qdZwdvNS.woff",
  "./assets/playfair-display-latin-ext-700-normal-C58ejOkc.woff2",
  "./assets/playfair-display-latin-ext-700-normal-D5HUU8GT.woff",
  "./assets/playfair-display-vietnamese-400-italic-CD15TOr5.woff2",
  "./assets/playfair-display-vietnamese-400-italic-Cpv4sfwY.woff",
  "./assets/playfair-display-vietnamese-400-normal-BV2APVTb.woff2",
  "./assets/playfair-display-vietnamese-400-normal-BbvUAu4N.woff",
  "./assets/playfair-display-vietnamese-700-normal-CaKJSIny.woff2",
  "./assets/playfair-display-vietnamese-700-normal-Cr1rw0mr.woff",
  "./assets/plus-jakarta-sans-latin-400-normal-BDKaGhyp.woff",
  "./assets/plus-jakarta-sans-latin-400-normal-Dhut76fR.woff2",
  "./assets/plus-jakarta-sans-latin-500-normal-Bf-nb4oT.woff2",
  "./assets/plus-jakarta-sans-latin-500-normal-DYtqi0QS.woff",
  "./assets/plus-jakarta-sans-latin-600-normal-BR_Ojra4.woff",
  "./assets/plus-jakarta-sans-latin-600-normal-DLTa1BUW.woff2",
  "./assets/plus-jakarta-sans-latin-700-normal-CfpNZvy6.woff2",
  "./assets/plus-jakarta-sans-latin-700-normal-DqEcQeE5.woff",
  "./assets/plus-jakarta-sans-latin-ext-400-normal-2ppkqaOR.woff",
  "./assets/plus-jakarta-sans-latin-ext-400-normal-D127hM_v.woff2",
  "./assets/plus-jakarta-sans-latin-ext-500-normal-9VZagAe1.woff2",
  "./assets/plus-jakarta-sans-latin-ext-500-normal-CqEEAICU.woff",
  "./assets/plus-jakarta-sans-latin-ext-600-normal-B0WRRYJ1.woff",
  "./assets/plus-jakarta-sans-latin-ext-600-normal-DQgPU_Cg.woff2",
  "./assets/plus-jakarta-sans-latin-ext-700-normal-8-d-IyIQ.woff",
  "./assets/plus-jakarta-sans-latin-ext-700-normal-BajbvANd.woff2",
  "./assets/plus-jakarta-sans-vietnamese-400-normal-B8TCSmUq.woff",
  "./assets/plus-jakarta-sans-vietnamese-400-normal-Cg2kxhWu.woff2",
  "./assets/plus-jakarta-sans-vietnamese-500-normal-CvE5C8T-.woff",
  "./assets/plus-jakarta-sans-vietnamese-500-normal-DiU8zqi-.woff2",
  "./assets/plus-jakarta-sans-vietnamese-600-normal-5YsyKbU1.woff",
  "./assets/plus-jakarta-sans-vietnamese-600-normal-Y4VTTRme.woff2",
  "./assets/plus-jakarta-sans-vietnamese-700-normal-BCh_uG_5.woff",
  "./assets/plus-jakarta-sans-vietnamese-700-normal-CV6qDkkj.woff2"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        ASSETS_TO_CACHE.map(async (assetUrl) => {
          try {
            const response = await fetch(assetUrl, { cache: 'reload' });
            if (response && response.ok) {
              await cache.put(assetUrl, response);
            }
          } catch (err) {
            console.warn('Pre-cache skipped for:', assetUrl, err);
          }
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME && name.startsWith('shalom-cache-')) {
            return caches.delete(name);
          }
          return Promise.resolve(false);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http') || url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/@vite') ||
    url.pathname.includes('/@react-refresh') ||
    url.pathname.includes('/src/') ||
    url.pathname.includes('/node_modules/')
  ) {
    return;
  }

  // Navigation / HTML: Network-first with offline cache fallback
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
              cache.put('./index.html', networkResponse.clone());
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request, { ignoreSearch: true });
          if (cached) return cached;
          const fallbackIndex = await caches.match('./index.html');
          if (fallbackIndex) return fallbackIndex;
          const fallbackRoot = await caches.match('./');
          return fallbackRoot || Response.error();
        })
    );
    return;
  }

  // Hashed Vite assets (JS, CSS, WOFF2 fonts): CacheFirst for instant offline startup
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return networkResponse;
          })
          .catch(() => Response.error());
      })
    );
    return;
  }

  const fetchOptions = url.pathname.endsWith('manifest.json')
    ? { cache: 'no-store' }
    : {};

  event.respondWith(
    fetch(event.request, fetchOptions)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request, { ignoreSearch: true });
        return cached || Response.error();
      })
  );
});
