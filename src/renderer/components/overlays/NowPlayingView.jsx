import { useEffect, useState, useRef, useCallback } from 'preact/hooks';
import { currentTrack, isCurrentLiked, isLoading } from '../../state/index.js';
import { nowPlayingViewVisible, isCasting, castDevice, castPickerVisible, castPosition, castDuration } from '../../state/ui.js';
import { usePlaybackContext } from '../../hooks/usePlaybackContext.js';
import { useLikeTrack } from '../../hooks/useLikeTrack.js';
import { PlaybackControls } from '../NowPlayingBar/PlaybackControls.jsx';
import { ProgressBar } from '../NowPlayingBar/ProgressBar.jsx';
import { ArtistLink } from '../shared/ArtistLink.jsx';
import { formatTime } from '../../utils/formatTime.js';

export function NowPlayingView({ visible }) {
  const { getAudio, playNext, playPrev } = usePlaybackContext();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [show, setShow] = useState(false);
  const viewRef = useRef(null);
  const artRef = useRef(null);
  const touchRef = useRef({ startX: 0, startY: 0, currentX: 0, currentY: 0, swiping: false, started: false, direction: null });

  const audio = getAudio();
  const toggleLike = useLikeTrack();

  const animateClose = useCallback(() => {
    if (viewRef.current) {
      viewRef.current.style.transition = 'transform 0.35s ease-out';
      viewRef.current.style.transform = 'translateY(100%)';
      setTimeout(() => {
        nowPlayingViewVisible.value = false;
        if (viewRef.current) {
          viewRef.current.style.transform = '';
          viewRef.current.style.transition = '';
        }
      }, 350);
    } else {
      nowPlayingViewVisible.value = false;
    }
  }, []);

  // Entrance animation
  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setShow(true));
      });
    } else {
      setShow(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!audio) return;
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration || 0);
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    return () => audio.removeEventListener('timeupdate', onTimeUpdate);
  }, [audio]);

  // Swipe handling: native listener with { passive: false }
  // Detects direction on first significant movement:
  //   - Horizontal → track skip (artwork follows finger)
  //   - Vertical down → swipe-to-close (existing behavior)
  useEffect(() => {
    const el = viewRef.current;
    if (!el || !show) return;

    const onTouchMove = (e) => {
      if (!touchRef.current.started) return;
      const dx = e.touches[0].clientX - touchRef.current.startX;
      const dy = e.touches[0].clientY - touchRef.current.startY;

      // Lock direction on first significant movement
      if (!touchRef.current.direction) {
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          if (Math.abs(dx) > Math.abs(dy)) {
            touchRef.current.direction = 'horizontal';
          } else {
            const content = el.querySelector('.np-view-content');
            if (dy > 0 && (!content || content.scrollTop <= 0)) {
              touchRef.current.direction = 'vertical';
              touchRef.current.swiping = true;
            } else {
              // Scrolling up in content — don't hijack
              touchRef.current.started = false;
              return;
            }
          }
        } else {
          return;
        }
      }

      if (touchRef.current.direction === 'horizontal') {
        e.preventDefault();
        touchRef.current.currentX = e.touches[0].clientX;
        const art = artRef.current;
        if (art) {
          art.style.transition = 'none';
          art.style.transform = `translateX(${dx}px)`;
          art.style.opacity = Math.max(0.5, 1 - Math.abs(dx) / 300);
        }
      } else if (touchRef.current.direction === 'vertical') {
        e.preventDefault();
        touchRef.current.currentY = e.touches[0].clientY;
        const ddy = Math.max(0, touchRef.current.currentY - touchRef.current.startY);
        el.style.transition = 'none';
        el.style.transform = `translateY(${ddy}px)`;
      }
    };

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [show]);

  const track = currentTrack.value;
  const liked = isCurrentLiked.value;
  const loading = isLoading.value;

  if (!track) return null;

  const handleSeek = (ratio) => {
    if (isCasting.value) {
      window.snowify.castSeek(ratio * castDuration.value);
      return;
    }
    if (audio && audio.duration) {
      audio.currentTime = ratio * audio.duration;
    }
  };

  const handleLike = () => {
    toggleLike(track);
  };

  const handleTouchStart = (e) => {
    if (e.target.closest('button') || e.target.closest('.progress-bar')) return;
    touchRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      currentX: e.touches[0].clientX,
      currentY: e.touches[0].clientY,
      swiping: false,
      started: true,
      direction: null
    };
  };

  const handleTouchEnd = () => {
    const { direction, started } = touchRef.current;
    if (!started && !direction) return;
    touchRef.current.started = false;

    if (direction === 'horizontal') {
      const deltaX = touchRef.current.currentX - touchRef.current.startX;
      const art = artRef.current;
      if (art) {
        art.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
        art.style.transform = '';
        art.style.opacity = '';
      }
      if (Math.abs(deltaX) > 60) {
        if (deltaX < 0) playNext();
        else playPrev();
      }
      touchRef.current.direction = null;
      return;
    }

    if (!touchRef.current.swiping) {
      touchRef.current.direction = null;
      return;
    }
    touchRef.current.swiping = false;
    touchRef.current.direction = null;
    const deltaY = touchRef.current.currentY - touchRef.current.startY;
    if (viewRef.current) {
      viewRef.current.style.transition = 'transform 0.35s ease-out';
      if (deltaY > 120) {
        viewRef.current.style.transform = 'translateY(100%)';
        setTimeout(() => {
          nowPlayingViewVisible.value = false;
          if (viewRef.current) {
            viewRef.current.style.transform = '';
            viewRef.current.style.transition = '';
          }
        }, 350);
      } else {
        viewRef.current.style.transform = 'translateY(0)';
      }
    }
  };

  const handleTouchCancel = () => {
    touchRef.current.started = false;
    touchRef.current.swiping = false;
    touchRef.current.direction = null;
    const art = artRef.current;
    if (art) {
      art.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
      art.style.transform = '';
      art.style.opacity = '';
    }
    if (viewRef.current) {
      viewRef.current.style.transition = 'transform 0.35s ease-out';
      viewRef.current.style.transform = 'translateY(0)';
    }
  };

  return (
    <div
      ref={viewRef}
      className={`now-playing-view${show ? ' visible' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <div
        className="np-view-bg"
        style={{ backgroundImage: `url(${track.thumbnail})` }}
      />
      <div className="np-view-overlay" />

      <div className="np-view-content">
        {/* Drag indicator */}
        <div className="np-view-drag" onClick={animateClose}>
          <div className="np-view-pill" />
        </div>

        {/* Artwork — fills available space, swipe left/right to skip */}
        <div className="np-view-art-wrap">
          <img
            ref={artRef}
            className="np-view-art"
            src={track.thumbnail}
            alt={track.title}
          />
        </div>

        {/* Track info + like */}
        <div className="np-view-info">
          <div className="np-view-meta">
            <div className="np-view-title">{track.title}</div>
            <div className="np-view-artist">
              <ArtistLink track={track} />
            </div>
          </div>
          <button
            className={`np-view-like${liked ? ' liked' : ''}`}
            onClick={handleLike}
            aria-label="Like"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
        </div>

        {/* Progress */}
        <div className="np-view-progress">
          <ProgressBar
            currentTime={isCasting.value ? castPosition.value : currentTime}
            duration={isCasting.value ? castDuration.value : duration}
            onSeek={handleSeek}
          />
          <div className="np-view-times">
            <span>{formatTime(isCasting.value ? castPosition.value : currentTime)}</span>
            <span>{formatTime(isCasting.value ? castDuration.value : duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="np-view-controls">
          <PlaybackControls loading={loading} />
        </div>

        {/* Extras — cast */}
        <div className="np-view-extras">
          <button
            className={`icon-btn np-view-cast${isCasting.value ? ' casting' : ''}`}
            onClick={() => { castPickerVisible.value = true; }}
            title={isCasting.value ? `Casting to ${castDevice.value?.name}` : 'Cast'}
            aria-label="Cast to device"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
              <line x1="2" y1="20" x2="2.01" y2="20" />
            </svg>
          </button>
          {isCasting.value && castDevice.value && (
            <span className="np-view-cast-label">
              Casting to {castDevice.value.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
