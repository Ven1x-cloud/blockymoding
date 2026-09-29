const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('blockymoding', {
  isDesktop: true,
  saveZip: (suggestedName, base64) => ipcRenderer.invoke('save-zip', suggestedName, base64),
  openPath: (target) => ipcRenderer.invoke('open-path', target),
  appPull: () => ipcRenderer.invoke('app-pull'),
  appRelaunch: () => ipcRenderer.invoke('app-relaunch')
});
