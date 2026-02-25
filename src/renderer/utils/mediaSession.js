import { isPlaying, likedSongs } from '../state/index.js';

export function updateMediaSession(track, { getAudio, playPrev, playNext }) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      artwork: [{ src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }]
    });
    navigator.mediaSession.setActionHandler('play', () => {
      getAudio()?.play();
      isPlaying.value = true;
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      getAudio()?.pause();
      isPlaying.value = false;
    });
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
  }
  // Native mobile media session (Android notification controls)
  if (window.__mobileMediaSession) {
    window.__mobileMediaSession.update(track);
    const isLiked = likedSongs.value.some((t) => t.id === track.id);
    window.__mobileMediaSession.setLiked(isLiked);
  }
}

export function syncPositionState(audio) {
  if ('mediaSession' in navigator && audio.duration && isFinite(audio.duration)) {
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate || 1,
        position: Math.min(audio.currentTime, audio.duration)
      });
    } catch (_) {
      // setPositionState can throw at track boundaries (position > duration due to float precision)
    }
  }
}
