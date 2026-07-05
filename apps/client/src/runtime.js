import { Capacitor } from '@capacitor/core';

export const appOrigin = import.meta.env.VITE_APP_ORIGIN || 'https://chat.evaonline.ir';

const isNativeShell = Capacitor.isNativePlatform() || window.location.protocol === 'file:';

export const apiOrigin = import.meta.env.VITE_API_URL || (isNativeShell ? appOrigin : '');
export const socketOrigin = import.meta.env.VITE_SOCKET_URL || (isNativeShell ? appOrigin : window.location.origin);

if (import.meta.env.DEV && !isNativeShell && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => {});

  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {});
  }
}
