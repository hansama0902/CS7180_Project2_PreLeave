self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const promiseChain = self.registration.showNotification(data.title || 'Notification', {
      body: data.body || 'You have a new message.',
      icon: data.icon || '/logo.png',
      badge: '/badge.png',
      data: data.data,
      requireInteraction: true,
      actions: [
          { action: 'open', title: 'View Trip' },
          { action: 'dismiss', title: 'Dismiss' }
      ]
  });
  event.waitUntil(promiseChain);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
      if (event.notification.data && event.notification.data.url) {
          event.waitUntil(clients.openWindow(event.notification.data.url));
      } else {
          event.waitUntil(clients.openWindow('/homepage'));
      }
  }
});
