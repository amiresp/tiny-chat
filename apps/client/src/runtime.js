import { Capacitor } from '@capacitor/core';

export const appOrigin = import.meta.env.VITE_APP_ORIGIN || 'https://chat.evaonline.ir';

const isNativeShell = Capacitor.isNativePlatform() || window.location.protocol === 'file:';

export const apiOrigin = import.meta.env.VITE_API_URL || (isNativeShell ? appOrigin : '');
export const socketOrigin = import.meta.env.VITE_SOCKET_URL || (isNativeShell ? appOrigin : window.location.origin);
