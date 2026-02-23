const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('snowify', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // YouTube Music
  search: (query, musicOnly) => ipcRenderer.invoke('yt:search', query, musicOnly),
  searchArtists: (query) => ipcRenderer.invoke('yt:searchArtists', query),
  getStreamUrl: (videoUrl, quality) => ipcRenderer.invoke('yt:getStreamUrl', videoUrl, quality),
  artistInfo: (artistId) => ipcRenderer.invoke('yt:artistInfo', artistId),
  albumTracks: (albumId) => ipcRenderer.invoke('yt:albumTracks', albumId),
  getUpNexts: (videoId) => ipcRenderer.invoke('yt:getUpNexts', videoId),
  getVideoStreamUrl: (videoId, quality, premuxed) =>
    ipcRenderer.invoke('yt:getVideoStreamUrl', videoId, quality, premuxed),
  explore: () => ipcRenderer.invoke('yt:explore'),
  charts: () => ipcRenderer.invoke('yt:charts'),
  browseMood: (browseId, params) => ipcRenderer.invoke('yt:browseMood', browseId, params),
  setCountry: (code) => ipcRenderer.invoke('yt:setCountry', code),
  getLyrics: (trackName, artistName, albumName, duration) =>
    ipcRenderer.invoke('lyrics:get', trackName, artistName, albumName, duration),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Playlist covers
  pickImage: () => ipcRenderer.invoke('playlist:pickImage'),
  saveImage: (playlistId, sourcePath) =>
    ipcRenderer.invoke('playlist:saveImage', playlistId, sourcePath),
  deleteImage: (imagePath) => ipcRenderer.invoke('playlist:deleteImage', imagePath),

  // Spotify import (CSV)
  spotifyPickCsv: () => ipcRenderer.invoke('spotify:pickCsv'),
  spotifyMatchTrack: (title, artist) =>
    ipcRenderer.invoke('spotify:matchTrack', title, artist),

  // Discord RPC
  connectDiscord: () => ipcRenderer.invoke('discord:connect'),
  disconnectDiscord: () => ipcRenderer.invoke('discord:disconnect'),
  updatePresence: (data) => ipcRenderer.invoke('discord:updatePresence', data),
  clearPresence: () => ipcRenderer.invoke('discord:clearPresence'),

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, info) => cb(info)),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_, info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_, info) => cb(info)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', () => cb()),
  onUpdateError: (cb) => ipcRenderer.on('update-error', (_, info) => cb(info)),
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('update-error');
  },
  getAppVersion: () => ipcRenderer.invoke('app:version')
})
