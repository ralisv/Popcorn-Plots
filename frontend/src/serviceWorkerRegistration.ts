/**
 * Register the service worker and request persistent storage.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported in this browser");
    return;
  }

  const baseUrl = import.meta.env.BASE_URL;
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const swUrl = `${normalizedBaseUrl}sw.js`;

  const registration = await navigator.serviceWorker.register(swUrl, {
    scope: normalizedBaseUrl,
  });

  console.log("Service Worker registered with scope:", registration.scope);

  await requestPersistentStorage();
}

/**
 * Request persistent storage permission.
 * This makes the browser less likely to evict our cached parquet files.
 */
async function requestPersistentStorage(): Promise<void> {
  const isPersisted = await navigator.storage.persisted();

  if (isPersisted) {
    console.log("Storage is already persistent");
    return;
  }

  const granted = await navigator.storage.persist();
  console.log(`Persistent storage granted: ${granted}`);
}
