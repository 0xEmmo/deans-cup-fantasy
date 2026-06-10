self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  const { title, body, icon, url } = data;

  const options = {
    body,
    icon: icon || '/favicon.ico',
    badge: '/favicon.ico',
    data: { url },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.openWindow(url)
  );
});