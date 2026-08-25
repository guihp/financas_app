/* Push handlers imported by the Workbox-generated service worker. */

self.addEventListener("push", (event) => {
  let payload = {
    title: "IAFÉ FINANCE",
    body: "Você tem uma nova notificação",
    data: {},
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || payload.body,
        data: parsed.data || parsed || {},
      };
    }
  } catch {
    try {
      const text = event.data?.text();
      if (text) payload.body = text;
    } catch {
      /* ignore */
    }
  }

  const options = {
    body: payload.body,
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    data: payload.data,
    tag: payload.data?.notification_id || payload.data?.type || undefined,
    renotify: Boolean(payload.data?.notification_id),
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const path =
    data.url ||
    data.path ||
    deepLinkForType(data.type) ||
    "/dash";

  const targetUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});

function deepLinkForType(type) {
  if (!type || typeof type !== "string") return null;
  if (type.startsWith("appointment")) return "/agenda";
  if (type.startsWith("transaction")) return "/transactions";
  if (type.startsWith("shopping")) return "/lista-compras";
  if (type === "budget_threshold") return "/orcamentos";
  if (type === "invoice_due") return "/faturas";
  if (type === "engagement_inactive_2d") return "/dash";
  return "/dash";
}
