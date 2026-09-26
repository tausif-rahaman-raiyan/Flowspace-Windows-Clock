const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openExternal: (url) => ipcRenderer.send('open-external', url),
  toggleMiniOverlay: () => ipcRenderer.send('toggle-mini-overlay'),
  syncTimerToMini: (data) => ipcRenderer.send('timer-sync-to-mini', data),
  onTimerSyncFromMain: (callback) => ipcRenderer.on('timer-sync-from-main', (e, val) => callback(val)),
  sendTimerActionFromMini: (action) => ipcRenderer.send('timer-action-from-mini', action),
  onTimerActionToMain: (callback) => ipcRenderer.on('timer-action-to-main', (e, val) => callback(val)),
  restoreMainWindow: () => ipcRenderer.send('restore-main-window'),
  onMiniClosed: (callback) => ipcRenderer.on('mini-overlay-closed', () => callback())
});
