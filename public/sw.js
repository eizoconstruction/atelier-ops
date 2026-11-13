// Atelier Ops — service worker
// Réseau d'abord (toujours la dernière version), cache en secours hors ligne.
// Les données Supabase ne sont jamais mises en cache.
const CACHE = "atelier-ops-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, polices, etc.
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok && (req.mode === "navigate" || /\/(assets|src)\/|\.(js|css|png|svg|webmanifest)$/.test(url.pathname))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req.mode === "navigate" ? "/" : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === "navigate" ? "/" : req).then(r => r || caches.match("/")))
  );
});
