// ─── Lyrics (Musixmatch + LrcLib + Netease via SyncLyrics) ───

import { SyncLyrics } from '@stef-0012/synclyrics';

let _mxmTokenData = null;

// LRU-limited cache for lyrics (max 50 entries)
const _lyricsCache = new Map();
const _lyricsCacheLimit = 50;
const lyricsCacheProxy = {
  get(key) { return _lyricsCache.get(key); },
  set(key, value) {
    if (_lyricsCache.size >= _lyricsCacheLimit) {
      const oldest = _lyricsCache.keys().next().value;
      _lyricsCache.delete(oldest);
    }
    _lyricsCache.set(key, value);
  },
  has(key) { return _lyricsCache.has(key); },
  delete(key) { return _lyricsCache.delete(key); },
  clear() { _lyricsCache.clear(); },
  get size() { return _lyricsCache.size; }
};

export const lyricsManager = new SyncLyrics({
  cache: lyricsCacheProxy,
  logLevel: 'none',
  sources: ['musixmatch', 'lrclib', 'netease'],
  saveMusixmatchToken: (tokenData) => { _mxmTokenData = tokenData; },
  getMusixmatchToken: () => _mxmTokenData,
});
