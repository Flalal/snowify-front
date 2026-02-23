import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { playlists, currentView, currentPlaylistId, saveState } from '../../state/index.js';
import { showInputModal } from './InputModal.jsx';
import { removeContextMenu } from './ContextMenu.jsx';

const menuVisible = signal(false);
const menuX = signal(0);
const menuY = signal(0);
const menuPlaylist = signal(null);
const menuIndex = signal(0);
const menuTotal = signal(0);

export function showPlaylistContextMenu(e, playlist, index, total) {
  e.preventDefault();
  removeContextMenu();
  menuPlaylist.value = playlist;
  menuIndex.value = index;
  menuTotal.value = total;
  menuX.value = e.clientX;
  menuY.value = e.clientY;
  menuVisible.value = true;
}

export function removePlaylistContextMenu() {
  menuVisible.value = false;
  menuPlaylist.value = null;
}

export function PlaylistContextMenu() {
  const menuRef = useRef(null);
  const visible = menuVisible.value;
  const playlist = menuPlaylist.value;
  const index = menuIndex.value;
  const total = menuTotal.value;

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handler = () => {
      removePlaylistContextMenu();
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

  if (!visible || !playlist) return null;

  const isFirst = index === 0;
  const isLast = index === total - 1;

  async function handleRename() {
    const newName = await showInputModal('Rename playlist', playlist.name);
    if (newName) {
      const pls = [...playlists.value];
      pls[index] = { ...pls[index], name: newName };
      playlists.value = pls;
      saveState();
    }
    removePlaylistContextMenu();
  }

  function handleDelete() {
    const ok = confirm(`Delete "${playlist.name}"?`);
    if (ok) {
      playlists.value = playlists.value.filter(p => p.id !== playlist.id);
      saveState();
      if (currentPlaylistId.value === playlist.id) {
        currentView.value = 'library';
        currentPlaylistId.value = null;
      }
    }
    removePlaylistContextMenu();
  }

  function handleMoveUp() {
    if (isFirst) return;
    const pls = [...playlists.value];
    [pls[index - 1], pls[index]] = [pls[index], pls[index - 1]];
    playlists.value = pls;
    saveState();
    removePlaylistContextMenu();
  }

  function handleMoveDown() {
    if (isLast) return;
    const pls = [...playlists.value];
    [pls[index], pls[index + 1]] = [pls[index + 1], pls[index]];
    playlists.value = pls;
    saveState();
    removePlaylistContextMenu();
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: menuX.value + 'px', top: menuY.value + 'px' }}
    >
      <div className="context-menu-item" onClick={handleRename}>
        Rename
      </div>
      <div className="context-menu-item" onClick={handleDelete}>
        Delete
      </div>
      <div className="context-menu-divider" />
      <div
        className={`context-menu-item${isFirst ? ' context-menu-item-disabled' : ''}`}
        onClick={handleMoveUp}
      >
        Move Up
      </div>
      <div
        className={`context-menu-item${isLast ? ' context-menu-item-disabled' : ''}`}
        onClick={handleMoveDown}
      >
        Move Down
      </div>
    </div>
  );
}
