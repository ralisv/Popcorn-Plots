// @ts-check
/// <reference lib="webworker" />

/** @type {ServiceWorkerGlobalScope} */
// @ts-ignore
const sw = self;

const CACHE_NAME = "parquet-cache-v1";

sw.addEventListener("install", (event) => {
  // Activate immediately without waiting for existing clients to close
  event.waitUntil(sw.skipWaiting());
});

sw.addEventListener("activate", (event) => {
  // Take control of all clients immediately
  event.waitUntil(
    (async () => {
      await sw.clients.claim();

      // Clean up old caches if cache version changes
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) => name.startsWith("parquet-cache-") && name !== CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );
    })(),
  );
});

/** @type {(url: string) => string} */
function removeHash(url) {
  return url.replace(/-[a-f0-9]{8,}\./, ".");
}

sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  const isParquet = url.pathname.endsWith(".parquet");
  const isSameOrigin = url.origin === sw.location.origin;
  const isGetMethod = event.request.method === "GET";

  if (!isParquet || !isSameOrigin || !isGetMethod) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);

      if (cachedResponse) {
        console.log(`Cache hit for ${event.request.url}`);
        return cachedResponse;
      }

      console.log(`Cache miss for ${event.request.url}`);
      const cacheKeys = await cache.keys();

      // On cache miss, remove all existing versions of this resource
      await Promise.all(
        cacheKeys
          .filter(
            (cachedRequest) =>
              removeHash(new URL(cachedRequest.url).pathname) ===
              removeHash(url.pathname),
          )
          .map(async (request) => {
            await cache.delete(request);
            console.log(`Removed obsolete cache entry for ${request.url}`);
          }),
      );

      const networkResponse = await fetch(event.request);

      if (networkResponse.ok) {
        cache.put(event.request, networkResponse.clone());
      }

      return networkResponse;
    })(),
  );
});
