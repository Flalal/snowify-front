import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import { playlists, saveState } from '../state/index.js';
import { showToast } from '../state/ui.js';

const BATCH_SIZE = 3;

export function useSpotifyImport(onClose) {
  const [step, setStep] = useState('select'); // 'select' | 'progress'
  const [error, setError] = useState('');
  const [pendingPlaylists, setPendingPlaylists] = useState(null);
  const [modalTitle, setModalTitle] = useState('Import Spotify Playlists');
  const [startDisabled, setStartDisabled] = useState(true);
  const [startText, setStartText] = useState('Import');
  const [progressFill, setProgressFill] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [progressCount, setProgressCount] = useState('');
  const [trackItems, setTrackItems] = useState([]);
  const [showDoneButtons, setShowDoneButtons] = useState(false);

  const cancelledRef = useRef(false);

  function createPlaylist(name) {
    const id = 'pl_' + Date.now();
    const playlist = { id, name: name || `My Playlist #${playlists.value.length + 1}`, tracks: [] };
    playlists.value = [...playlists.value, playlist];
    saveState();
    showToast(`Created "${playlist.name}"`);
    return playlist;
  }

  function resetModal() {
    setStep('select');
    setError('');
    setPendingPlaylists(null);
    setModalTitle('Import Spotify Playlists');
    setStartDisabled(true);
    setStartText('Import');
    setProgressFill(0);
    setProgressText('');
    setProgressCount('');
    setTrackItems([]);
    setShowDoneButtons(false);
  }

  const cleanup = useCallback(() => {
    cancelledRef.current = true;
    resetModal();
    if (onClose) onClose();
  }, [onClose]);

  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      cleanup();
    }
  }, [cleanup]);

  const handleExportifyLink = useCallback((e) => {
    e.preventDefault();
    window.snowify.openExternal('https://playlistexport.com');
  }, []);

  const handlePickFiles = useCallback(async () => {
    const result = await window.snowify.spotifyPickCsv();
    if (!result || !result.length) return;

    setPendingPlaylists(prev => {
      const existing = prev || [];
      const existingNames = new Set(existing.map(p => p.name));
      const newOnes = result.filter(p => !existingNames.has(p.name));
      return [...existing, ...newOnes];
    });
    setStartDisabled(false);
    setError('');
  }, []);

  const handleRemoveFile = useCallback((index) => {
    setPendingPlaylists(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (!updated.length) {
        setStartDisabled(true);
        return null;
      }
      return updated;
    });
  }, []);

  const handleStart = useCallback(async () => {
    if (!pendingPlaylists || !pendingPlaylists.length) {
      setError('Please select at least one CSV file');
      return;
    }

    setError('');
    setStartDisabled(true);
    setStartText('Importing...');
    setStep('progress');

    cancelledRef.current = false;

    let totalImported = 0;
    let totalPlaylistCount = 0;
    const allFailedTracks = [];

    for (let pi = 0; pi < pendingPlaylists.length; pi++) {
      if (cancelledRef.current) break;

      const pl = pendingPlaylists[pi];

      if (pendingPlaylists.length > 1) {
        setModalTitle(`Importing ${pi + 1} of ${pendingPlaylists.length}: ${pl.name}`);
      } else {
        setModalTitle(pl.name);
      }

      setProgressFill(0);
      setProgressCount('');
      setProgressText('Matching tracks...');

      const total = pl.tracks.length;

      const initialItems = pl.tracks.map((t, i) => ({
        id: i,
        title: t.title,
        artist: t.artist,
        status: 'pending'
      }));
      setTrackItems([...initialItems]);

      const matchedTracks = [];
      const failedTracks = [];
      let matched = 0;
      let failed = 0;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        if (cancelledRef.current) break;

        const batch = pl.tracks.slice(i, Math.min(i + BATCH_SIZE, total));
        const promises = batch.map((t, bi) => {
          const idx = i + bi;
          return window.snowify.spotifyMatchTrack(t.title, t.artist)
            .catch(() => null)
            .then(result => ({ idx, result }));
        });

        const results = await Promise.all(promises);
        if (cancelledRef.current) break;

        const statusUpdates = {};
        for (const { idx, result } of results) {
          if (result) {
            matchedTracks.push(result);
            matched++;
            statusUpdates[idx] = 'matched';
          } else {
            failedTracks.push({ title: pl.tracks[idx].title, artist: pl.tracks[idx].artist });
            failed++;
            statusUpdates[idx] = 'unmatched';
          }
        }

        setTrackItems(prev => {
          const updated = [...prev];
          for (const [idx, status] of Object.entries(statusUpdates)) {
            updated[idx] = { ...updated[idx], status };
          }
          return updated;
        });

        const done = Math.min(i + BATCH_SIZE, total);
        setProgressCount(`${done} / ${total}`);
        setProgressFill((done / total) * 100);
        setProgressText(
          pendingPlaylists.length > 1
            ? `Playlist ${pi + 1}/${pendingPlaylists.length} \u2014 Matching tracks...`
            : 'Matching tracks...'
        );
      }

      if (cancelledRef.current) {
        if (matchedTracks.length) {
          const playlist = createPlaylist(pl.name);
          playlist.tracks = matchedTracks;
          playlists.value = playlists.value.map(p => p.id === playlist.id ? playlist : p);
          saveState();
        }
        break;
      }

      if (matchedTracks.length) {
        const playlist = createPlaylist(pl.name);
        playlist.tracks = matchedTracks;
        playlists.value = playlists.value.map(p => p.id === playlist.id ? playlist : p);
        saveState();
        totalImported += matched;
        totalPlaylistCount++;
      }

      allFailedTracks.push(...failedTracks);
      setProgressText(`Matched ${matched} of ${total}` + (failed ? ` (${failed} not found)` : ''));
    }

    if (cancelledRef.current) {
      showToast('Import cancelled');
      return;
    }

    if (pendingPlaylists.length > 1) {
      setModalTitle('Import Complete');
      setProgressText(`Imported ${totalPlaylistCount} playlist${totalPlaylistCount !== 1 ? 's' : ''} \u2014 ${totalImported} tracks total`);
      setProgressFill(100);
      setProgressCount('');
      showToast(`Imported ${totalPlaylistCount} playlist${totalPlaylistCount !== 1 ? 's' : ''} \u2014 ${totalImported} tracks`);
    } else if (totalPlaylistCount) {
      showToast(`Imported ${totalImported} tracks`);
    } else {
      showToast('No tracks could be matched');
    }

    if (allFailedTracks.length) {
      const failedItems = allFailedTracks.map((t, i) => ({
        id: `failed-${i}`,
        title: t.title,
        artist: t.artist,
        status: 'unmatched'
      }));
      setTrackItems([
        { id: 'failed-header', title: `Failed to match (${allFailedTracks.length})`, artist: '', status: 'header' },
        ...failedItems
      ]);
    } else {
      setTrackItems([]);
    }

    setShowDoneButtons(true);
  }, [pendingPlaylists]);

  // Cancel in-flight import on unmount
  useEffect(() => {
    return () => { cancelledRef.current = true; };
  }, []);

  const handleDone = useCallback(() => {
    cleanup();
    resetModal();
  }, [cleanup]);

  return {
    step, error, pendingPlaylists, modalTitle, startDisabled, startText,
    progressFill, progressText, progressCount, trackItems, showDoneButtons,
    cleanup, handleOverlayClick, handleExportifyLink,
    handlePickFiles, handleRemoveFile, handleStart, handleDone
  };
}
