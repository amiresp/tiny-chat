import './notification-toast.css';

function showInAppToast({ title, body, icon }) {
  const existing = document.querySelector('.verdant-notification-toast');
  if (existing) existing.remove();

  const toast = document.createElement('button');
  toast.className = 'verdant-notification-toast';
  toast.type = 'button';

  const image = document.createElement('img');
  image.src = icon || '/icon.svg';
  image.alt = '';
  image.onerror = () => { image.src = '/icon.svg'; };

  const content = document.createElement('span');
  const heading = document.createElement('strong');
  const description = document.createElement('small');
  heading.textContent = title || 'New message';
  description.textContent = body || 'You have a new message.';
  content.append(heading, description);
  toast.append(image, content);

  toast.addEventListener('click', () => {
    window.focus();
    toast.remove();
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  window.setTimeout(() => {
    toast.classList.remove('visible');
    window.setTimeout(() => toast.remove(), 220);
  }, 5000);
}

export function notificationState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function enableNotifications() {
  if (!('Notification' in window)) {
    throw new Error('System notifications are not supported on this device. In-app alerts will still work.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked in browser settings. In-app alerts remain enabled.'
      : 'Notification permission was not granted. In-app alerts remain enabled.');
  }

  return permission;
}

export async function showIncomingNotification({ title, body, icon, tag }) {
  showInAppToast({ title, body, icon });

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
