import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { playlists, likedSongs, queue, queueIndex, pendingRadioNav, saveState } from '../../state/index.js';
import { showToast } from './Toast.jsx';
import { escapeHtml } from '../../utils/escapeHtml.js';

const menuVisible = signal(false);
const menuX = signal(0);
const menuY = signal(0);
const menuTrack = signal(null);
const menuOptions = signal({});

/**
 * Show the context menu at the given position for a track.
 * options can contain:
 *   onPlay, onPlayNext, onAddQueue, onWatchVideo, onLike, onAddToPlaylist, onShare
 */
export function showContextMenu(e, track, options = {}) {
  e.preventDefault();
  menuTrack.value = track;
  menuOptions.value = options;
  menuX.value = e.clientX;
  menuY.value = e.clientY;
  menuVisible.value = true;
}

export function removeContextMenu() {
  menuVisible.value = false;
  menuTrack.value = null;
}

export function ContextMenu() {
  const menuRef = useRef(null);
  const track = menuTrack.value;
  const visible = menuVisible.value;
  const options = menuOptions.value;

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handler = () => {
      removeContextMenu();
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handler, { once: true });
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handler);
    };
  }, [visible]);

  // Reposition if overflowing
  useEffect(() => {
    if (!visible || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menuRef.current.style.left = (window.innerWidth - rect.width - 8) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menuRef.current.style.top = (window.innerHeight - rect.height - 8) + 'px';
    }
  }, [visible, menuX.value, menuY.value]);

  if (!visible || !track) return null;

  const isLiked = likedSongs.value.some(t => t.id === track.id);
  const playlistList = playlists.value;

  function handleAction(action, pid) {
    switch (action) {
      case 'play':
        if (options.onPlay) options.onPlay(track);
        break;
      case 'play-next':
        if (options.onPlayNext) {
          options.onPlayNext(track);
        } else {
          const q = [...queue.value];
          const idx = queueIndex.value;
          if (idx >= 0) {
            q.splice(idx + 1, 0, track);
          } else {
            q.push(track);
          }
          queue.value = q;
        }
        break;
      case 'add-queue':
        if (options.onAddQueue) {
          options.onAddQueue(track);
        } else {
          queue.value = [...queue.value, track];
        }
        break;
      case 'watch-video':
        if (options.onWatchVideo) options.onWatchVideo(track);
        break;
      case 'like':
        if (options.onLike) options.onLike(track);
        break;
      case 'add-to-playlist':
        if (options.onAddToPlaylist) options.onAddToPlaylist(pid, track);
        break;
      case 'start-radio': {
        const radioName = `Radio: ${track.title}`;
        const existing = playlists.value.find(p => p.name === radioName);
        if (existing) {
          pendingRadioNav.value = existing;
        } else {
          showToast('Creating radio...');
          window.snowify.getUpNexts(track.id).then(upNexts => {
            const newPlaylist = {
              id: 'pl_' + Date.now(),
              name: radioName,
              tracks: [track, ...upNexts].slice(0, 21),
            };
            playlists.value = [...playlists.value, newPlaylist];
            saveState();
            pendingRadioNav.value = newPlaylist;
          }).catch(() => {
            showToast('Failed to create radio');
          });
        }
        break;
      }
      case 'share':
        if (options.onShare) {
          options.onShare(track);
        } else {
          navigator.clipboard.writeText(
            track.url || `https://music.youtube.com/watch?v=${track.id}`
          );
        }
        break;
    }
    removeContextMenu();
  }

  // Build playlist section
  let playlistSection = null;
  if (playlistList.length >= 5) {
    // Submenu for many playlists
    playlistSection = (
      <>
        <div className="context-menu-divider" />
        <div
          className="context-menu-item context-menu-has-sub"
          onClick={(e) => e.stopPropagation()}
        >
          <span>Add to playlist</span>
          <span className="sub-arrow">{'\u25B8'}</span>
          <div className="context-submenu">
            {playlistList.map(p => (
              <div
                key={p.id}
                className="context-menu-item context-sub-item"
                data-action="add-to-playlist"
                data-pid={p.id}
                onClick={(e) => { e.stopPropagation(); handleAction('add-to-playlist', p.id); }}
              >
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  } else if (playlistList.length) {
    playlistSection = (
      <>
        <div className="context-menu-divider" />
        {playlistList.map(p => (
          <div
            key={p.id}
            className="context-menu-item"
            data-action="add-to-playlist"
            data-pid={p.id}
            onClick={() => handleAction('add-to-playlist', p.id)}
          >
            {p.name}
          </div>
        ))}
      </>
    );
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: menuX.value + 'px', top: menuY.value + 'px' }}
    >
      <div className="context-menu-item" data-action="play" onClick={() => handleAction('play')}>
        Play
      </div>
      <div className="context-menu-item" data-action="play-next" onClick={() => handleAction('play-next')}>
        Play Next
      </div>
      <div className="context-menu-item" data-action="add-queue" onClick={() => handleAction('add-queue')}>
        Add to Queue
      </div>
      <div className="context-menu-divider" />
      <div className="context-menu-item" data-action="watch-video" onClick={() => handleAction('watch-video')}>
        Watch Video
      </div>
      <div className="context-menu-item" data-action="like" onClick={() => handleAction('like')}>
        {isLiked ? 'Unlike' : 'Like'}
      </div>
      <div className="context-menu-item" data-action="start-radio" onClick={() => handleAction('start-radio')}>
        Start Radio
      </div>
      {playlistSection}
      <div className="context-menu-divider" />
      <div className="context-menu-item" data-action="share" onClick={() => handleAction('share')}>
        Copy Link
      </div>
    </div>
  );
}
