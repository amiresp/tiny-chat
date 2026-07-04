const { app, BrowserWindow, shell } = require('electron');

const productionUrl = process.env.ELECTRON_APP_URL || 'https://chat.evaonline.ir';

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  const developmentUrl = process.env.ELECTRON_DEV_URL;
  window.loadURL(developmentUrl || productionUrl);

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
