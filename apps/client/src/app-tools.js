export function notificationState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function enableNotifications() {
  if (!('Notification' in window)) {
    throw new Error('Notifications are not supported on this device.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked in browser settings.'
      : 'Notification permission was not granted.');
  }

  return permission;
}

export async function showIncomingNotification({ title, body, icon, tag }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;

  const options = {
    body: body || 'You have a new message.',
    icon: icon || '/icon.svg',
    badge: '/icon.svg',
    tag: tag || 'verdant-message',
    renotify: true,
    data: { url: window.location.href },
  };

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.showNotification) {
      await registration.showNotification(title || 'Verdant Chat', options);
      return true;
    }
  } catch {
    // Fall back to the page notification below.
  }

  try {
    const notification = new Notification(title || 'Verdant Chat', options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

export async function refreshPwa() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      await registration.unregister();
    }
  }

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_refresh', Date.now().toString());
  window.location.replace(url.toString());
}
