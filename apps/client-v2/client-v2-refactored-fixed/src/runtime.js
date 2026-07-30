export const appOrigin = import.meta.env.VITE_APP_ORIGIN || 'https://chat.evaonline.ir';

const nativeLike = window.location.protocol === 'file:';

export const apiOrigin = import.meta.env.VITE_API_URL || (nativeLike ? appOrigin : '');
export const socketOrigin = import.meta.env.VITE_SOCKET_URL || (nativeLike ? appOrigin : window.location.origin);

if (import.meta.env.DEV && !nativeLike && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => {});

  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {});
  }
}
