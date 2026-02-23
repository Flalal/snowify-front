// ─── Auto-Update IPC Handlers ───

import { autoUpdater } from 'electron-updater';

export function register(ipcMain) {
  ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates());
  ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate());
  ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall());
}
