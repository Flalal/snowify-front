// ─── Auto-Update Service ───

import { autoUpdater } from 'electron-updater';

export function initUpdater(mainWindow) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  function send(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  }

  autoUpdater.on('update-available', (info) => {
    send('update-available', { version: info.version, releaseNotes: info.releaseNotes });
  });

  autoUpdater.on('update-not-available', () => {
    send('update-not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    send('download-progress', { percent: progress.percent });
  });

  autoUpdater.on('update-downloaded', () => {
    send('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err?.message || err);
  });

  autoUpdater.checkForUpdates().catch(() => {});
}
