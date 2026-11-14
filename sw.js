// Service worker : garde l'application disponible sans réseau.
// Changez VERSION à chaque mise à jour pour forcer le rafraîchissement sur les téléphones.
const VERSION = "mct-v1.0.4";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./firebase-config.js",
  "./style.css", "./app.js", "./store.js", "./pdf.js", "./data.js",
  "./icon-192.png", "./icon-512.png", "./maskable-512.png", "./apple-touch-icon.png", "./favicon.png", "./logo.jpg",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Les échanges avec Firestore et l'authentification ne passent jamais par le cache.
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("firebaseio.com") || url.hostname.includes("identitytoolkit")) return;
  // Bibliothèques (Firebase, PDF, polices) : cache d'abord, réseau ensuite.
  if (url.hostname === "www.gstatic.com" || url.hostname === "cdnjs.cloudflare.com" || url.hostname.startsWith("fonts.")) {
    event.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") c.put(req, res.clone());
      return res;
    }));
    return;
  }
  // Fichiers de l'application : réseau d'abord (pour les mises à jour), cache si hors ligne.
  if (url.origin === self.location.origin) {
    event.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("./index.html"))));
  }
});
