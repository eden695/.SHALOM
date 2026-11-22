// Service Worker for SHALOM - Full Offline Mobile & Desktop Support
const CACHE_NAME = 'shalom-cache-v13-e68df3c5';
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./shalom_logo.jpg",
  "./shalom_logo_512x512.png",
  "./shalom_logo_512x512.jpg",
  "./icon.png",
  "./assets/index-C8tHEs-i.js",
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
  "./assets/plus-jakarta-sans-vietnamese-700-normal-CV6qDkkj.woff2",
  "./assets/style-kjj-sQ9s.css"
];

function fetchWithTimeout(request, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('network-timeout')), timeoutMs);
    fetch(request, { cache: 'no-store' })
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function matchOfflineHtml(request) {
  const cachedExact = await caches.match(request, { ignoreSearch: true });
  if (cachedExact) return cachedExact;
  const fallbackIndex = await caches.match('./index.html', { ignoreSearch: true });
  if (fallbackIndex) return fallbackIndex;
  const fallbackRoot = await caches.match('./', { ignoreSearch: true });
  return fallbackRoot || Response.error();
}

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

  // Navigation / HTML: Fast-timeout NetworkFirst with instant offline cache fallback
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetchWithTimeout(event.request, 1500)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            const indexCopy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
              cache.put('./index.html', indexCopy);
            });
            return networkResponse;
          }
          return matchOfflineHtml(event.request);
        })
        .catch(() => matchOfflineHtml(event.request))
    );
    return;
  }

  // Hashed assets (JS, CSS, WOFF2 fonts): CacheFirst for instant offline boot
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
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

  // Other local assets (manifest, logos, icons): CacheFirst/Network fallback
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Refresh silently in background if online
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => Response.error());
    })
  );
});
