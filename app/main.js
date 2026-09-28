// BlockyMod Studio - Electron hoofdproces
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b0d12',
    title: 'BlockyMod Studio',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Sla een ZIP op via het opslaan-dialoog (gebruikt door de renderer)
ipcMain.handle('save-zip', async (event, suggestedName, base64Data) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    title: 'Mod exporteren',
    defaultPath: path.join(app.getPath('documents'), suggestedName || 'mod.zip'),
    filters: [{ name: 'ZIP-archief', extensions: ['zip'] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(result.filePath, Buffer.from(base64Data, 'base64'));
    return { ok: true, path: result.filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// Open een map in de verkenner (na export)
ipcMain.handle('open-path', async (event, target) => {
  if (!target || !fs.existsSync(target)) return false;
  shellOpen(target);
  return true;
});

function shellOpen(target) {
  const { shell } = require('electron');
  shell.showItemInFolder(target);
}
