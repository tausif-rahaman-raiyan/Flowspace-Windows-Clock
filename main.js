const { app, BrowserWindow, shell, ipcMain, screen } = require('electron');
const path = require('path');

let win = null;
let miniWin = null;

function createWindow () {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Open external links in user's default OS browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  win.on('closed', () => {
    win = null;
    if (miniWin && !miniWin.isDestroyed()) {
      miniWin.close();
    }
  });
}

function createMiniWindow () {
  if (miniWin && !miniWin.isDestroyed()) {
    miniWin.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  miniWin = new BrowserWindow({
    width: 290,
    height: 165,
    x: Math.max(20, width - 320),
    y: Math.max(20, height - 195),
    minWidth: 240,
    minHeight: 140,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  miniWin.setAlwaysOnTop(true, 'screen-saver');
  miniWin.setVisibleOnAllWorkspaces(true);

  miniWin.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  miniWin.loadFile(path.join(__dirname, 'src', 'mini.html'));

  miniWin.on('closed', () => {
    miniWin = null;
    if (win && !win.isDestroyed()) {
      win.webContents.send('mini-overlay-closed');
    }
  });
}

// IPC Handlers
ipcMain.on('open-external', (event, url) => {
  if (url && (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:'))) {
    shell.openExternal(url);
  }
});

ipcMain.on('toggle-mini-overlay', () => {
  if (miniWin && !miniWin.isDestroyed()) {
    miniWin.close();
    miniWin = null;
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
    }
  } else {
    createMiniWindow();
  }
});

ipcMain.on('timer-sync-to-mini', (event, state) => {
  if (miniWin && !miniWin.isDestroyed()) {
    miniWin.webContents.send('timer-sync-from-main', state);
  }
});

ipcMain.on('timer-action-from-mini', (event, action) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('timer-action-to-main', action);
  }
});

ipcMain.on('restore-main-window', () => {
  if (miniWin && !miniWin.isDestroyed()) {
    miniWin.close();
    miniWin = null;
  }
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
