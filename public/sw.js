const CACHE_NAME = 'smart-booking-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Bypass Supabase API, Google OAuth, Local API routes, and non-GET requests
  if (
    requestUrl.origin.includes('supabase.co') ||
    requestUrl.origin.includes('google.com') ||
    requestUrl.pathname.startsWith('/api') ||
    requestUrl.pathname.startsWith('/auth') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  const isNavigation =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    requestUrl.pathname === '/';

  // For navigations/documents: behave like a normal browser (network-first)
  // to avoid serving a broken/stale cached navigation response (ERR_FAILED).
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return networkResponse;
        })
        .catch(() => {
          // If offline, fall back to the cached root.
          return caches.match('/');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Cache fonts, images, and static chunks
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (requestUrl.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/) ||
              requestUrl.host.includes('fonts.gstatic.com') ||
              requestUrl.host.includes('fonts.googleapis.com') ||
              requestUrl.pathname.includes('/_next/static/'))
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback if offline (non-navigation)
          return caches.match('/');
        });
    })
  );
});

