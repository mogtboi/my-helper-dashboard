/* my helper dashboard — static shell cache only. No API caching. */
const CACHE = "my-helper-shell-v10";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./data/hk-holidays.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never cache live weather / bus / mtr / radio CDN
  if (
    url.hostname.includes("weather.gov.hk") ||
    url.hostname.includes("etabus.gov.hk") ||
    url.hostname.includes("rt.data.gov.hk") ||
    url.hostname.includes("dashboard.data.gov.hk") ||
    url.hostname.includes("mtr.com.hk") ||
    url.hostname.includes("akamaized.net") ||
    url.hostname.includes("rthk.hk")
  ) {
    return;
  }

  // Network-first for navigations and app assets; fall back to cache offline
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        if (response.ok && url.origin === self.location.origin) {
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("./index.html")))
  );
});
