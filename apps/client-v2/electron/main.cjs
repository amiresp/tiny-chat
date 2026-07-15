const path = require('node:path');
const { app, BrowserWindow, shell } = require('electron');

const productionUrl = process.env.ELECTRON_APP_URL || `file://${path.join(__dirname, '../dist/index.html')}`;

function createWindow() {
  const window = new BrowserWindow({
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
