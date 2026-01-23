/**
 * Register the service worker and request persistent storage.
 * Only enabled in production to avoid caching issues during development.
 */
export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported in this browser");
    return;
  }

  // In development mode, unregister any existing service workers
  if (import.meta.env.DEV) {
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(
      registrations.map(async (reg) => {
        await reg.unregister();
        console.log("Unregistered existing service worker:", reg.scope);
      }),
    );

    console.warn("Service Worker registration skipped in development mode");
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
