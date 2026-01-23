import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request: { url } }) => new URL(url).pathname.endsWith(".parquet"),
  new CacheFirst({
    cacheName: "parquet-cache",
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        maxEntries: 10,
      }),
    ],
  }),
);

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const persisted = await navigator.storage.persist();
      console.log(`Persistent storage: ${persisted ? "granted" : "denied"}`);
    })(),
  );
});
