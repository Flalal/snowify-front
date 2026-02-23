import { useRef, useEffect } from 'preact/hooks';
import {
  queue, originalQueue, queueIndex, isPlaying, isLoading,
  shuffle, repeat, autoplay, volume, audioQuality,
  discordRpc, recentTracks, likedSongs, saveState
} from '../state/index.js';

// ─── Shared singleton refs (only one watchdog / listener set across the app) ───
let _initialized = false;
let _watchdogLastTime = -1;
let _watchdogStallTicks = 0;
let _watchdogHandle = null;

// ─── Discord RPC helpers ───

export function updateDiscordPresence(track) {
  if (!discordRpc.value || !track) return;
  const audio = document.getElementById('audio-player');
  const startMs = Date.now() - Math.floor((audio.currentTime || 0) * 1000);
  const durationMs = track.durationMs || (audio.duration ? Math.round(audio.duration * 1000) : 0);
  const data = {
    title: track.title,
    artist: track.artist,
    thumbnail: track.thumbnail || '',
    startTimestamp: startMs
  };
  if (durationMs) {
    data.endTimestamp = startMs + durationMs;
  }
  window.snowify.updatePresence(data);
}

export function clearDiscordPresence() {
  if (!discordRpc.value) return;
  window.snowify.clearPresence();
}

// ─── Playback functions ───

export async function playTrack(track) {
  const audio = document.getElementById('audio-player');

  isLoading.value = true;

  try {
    const directUrl = await window.snowify.getStreamUrl(track.url, audioQuality.value);
    audio.src = directUrl;
    audio.volume = volume.value * 0.3;
    audio.load();
    await audio.play();
    isPlaying.value = true;
    isLoading.value = false;
    addToRecent(track);
    updateDiscordPresence(track);
    saveState();
    prefetchNextTrack();
  } catch (err) {
    console.error('Playback error:', err);
    const msg = typeof err === 'string' ? err : (err.message || 'unknown error');
    isPlaying.value = false;
    isLoading.value = false;
    // Auto-advance to next track on failure (avoid infinite loop via flag)
    if (!playTrack._skipAdvance) {
      const nextIdx = queueIndex.value + 1;
      if (nextIdx < queue.value.length) {
        playTrack._skipAdvance = true;
        queueIndex.value = nextIdx;
        playTrack(queue.value[nextIdx]).finally(() => { playTrack._skipAdvance = false; });
      }
    }
    return;
  }
}

export function prefetchNextTrack() {
  const nextIdx = queueIndex.value + 1;
  if (nextIdx >= queue.value.length) return;
  const next = queue.value[nextIdx];
  if (!next || (!next.url && !next.id)) return;
  const url = next.url || `https://music.youtube.com/watch?v=${next.id}`;
  // Fire-and-forget: this populates the main-process cache
  window.snowify.getStreamUrl(url, audioQuality.value).catch(() => {});
}

export function playFromList(tracks, index) {
  originalQueue.value = [...tracks];
  if (shuffle.value) {
    const picked = tracks[index];
    const rest = tracks.filter((_, i) => i !== index);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    queue.value = [picked, ...rest];
    queueIndex.value = 0;
  } else {
    queue.value = [...tracks];
    queueIndex.value = index;
  }
  playTrack(queue.value[queueIndex.value]);
}

export function playNext() {
  const audio = document.getElementById('audio-player');
  if (!queue.value.length) return;

  if (repeat.value === 'one') {
    audio.currentTime = 0;
    audio.play();
    isPlaying.value = true;
    return;
  }

  if (repeat.value === 'all') {
    let nextIdx = queueIndex.value + 1;
    if (nextIdx >= queue.value.length) nextIdx = 0;
    queueIndex.value = nextIdx;
    playTrack(queue.value[nextIdx]);
    return;
  }

  let nextIdx = queueIndex.value + 1;
  if (nextIdx >= queue.value.length) {
    if (autoplay.value) {
      smartQueueFill();
      return;
    }
    isPlaying.value = false;
    return;
  }
  queueIndex.value = nextIdx;
  playTrack(queue.value[nextIdx]);
}

