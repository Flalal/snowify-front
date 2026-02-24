import { useEffect, useRef, useCallback } from 'preact/hooks';
import {
  queue, originalQueue, queueIndex, isPlaying, isLoading,
  shuffle, repeat, volume, autoplay, audioQuality, discordRpc,
  recentTracks, likedSongs, currentTrack, saveState
} from '../state/index.js';
import { shuffleArray } from '../utils/shuffleArray.js';
import { showToast } from '../components/shared/Toast.jsx';
import {
  VOLUME_SCALE, WATCHDOG_INTERVAL_MS, WATCHDOG_STALL_TICKS,
  QUEUE_MAX_SIZE, AUTOPLAY_ADD_COUNT, AUTOPLAY_MIN_POOL,
  RECENT_TRACKS_MAX, RESTART_THRESHOLD_S
} from '../../shared/constants.js';

export function usePlayback() {
  // ─── Refs ───
  const audioRef = useRef(null);
  const watchdogRef = useRef({ lastTime: -1, stallTicks: 0 });

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = document.getElementById('audio-player');
    }
    return audioRef.current;
  }, []);

  // ─── Internal helpers ───

  const addToRecent = useCallback((track) => {
    recentTracks.value = [track, ...recentTracks.value.filter(t => t.id !== track.id)].slice(0, RECENT_TRACKS_MAX);
    saveState();
  }, []);

  const updateDiscordPresence = useCallback((track) => {
    if (!discordRpc.value || !track) return;
    const audio = getAudio();
    const startMs = Date.now() - Math.floor((audio?.currentTime || 0) * 1000);
    const durationMs = track.durationMs || (audio?.duration ? Math.round(audio.duration * 1000) : 0);
    const data = { title: track.title, artist: track.artist, thumbnail: track.thumbnail || '', startTimestamp: startMs };
    if (durationMs) data.endTimestamp = startMs + durationMs;
    window.snowify.updatePresence(data);
  }, []);

  const clearDiscordPresence = useCallback(() => {
    if (!discordRpc.value) return;
    window.snowify.clearPresence();
  }, []);

  const updateMediaSession = useCallback((track) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        artwork: [{ src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }]
      });
      navigator.mediaSession.setActionHandler('play', () => { getAudio()?.play(); isPlaying.value = true; updateDiscordPresence(track); });
      navigator.mediaSession.setActionHandler('pause', () => { getAudio()?.pause(); isPlaying.value = false; clearDiscordPresence(); });
      navigator.mediaSession.setActionHandler('previoustrack', playPrev);
      navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }
    // Native mobile media session (Android notification controls)
    if (window.__mobileMediaSession) {
      window.__mobileMediaSession.update(track);
      const isLiked = likedSongs.value.some(t => t.id === track.id);
      window.__mobileMediaSession.setLiked(isLiked);
    }
  }, []);

  // ─── Playback functions ───

  const prefetchNextTrack = useCallback(() => {
    const nextIdx = queueIndex.value + 1;
    if (nextIdx >= queue.value.length) return;
    const next = queue.value[nextIdx];
    if (!next || (!next.url && !next.id)) return;
    const url = next.url || `https://music.youtube.com/watch?v=${next.id}`;
    window.snowify.getStreamUrl(url, audioQuality.value).catch(() => {});
  }, []);

  const playTrack = useCallback(async (track) => {
    const audio = getAudio();
    if (!audio) return;

    isLoading.value = true;
    showToast(`Loading: ${track.title}`);

    try {
      const directUrl = await window.snowify.getStreamUrl(track.url, audioQuality.value);
      audio.src = directUrl;
      audio.volume = volume.value * VOLUME_SCALE;
      audio.load();
      await audio.play();
      isPlaying.value = true;
      isLoading.value = false;
      addToRecent(track);
      updateDiscordPresence(track);
      saveState();
      prefetchNextTrack();
      updateMediaSession(track);
    } catch (err) {
      console.error('Playback error:', err);
      const msg = typeof err === 'string' ? err : (err.message || 'unknown error');
      showToast('Playback failed: ' + msg);
      isPlaying.value = false;
      isLoading.value = false;
      if (!playTrack._skipAdvance) {
        const nextIdx = queueIndex.value + 1;
        if (nextIdx < queue.value.length) {
          playTrack._skipAdvance = true;
          queueIndex.value = nextIdx;
          playTrack(queue.value[nextIdx]).finally(() => { playTrack._skipAdvance = false; });
        }
      }
    }
  }, []);

  const playFromList = useCallback((tracks, index) => {
    originalQueue.value = [...tracks];
    if (shuffle.value) {
      const picked = tracks[index];
      const rest = tracks.filter((_, i) => i !== index);
      shuffleArray(rest);
      queue.value = [picked, ...rest];
      queueIndex.value = 0;
    } else {
      queue.value = [...tracks];
      queueIndex.value = index;
    }
    playTrack(queue.value[queueIndex.value]);
  }, [playTrack]);

  const smartQueueFill = useCallback(async () => {
    const current = currentTrack.value;
    if (!current) return;
    showToast('Autoplay: finding similar songs...');
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
      const upNexts = await window.snowify.getUpNexts(current.id);
      addToPool(upNexts);
      if (pool.length < AUTOPLAY_MIN_POOL && current.artistId) {
        const info = await window.snowify.artistInfo(current.artistId);
        if (info) addToPool(info.topSongs || []);
      }
      if (!pool.length) {
        showToast('Autoplay: no similar songs found');
        isPlaying.value = false;
        return;
      }
      shuffleArray(pool);
      const maxAdd = Math.min(AUTOPLAY_ADD_COUNT, QUEUE_MAX_SIZE - queue.value.length);
      if (maxAdd <= 0) {
        const trim = Math.min(queueIndex.value, queue.value.length - (QUEUE_MAX_SIZE / 2));
        if (trim > 0) {
          queue.value = queue.value.slice(trim);
          queueIndex.value = queueIndex.value - trim;
        }
      }
      const newTracks = pool.slice(0, Math.max(maxAdd, AUTOPLAY_MIN_POOL));
      queue.value = [...queue.value, ...newTracks];
      queueIndex.value = queueIndex.value + 1;
      playTrack(queue.value[queueIndex.value]);
      showToast(`Autoplay: added ${newTracks.length} songs`);
    } catch (err) {
      console.error('Autoplay error:', err);
      showToast('Autoplay failed');
      isPlaying.value = false;
    }
  }, [playTrack]);

  const playNext = useCallback(() => {
    const audio = getAudio();
    if (!queue.value.length) return;

    if (repeat.value === 'one') {
      if (audio) { audio.currentTime = 0; audio.play(); }
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
  }, [playTrack, smartQueueFill]);

  const playPrev = useCallback(() => {
    const audio = getAudio();
    if (!queue.value.length) return;
    if (audio && audio.currentTime > RESTART_THRESHOLD_S) {
      audio.currentTime = 0;
      return;
    }
    let prevIdx = queueIndex.value - 1;
    if (prevIdx < 0) prevIdx = 0;
    queueIndex.value = prevIdx;
    playTrack(queue.value[prevIdx]);
  }, [playTrack]);

  const togglePlay = useCallback(() => {
    const audio = getAudio();
    if (isLoading.value || !audio || !audio.src) return;
    if (audio.paused) {
      audio.play();
      isPlaying.value = true;
      const track = currentTrack.value;
      if (track) updateDiscordPresence(track);
    } else {
      audio.pause();
      isPlaying.value = false;
      clearDiscordPresence();
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
    }
  }, []);

  const setVolumeLevel = useCallback((vol) => {
    const audio = getAudio();
    volume.value = Math.max(0, Math.min(1, vol));
    if (audio) audio.volume = volume.value * VOLUME_SCALE;
    saveState();
  }, []);

  const toggleShuffle = useCallback(() => {
    shuffle.value = !shuffle.value;
    if (queue.value.length > 1) {
      const current = currentTrack.value;
      if (shuffle.value) {
        originalQueue.value = [...queue.value];
        const rest = queue.value.filter((_, i) => i !== queueIndex.value);
        shuffleArray(rest);
        queue.value = [current, ...rest];
        queueIndex.value = 0;
      } else {
        const idx = originalQueue.value.findIndex(t => t.id === current?.id);
        queue.value = [...originalQueue.value];
        queueIndex.value = idx >= 0 ? idx : 0;
      }
    }
    saveState();
  }, []);

  const toggleRepeat = useCallback(() => {
    const modes = ['off', 'all', 'one'];
    const i = (modes.indexOf(repeat.value) + 1) % modes.length;
    repeat.value = modes[i];
    saveState();
  }, []);

  // ─── Audio event listeners ───
  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;

    const onEnded = () => playNext();
    const onError = () => {
      isPlaying.value = false;
      isLoading.value = false;
      clearDiscordPresence();
      showToast('Audio error — skipping to next track');
      const nextIdx = queueIndex.value + 1;
      if (nextIdx < queue.value.length) {
        queueIndex.value = nextIdx;
        playTrack(queue.value[nextIdx]);
      }
    };
    const onSeeked = () => {
      if (isPlaying.value) {
        const track = currentTrack.value;
        if (track) updateDiscordPresence(track);
      }
      syncPositionState();
    };
    const syncPositionState = () => {
      if ('mediaSession' in navigator && audio.duration && isFinite(audio.duration)) {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate,
          position: audio.currentTime
        });
      }
    };
    const onDurationChange = () => syncPositionState();
    const onTimeUpdate = () => syncPositionState();

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, []);

  // ─── Playback watchdog ───
  useEffect(() => {
    const handle = setInterval(() => {
      const audio = getAudio();
      if (!isPlaying.value || isLoading.value || !audio || audio.paused) {
        watchdogRef.current.lastTime = -1;
        watchdogRef.current.stallTicks = 0;
        return;
      }
      const ct = audio.currentTime;
      if (watchdogRef.current.lastTime >= 0 && ct === watchdogRef.current.lastTime && ct > 0) {
        watchdogRef.current.stallTicks++;
        if (watchdogRef.current.stallTicks >= WATCHDOG_STALL_TICKS) {
          console.warn('Watchdog: playback stalled at', ct, '— advancing');
          watchdogRef.current.stallTicks = 0;
          watchdogRef.current.lastTime = -1;
          showToast('Stream stalled — skipping to next');
          playNext();
        }
      } else {
        watchdogRef.current.stallTicks = 0;
      }
      watchdogRef.current.lastTime = ct;
    }, WATCHDOG_INTERVAL_MS);
    return () => clearInterval(handle);
  }, []);

  return {
    getAudio,
    playTrack, playFromList, playNext, playPrev, togglePlay,
    smartQueueFill, prefetchNextTrack,
    setVolumeLevel, toggleShuffle, toggleRepeat,
    updateMediaSession
  };
}
