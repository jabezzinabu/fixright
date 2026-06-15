// IMPORTANT: Bump the CACHE version number every time any JS or CSS file is modified.
// New files also need to be added to the STATIC array. Current version: v11.
const CACHE = 'fixright-v11';
const STATIC = [
  '/',
  '/index.html',
  '/legal.html',
  '/css/base.css',
  '/css/components.css',
  '/css/sections.css',
  '/js/config.js',
  '/js/ui.js',
  '/js/auth.js',
  '/js/measurement.js',
  '/js/measurement-data.js',
  '/js/retailer-data.js',
  '/js/estimate.js',
  '/js/share.js',
  '/js/visualize.js',
  '/js/discover.js',
  '/js/admin.js',
  '/js/pwa.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
];

// Install — cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate — clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fall back to cache for app shell
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept API calls
  if (
    url.hostname === 'api.anthropic.com' ||
    url.hostname === 'api.openai.com' ||
    url.hostname.includes('supabase.co')
  ) return;

  // Network first for HTML
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});
