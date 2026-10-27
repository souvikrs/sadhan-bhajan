// Sadhan Bhajan service worker: keeps the app and its encrypted data available offline.
const V = "sb-__VERSION__";
const SHELL = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icons/mw-mark.svg", "icons/icon-192.png", "data/meta.json", "data/main.bin"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.hostname.endsWith("youtube.com") || u.hostname.endsWith("ytimg.com") || u.hostname.endsWith("googlevideo.com")) return;
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const r = await fetch(e.request);
      if (r.ok || r.type === "opaque") c.put(e.request, r.clone());
      return r;
    } catch { return hit || Response.error(); }
  }));
});
