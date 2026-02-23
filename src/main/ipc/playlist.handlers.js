// ─── Playlist Cover Image Management IPC Handlers ───

import { app, dialog } from 'electron';
import fs from 'fs';
import path from 'path';

function getCoversDir() {
  const dir = path.join(app.getPath('userData'), 'playlist-covers');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function register(ipcMain, deps) {
  const { getMainWindow } = deps;

  ipcMain.handle('playlist:pickImage', async () => {
    const mainWindow = getMainWindow();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose playlist cover image',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('playlist:saveImage', async (_event, playlistId, sourcePath) => {
    try {
      const coversDir = getCoversDir();
      const ext = path.extname(sourcePath) || '.jpg';
      const destName = `${playlistId}_${Date.now()}${ext}`;
      const destPath = path.join(coversDir, destName);
      fs.copyFileSync(sourcePath, destPath);
      return destPath;
    } catch (err) {
      console.error('Save cover image error:', err);
      return null;
    }
  });

  ipcMain.handle('playlist:deleteImage', async (_event, imagePath) => {
    try {
      if (imagePath && fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
      return true;
    } catch (err) {
      console.error('Delete cover image error:', err);
      return false;
    }
  });
}
