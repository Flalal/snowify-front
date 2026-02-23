// ─── Window & Shell IPC Handlers ───

import { shell } from 'electron';

export function register(ipcMain, deps) {
  const { getMainWindow } = deps;

  ipcMain.on('window:minimize', () => getMainWindow()?.minimize());
  ipcMain.on('window:maximize', () => {
    const mainWindow = getMainWindow();
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => getMainWindow()?.close());

  ipcMain.handle('shell:openExternal', async (_event, url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      await shell.openExternal(url);
    }
  });
}
