const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tinyChatElectron', {
  isElectron: true,
  notify(payload) {
    ipcRenderer.send('tiny-chat:notify', payload || {});
  },
  onNotificationClick(callback) {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload || {});
    ipcRenderer.on('tiny-chat:notification-click', handler);
    return () => ipcRenderer.removeListener('tiny-chat:notification-click', handler);
  },
});
