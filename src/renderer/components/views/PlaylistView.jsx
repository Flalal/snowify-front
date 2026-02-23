import { useState } from 'preact/hooks';
import { playlists, likedSongs, saveState, currentView } from '../../state/index.js';
import { TrackList } from '../shared/TrackList.jsx';
import { showToast } from '../shared/Toast.jsx';
import { showInputModal } from '../shared/InputModal.jsx';
import { showContextMenu } from '../shared/ContextMenu.jsx';
import { shuffleArray } from '../../utils/shuffleArray.js';

/**
 * PlaylistView - Detail view for a playlist (liked songs or custom).
 *
 * Props:
 *   playlist       - the playlist object { id, name, tracks, coverImage? }
 *   isLiked        - whether this is the Liked Songs playlist
 *   onPlayFromList - callback(tracks, index)
 *   onLike         - callback(track, buttonEl)
 *   onContextMenu  - callback(e, track) (general context menu)
 *   onDragStart    - callback(e, track)
 */
export function PlaylistView({
  playlist,
  isLiked,
  onPlayFromList,
  onLike,
  onContextMenu,
  onDragStart
}) {
  // Force re-render key for after mutations
  const [renderKey, setRenderKey] = useState(0);

  if (!playlist) return null;

  // Get live tracks reference - for liked songs use signal, for custom use playlist object
  const tracks = isLiked ? likedSongs.value : playlist.tracks;

  function handlePlayAll() {
    if (tracks.length && onPlayFromList) onPlayFromList(tracks, 0);
  }

  function handleShuffle() {
    if (tracks.length && onPlayFromList) {
      onPlayFromList(shuffleArray([...tracks]), 0);
    }
  }

  async function handleRename() {
    if (isLiked) return;
    const newName = await showInputModal('Rename playlist', playlist.name);
    if (newName && newName !== playlist.name) {
      playlist.name = newName;
      saveState();
      showToast(`Renamed to "${playlist.name}"`);
      setRenderKey(k => k + 1);
    }
  }

  async function handleChangeCover() {
    if (isLiked) return;
    const filePath = await window.snowify.pickImage();
    if (!filePath) return;
    if (playlist.coverImage) {
      await window.snowify.deleteImage(playlist.coverImage);
    }
    const savedPath = await window.snowify.saveImage(playlist.id, filePath);
    if (savedPath) {
      playlist.coverImage = savedPath;
      saveState();
      showToast('Cover image updated');
      setRenderKey(k => k + 1);
    } else {
      showToast('Failed to save image');
    }
  }

  function handleDelete() {
    if (isLiked) return;
    if (confirm(`Delete "${playlist.name}"?\nThis cannot be undone.`)) {
      if (playlist.coverImage) window.snowify.deleteImage(playlist.coverImage);
      playlists.value = playlists.value.filter(p => p.id !== playlist.id);
      saveState();
      currentView.value = 'library';
      showToast(`Deleted "${playlist.name}"`);
    }
  }

  function handlePlay(trackList, index) {
    if (onPlayFromList) onPlayFromList(trackList, index);
  }

  function handlePlaylistTrackContextMenu(e, track) {
    showContextMenu(e, track, {
      onPlay: (t) => { if (onPlayFromList) onPlayFromList([t], 0); },
      onLike: (t) => { if (onLike) onLike(t, null); },
    });
  }

  // Build cover content
  function renderCover() {
    if (isLiked) {
      return (
        <div
          id="playlist-hero-cover"
          className="playlist-hero-cover"
          style={{ background: 'linear-gradient(135deg, #450af5, #c4efd9)' }}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="#fff">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      );
    }

    const hasCover = playlist.coverImage || tracks.length > 0;
    const bgStyle = hasCover ? {} : { background: 'linear-gradient(135deg, #450af5, #8e2de2)' };

    let coverContent;
    if (playlist.coverImage) {
      coverContent = <img src={`file://${encodeURI(playlist.coverImage)}`} alt="" />;
    } else if (tracks.length >= 4) {
      const thumbs = tracks.slice(0, 4).map(t => t.thumbnail);
      coverContent = (
        <div className="playlist-cover-grid playlist-cover-lg">
          {thumbs.map((t, i) => <img key={i} src={t} alt="" />)}
        </div>
      );
    } else if (tracks.length > 0) {
      coverContent = <img src={tracks[0].thumbnail} alt="" />;
    } else {
      coverContent = (
        <svg width="64" height="64" viewBox="0 0 24 24" fill="#535353">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      );
    }

    return (
      <div id="playlist-hero-cover" className="playlist-hero-cover" style={bgStyle}>
        {coverContent}
      </div>
    );
  }

  return (
    <div key={renderKey}>
      {/* Hero header */}
      <div className="playlist-hero">
        {renderCover()}
        <div className="playlist-hero-info">
          <div className="playlist-hero-label">PLAYLIST</div>
          <h1 id="playlist-hero-name">{playlist.name}</h1>
          <p id="playlist-hero-count">
            {tracks.length} song{tracks.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="playlist-actions">
        <button id="btn-play-all" className="btn-primary" onClick={handlePlayAll}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7L8 5z" />
          </svg>
          Play All
        </button>
        <button id="btn-shuffle-playlist" className="btn-secondary" onClick={handleShuffle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
          Shuffle
        </button>
        {!isLiked && (
          <>
            <button id="btn-rename-playlist" className="btn-secondary" onClick={handleRename}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Rename
            </button>
            <button id="btn-cover-playlist" className="btn-secondary" onClick={handleChangeCover}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Cover
            </button>
            <button
              id="btn-delete-playlist"
              className="btn-secondary"
              style={{ color: 'var(--red)', borderColor: 'var(--red, rgba(255,255,255,0.1))' }}
              onClick={handleDelete}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
              Delete
            </button>
          </>
        )}
      </div>

      {/* Track list */}
      <div id="playlist-tracks">
        {tracks.length > 0 ? (
          <TrackList
            tracks={tracks}
            context="playlist"
            onPlay={handlePlay}
            onLike={onLike}
            onContextMenu={handlePlaylistTrackContextMenu}
            onDragStart={onDragStart}
          />
        ) : (
          <div className="empty-state">
            <p>This playlist is empty</p>
            <p>Find songs you like and add them here</p>
          </div>
        )}
      </div>
    </div>
  );
}
