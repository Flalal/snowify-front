import { signal } from '@preact/signals';
import { useRef, useEffect } from 'preact/hooks';
import { queue, queueIndex, isPlaying } from '../state/index.js';

// ─── Local signals ───
const lyricsVisible = signal(false);
const lyricsLines = signal([]);
const lyricsTrackId = signal(null);
const lastActiveLyricIdx = signal(-1);

let _lyricsSyncInterval = null;

// ─── LRC parser ───

export function parseLRC(lrcText) {
  const lines = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/;
  lrcText.split('\n').forEach(line => {
    const match = line.match(regex);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      let ms = parseInt(match[3]);
      if (match[3].length === 2) ms *= 10;
      const time = min * 60 + sec + ms / 1000;
      const text = match[4].trim();
      if (text) lines.push({ time, text });
    }
  });
  return lines.sort((a, b) => a.time - b.time);
}

// ─── Fetch and display lyrics ───

export async function fetchAndShowLyrics(track) {
  if (!track) return;
  const audio = document.getElementById('audio-player');

  lyricsTrackId.value = track.id;
  lyricsLines.value = [];
  lastActiveLyricIdx.value = -1;

  // Parse duration: try audio.duration first, then the track string "m:ss"
  let durationSec = null;
  if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
    durationSec = Math.round(audio.duration);
  } else if (track.duration) {
    const parts = track.duration.split(':');
    if (parts.length === 2) durationSec = parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }

  try {
    const result = await window.snowify.getLyrics(track.title, track.artist, track.album || '', durationSec);

    // Ensure we're still viewing the same track
    if (lyricsTrackId.value !== track.id) return;

    if (!result) {
      return { type: 'empty' };
    }

    if (result.synced) {
      lyricsLines.value = parseLRC(result.synced);
      startLyricsSync();
      return { type: 'synced', lines: lyricsLines.value };
    } else if (result.plain) {
      return { type: 'plain', text: result.plain };
    } else {
      return { type: 'empty' };
    }

  } catch (err) {
    console.error('Lyrics error:', err);
    if (lyricsTrackId.value === track.id) {
      return { type: 'error' };
    }
  }

  return { type: 'empty' };
}

// ─── Sync lyrics with audio playback ───

export function syncLyrics() {
  const audio = document.getElementById('audio-player');
  if (!lyricsLines.value.length || !lyricsVisible.value) return;
  const ct = audio.currentTime;

  // Find current line index
  let activeIdx = -1;
  for (let i = lyricsLines.value.length - 1; i >= 0; i--) {
    if (ct >= lyricsLines.value[i].time) {
      activeIdx = i;
      break;
    }
  }

  if (activeIdx === lastActiveLyricIdx.value) return;
  lastActiveLyricIdx.value = activeIdx;

  return activeIdx;
}

export function startLyricsSync() {
  stopLyricsSync();
  if (!lyricsLines.value.length) return;
  const audio = document.getElementById('audio-player');
  _lyricsSyncInterval = setInterval(() => {
    if (audio.paused) return;
    syncLyrics();
  }, 100);
}

export function stopLyricsSync() {
  if (_lyricsSyncInterval) {
    clearInterval(_lyricsSyncInterval);
    _lyricsSyncInterval = null;
  }
}

// ─── Toggle lyrics panel visibility ───

export function toggleLyrics() {
  lyricsVisible.value = !lyricsVisible.value;

  if (lyricsVisible.value) {
    const current = queue.value[queueIndex.value];
    if (current && lyricsTrackId.value !== current.id) {
      fetchAndShowLyrics(current);
    }
    startLyricsSync();
  } else {
    stopLyricsSync();
  }
}

// ─── Called when track changes ───

export function onTrackChanged(track) {
  lastActiveLyricIdx.value = -1;
  if (lyricsVisible.value) {
    fetchAndShowLyrics(track);
  } else {
    lyricsTrackId.value = null;
  }
}

// ─── The hook ───

export function useLyrics() {
  return {
    lyricsVisible,
    lyricsLines,
    lyricsTrackId,
    lastActiveLyricIdx,
    fetchAndShowLyrics,
    parseLRC,
    syncLyrics,
    startLyricsSync,
    stopLyricsSync,
    toggleLyrics,
    onTrackChanged
  };
}

export default useLyrics;
