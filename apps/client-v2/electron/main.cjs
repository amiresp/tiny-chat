const path = require('node:path');
const { app, BrowserWindow, Menu, Notification, Tray, ipcMain, nativeImage, shell } = require('electron');

const productionUrl = process.env.ELECTRON_APP_URL || `file://${path.join(__dirname, '../dist/index.html')}`;
const TRAY_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAw0lEQVR4nO2W0RGCQAxEA2MJWAI0JmVBY1CC9iBfDgdccuuZBFH26+Zgdh/JESA69e8qkJvq2/2ZGzD2VzFDvPhJMApSeoRLflEA7XDJdwNgFc75sy3w0gLA+uljOXAFhq6ioauy9iRBAKHha43uqQBYCgJo2sdmje6ltJhOXoeQaJ6Mx2jBCeAGkPp2aynM+a4KENlXYe0frYAVRMyXbYE2BOe3+0/pJdcYMUeU/RZotejtCmifjWQFwv57DSoW4Cc1AdEHVo2fRDnMAAAAAElFTkSuQmCC';

let mainWindow = null;
let tray = null;
let isQuitting = false;

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return tray;
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Verdant Chat V2');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Verdant Chat', click: showMainWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on('double-click', showMainWindow);
  return tray;
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#0f172a',
    title: 'Verdant Chat V2',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const developmentUrl = process.env.ELECTRON_DEV_URL;
  windowLoad(mainWindow, developmentUrl || productionUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function windowLoad(window, url) {
  if (/^https?:\/\//i.test(url)) {
    window.loadURL(url);
    return;
  }
  window.loadFile(path.join(__dirname, '../dist/index.html'));
}

ipcMain.on('tiny-chat:notify', (_event, payload = {}) => {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: String(payload.title || 'Verdant Chat'),
    body: String(payload.body || 'New message'),
    silent: false,
  });
  notification.on('click', () => {
    showMainWindow();
    mainWindow?.webContents.send('tiny-chat:notification-click', {
      chatId: payload.chatId || null,
      messageId: payload.messageId || null,
    });
  });
  notification.show();
});

app.setAppUserModelId('chat.verdant.v2');
app.whenReady().then(() => {
  createTray();
  createWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // Keep the Electron process alive in the system tray on Windows/Linux.
  if (process.platform === 'darwin') app.quit();
});

app.on('activate', showMainWindow);
