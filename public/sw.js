/**
 * Service worker — Web Push delivery only (ADR-0047).
 *
 * Deliberately no offline caching. Caching this app would need a considered
 * story about stale scores and stale attendance, and getting that wrong is
 * worse than being online-only. This worker exists to receive pushes.
 *
 * The payload carries a title, a body and a URL, and nothing private: a push
 * lands on a lock screen, readable by whoever is near the phone.
 */

self.addEventListener("install", () => {
  // Take over without waiting for every old tab to close, so a person who
  // grants permission does not have to restart the app for it to work.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const title = payload.title || "Beagle Classroom";
  const options = {
    body: payload.body || "",
    // Both live under /icons; the bare filenames these once pointed at have
    // never existed, so every banner rendered without artwork.
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // Collapses repeats of the same thing rather than stacking a pile of
    // banners for one event.
    tag: payload.tag || undefined,
    data: { url: payload.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Reuse a tab that is already open rather than piling up windows.
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
