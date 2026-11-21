// Beyblade Arena - service worker: rete prima (si vede subito la versione nuova),
// cache come riserva per giocare offline. I dati non passano da qui: li gestisce app.js
// (localStorage + coda di invio), e Supabase non viene mai messo in cache.
const CACHE = "beyblade-arena-v1";
const SHELL = ["./", "index.html", "styles.css", "app.js", "beys.js", "config.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/favicon-32.png"];
const EXTRA = ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(
      SHELL.map((u) => fetch(u, { cache: "no-cache" }).then((r) => r.ok ? c.put(u, r) : null).catch(() => null))
        .concat(EXTRA.map((u) => fetch(u, { mode: "cors" }).then((r) => r.ok ? c.put(u, r) : null).catch(() => null)))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co") || url.pathname.includes("/rest/v1/")) return;
  const mia = url.origin === location.origin;
  const daRete = mia ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" }) : fetch(req);
  e.respondWith(
    daRete
      .then((res) => {
        if (res.ok && (mia || url.hostname.includes("cdnjs") || url.hostname.includes("fonts."))) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((r) => r || (req.mode === "navigate" ? caches.match("index.html") : undefined)))
  );
});