export async function smartQueueFill() {
  const current = queue.value[queueIndex.value];
  if (!current) return;

  try {
    const queueIds = new Set(queue.value.map(t => t.id));
    const seen = new Set();
    let pool = [];

    const addToPool = (tracks) => {
      tracks.forEach(t => {
        if (!queueIds.has(t.id) && !seen.has(t.id)) {
          seen.add(t.id);
          pool.push(t);
        }
      });
    };

    // 1. YouTube Music's "Up Next" -- genre-aware recommendations from different artists
    const upNexts = await window.snowify.getUpNexts(current.id);
    addToPool(upNexts);

    // 2. Current artist's top songs as extra padding
    if (pool.length < 10 && current.artistId) {
      const info = await window.snowify.artistInfo(current.artistId);
      if (info) addToPool(info.topSongs || []);
    }

    if (!pool.length) {
      isPlaying.value = false;
      return;
    }

    // Shuffle and take up to 20
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const maxAdd = Math.min(20, 200 - queue.value.length);
    if (maxAdd <= 0) {
      // Trim oldest played tracks to make room
      const trim = Math.min(queueIndex.value, queue.value.length - 100);
      if (trim > 0) {
        queue.value = [...queue.value.slice(trim)];
        queueIndex.value = queueIndex.value - trim;
      }
    }
    const newTracks = pool.slice(0, Math.max(maxAdd, 10));

    queue.value = [...queue.value, ...newTracks];
    queueIndex.value = queueIndex.value + 1;
    playTrack(queue.value[queueIndex.value]);
  } catch (err) {
    console.error('Autoplay error:', err);
    isPlaying.value = false;
  }
}

export function playPrev() {
  const audio = document.getElementById('audio-player');
  if (!queue.value.length) return;
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  let prevIdx = queueIndex.value - 1;
  if (prevIdx < 0) prevIdx = 0;
  queueIndex.value = prevIdx;
  playTrack(queue.value[prevIdx]);
}

export function togglePlay() {
  const audio = document.getElementById('audio-player');
  if (isLoading.value) return;
  if (!audio.src) return;
  if (audio.paused) {
    audio.play();
    isPlaying.value = true;
    const track = queue.value[queueIndex.value];
    if (track) updateDiscordPresence(track);
  } else {
    audio.pause();
    isPlaying.value = false;
    clearDiscordPresence();
  }
}

export function seekTo(e, progressBar) {
  const audio = document.getElementById('audio-player');
  const rect = progressBar.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if (audio.duration) {
    audio.currentTime = pct * audio.duration;
  }
}

export function setVolume(vol) {
  const audio = document.getElementById('audio-player');
  volume.value = Math.max(0, Math.min(1, vol));
  audio.volume = volume.value * 0.3;
  saveState();
}

export function addToRecent(track) {
  recentTracks.value = [
    track,
    ...recentTracks.value.filter(t => t.id !== track.id)
  ];
  if (recentTracks.value.length > 20) {
    recentTracks.value = recentTracks.value.slice(0, 20);
  }
  saveState();
}

function updateMediaSession(track) {
  const audio = document.getElementById('audio-player');
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      artwork: [{ src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }]
    });
    navigator.mediaSession.setActionHandler('play', () => {
      audio.play();
      isPlaying.value = true;
      updateDiscordPresence(track);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio.pause();
      isPlaying.value = false;
      clearDiscordPresence();
    });
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
  }
}

// ─── The hook ───

export function useAudio() {
  const initRef = useRef(false);

  useEffect(() => {
    if (_initialized || initRef.current) return;
    initRef.current = true;
    _initialized = true;

    const audio = document.getElementById('audio-player');
    if (!audio) return;

    // Set initial volume
    audio.volume = volume.value * 0.3;

    // ── Audio event listeners ──
    audio.addEventListener('ended', playNext);

    audio.addEventListener('timeupdate', () => {
      // timeupdate is handled by components that read audio.currentTime
    });

    audio.addEventListener('seeked', () => {
      if (isPlaying.value) {
        const track = queue.value[queueIndex.value];
        if (track) updateDiscordPresence(track);
      }
    });

    audio.addEventListener('error', () => {
      isPlaying.value = false;
      isLoading.value = false;
      clearDiscordPresence();
      // Auto-advance on audio error
      const nextIdx = queueIndex.value + 1;
      if (nextIdx < queue.value.length) {
        queueIndex.value = nextIdx;
        playTrack(queue.value[nextIdx]);
      }
    });

    // ── Playback watchdog ──
    _watchdogHandle = setInterval(() => {
      // Only check when we think we're playing
      if (!isPlaying.value || isLoading.value || audio.paused) {
        _watchdogLastTime = -1;
        _watchdogStallTicks = 0;
        return;
      }
      const ct = audio.currentTime;
      if (_watchdogLastTime >= 0 && ct === _watchdogLastTime && ct > 0) {
        _watchdogStallTicks++;
        // ~8 seconds stalled, audio is stuck
        if (_watchdogStallTicks >= 4) {
          console.warn('Watchdog: playback stalled at', ct, '-- advancing');
          _watchdogStallTicks = 0;
          _watchdogLastTime = -1;
          playNext();
        }
      } else {
        _watchdogStallTicks = 0;
      }
      _watchdogLastTime = ct;
    }, 2000);

  }, []);

  return {
    playTrack,
    playFromList,
    playNext,
    playPrev,
    togglePlay,
    smartQueueFill,
    prefetchNextTrack,
    seekTo,
    setVolume,
    addToRecent,
    updateDiscordPresence,
    clearDiscordPresence
  };
}

export default useAudio;
