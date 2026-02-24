import { useEffect, useState, useCallback, useMemo } from 'preact/hooks';
import { lazy, Suspense } from 'preact/compat';
import { signal } from '@preact/signals';
import {
  currentView, isPlaying, volume,
  discordRpc, likedSongs,
  currentTrack, currentPlaylistId, animations, effects, theme, country,
  pendingRadioNav, cloudAccessToken, cloudRefreshToken,
  saveState, saveStateNow, loadState
} from '../state/index.js';

import { Titlebar } from './Titlebar.jsx';
import { Sidebar } from './Sidebar/Sidebar.jsx';
import { NowPlayingBar } from './NowPlayingBar/NowPlayingBar.jsx';
import { HomeView } from './views/HomeView.jsx';
import { SearchView } from './views/SearchView.jsx';
import { QueuePanel } from './overlays/QueuePanel.jsx';
import { showToast } from './shared/Toast.jsx';
import { Toast } from './shared/Toast.jsx';
import { ContextMenu } from './shared/ContextMenu.jsx';
import { PlaylistContextMenu } from './shared/PlaylistContextMenu.jsx';
import { InputModal } from './shared/InputModal.jsx';
import { PlaylistPickerModal } from './shared/PlaylistPickerModal.jsx';
import { Spinner } from './shared/Spinner.jsx';
import { useLikeTrack } from '../hooks/useLikeTrack.js';
import { usePlayback } from '../hooks/usePlayback.js';
import { NavigationProvider } from '../hooks/useNavigation.js';
import { VOLUME_SCALE, SEEK_STEP_S, VOLUME_STEP } from '../../shared/constants.js';

// ─── Lazy-loaded views & overlays ───
const ExploreView = lazy(() => import('./views/ExploreView.jsx').then(m => ({ default: m.ExploreView })));
const LibraryView = lazy(() => import('./views/LibraryView.jsx').then(m => ({ default: m.LibraryView })));
const PlaylistView = lazy(() => import('./views/PlaylistView.jsx').then(m => ({ default: m.PlaylistView })));
const AlbumView = lazy(() => import('./views/AlbumView.jsx').then(m => ({ default: m.AlbumView })));
const ArtistView = lazy(() => import('./views/ArtistView.jsx').then(m => ({ default: m.ArtistView })));
const SettingsView = lazy(() => import('./views/SettingsView.jsx').then(m => ({ default: m.SettingsView })));
const LyricsPanel = lazy(() => import('./overlays/LyricsPanel.jsx').then(m => ({ default: m.LyricsPanel })));
const VideoPlayer = lazy(() => import('./overlays/VideoPlayer.jsx').then(m => ({ default: m.VideoPlayer })));
const SpotifyImport = lazy(() => import('./overlays/SpotifyImport.jsx').then(m => ({ default: m.SpotifyImport })));

// View-specific navigation state
const albumViewState = signal(null); // { albumId, albumMeta }
const artistViewState = signal(null); // { artistId }
const playlistViewState = signal(null); // { playlist, isLiked }
const videoPlayerState = signal(null); // { videoId, title, artist }

function applyThemeToDOM(themeName) {
  if (themeName === 'dark') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', themeName);
  }
}

export function App() {
  const [initialized, setInitialized] = useState(false);
  const [queueVisible, setQueueVisible] = useState(false);
  const [lyricsVisible, setLyricsVisible] = useState(false);
  const [spotifyVisible, setSpotifyVisible] = useState(false);

  const {
    getAudio, playTrack, playFromList, playNext, playPrev, togglePlay,
    setVolumeLevel, toggleShuffle, toggleRepeat, updateMediaSession
  } = usePlayback();

  // ─── Initialization ───
  useEffect(() => {
    loadState();

    const audio = getAudio();
    if (audio) audio.volume = volume.value * VOLUME_SCALE;
    if (discordRpc.value) window.snowify.connectDiscord();
    applyThemeToDOM(theme.value);
    document.documentElement.classList.toggle('no-animations', !animations.value);
    document.documentElement.classList.toggle('no-effects', !effects.value);
    if (country.value) window.snowify.setCountry(country.value);
    window.snowify.onYtMusicInitError?.(() => {
      showToast('Music service failed to initialize — restart the app');
    });
    window.snowify.onTokensUpdated?.((tokens) => {
      cloudAccessToken.value = tokens.accessToken;
      cloudRefreshToken.value = tokens.refreshToken;
      saveState();
    });
    setInitialized(true);

    const flushState = () => saveStateNow();
    window.addEventListener('beforeunload', flushState);
    return () => window.removeEventListener('beforeunload', flushState);
  }, []);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      const audio = getAudio();
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          if (e.ctrlKey) playNext();
          else if (audio?.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + SEEK_STEP_S);
          break;
        case 'ArrowLeft':
          if (e.ctrlKey) playPrev();
          else if (audio?.duration) audio.currentTime = Math.max(0, audio.currentTime - SEEK_STEP_S);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolumeLevel(volume.value + VOLUME_STEP);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolumeLevel(volume.value - VOLUME_STEP);
          break;
        case '/':
          e.preventDefault();
          switchView('search');
          break;
        case 'Escape':
          if (videoPlayerState.value) videoPlayerState.value = null;
          break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ─── Like / Unlike (for mobile media session only) ───
  const handleLikeToggle = useLikeTrack();

  // ─── Expose playback controls for mobile media session ───
  const toggleLikeCurrentTrack = useCallback(() => {
    const track = currentTrack.value;
    if (track) {
      handleLikeToggle(track);
      // Sync liked state to mobile notification
      if (window.__mobileMediaSession) {
        const isLiked = likedSongs.value.some(t => t.id === track.id);
        window.__mobileMediaSession.setLiked(isLiked);
      }
    }
  }, [handleLikeToggle]);

  useEffect(() => {
    window.__snowifyPlayback = { togglePlay, playNext, playPrev, toggleLike: toggleLikeCurrentTrack };
    return () => { delete window.__snowifyPlayback; };
  }, [togglePlay, playNext, playPrev, toggleLikeCurrentTrack]);

  // ─── Navigation ───
  const switchView = useCallback((name) => {
    currentView.value = name;
    if (lyricsVisible) setLyricsVisible(false);
  }, [lyricsVisible]);

  const showPlaylistDetail = useCallback((playlist, isLiked) => {
    currentPlaylistId.value = playlist.id;
    playlistViewState.value = { playlist, isLiked };
    switchView('playlist');
  }, [switchView]);

  // ─── Radio navigation (from ContextMenu) ───
  useEffect(() => {
    const pl = pendingRadioNav.value;
    if (pl) {
      pendingRadioNav.value = null;
      showPlaylistDetail(pl, false);
    }
  }, [pendingRadioNav.value, showPlaylistDetail]);

  const showAlbumDetail = useCallback((albumId, albumMeta) => {
    albumViewState.value = { albumId, albumMeta };
    switchView('album');
  }, [switchView]);

  const openArtistPage = useCallback((artistId) => {
    if (!artistId) return;
    artistViewState.value = { artistId };
    switchView('artist');
  }, [switchView]);

  const openVideoPlayer = useCallback((videoId, title, artist) => {
    const audio = getAudio();
    if (isPlaying.value && audio) {
      audio.pause();
      isPlaying.value = false;
    }
    videoPlayerState.value = { videoId, title, artist };
  }, []);

  const closeVideoPlayer = useCallback(() => {
    videoPlayerState.value = null;
  }, []);

  const toggleLyrics = useCallback(() => {
    setLyricsVisible(v => !v);
    if (!lyricsVisible) setQueueVisible(false);
  }, [lyricsVisible]);

  const toggleQueue = useCallback(() => {
    setQueueVisible(v => !v);
    if (!queueVisible) setLyricsVisible(false);
  }, [queueVisible]);

  // ─── Album play ───
  const playAlbum = useCallback(async (albumId) => {
    try {
      showToast('Loading album...');
      const tracks = await window.snowify.albumTracks(albumId);
      if (tracks?.length) {
        playFromList(tracks, 0);
      } else {
        showToast('Could not load album tracks');
      }
    } catch (err) {
      console.error('Album play error:', err);
      showToast('Could not load album');
    }
  }, [playFromList]);

  // ─── Navigation context ───
  const nav = useMemo(() => ({
    playFromList, playAlbum, showAlbumDetail,
    openArtistPage, openVideoPlayer, showPlaylistDetail
  }), [playFromList, playAlbum, showAlbumDetail, openArtistPage, openVideoPlayer, showPlaylistDetail]);

  // ─── Floating search ───
  const showFloatingSearch = ['home', 'explore', 'library', 'artist', 'album', 'playlist'].includes(currentView.value);

  const view = currentView.value;
  const track = currentTrack.value;
  const hasPlayer = !!track;

  return (
    <NavigationProvider value={nav}>
      <Titlebar />

      <div id="app" className={hasPlayer ? '' : 'no-player'}>
        <Sidebar
          onNavigate={switchView}
          onShowPlaylist={showPlaylistDetail}
          onOpenSpotifyImport={() => setSpotifyVisible(true)}
        />

        <main id="main-content">
          {showFloatingSearch && (
            <div className="floating-search" onClick={() => switchView('search')}>
              <svg className="floating-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="7"/><path d="M16 16l4.5 4.5" strokeLinecap="round"/></svg>
              <span className="floating-search-text">Search</span>
            </div>
          )}

          <section className={`view${view === 'home' ? ' active' : ''}`} id="view-home">
            {initialized && view === 'home' && <HomeView />}
          </section>

          <section className={`view${view === 'search' ? ' active' : ''}`} id="view-search">
            {view === 'search' && <SearchView />}
          </section>

          <Suspense fallback={<Spinner />}>
            <section className={`view${view === 'explore' ? ' active' : ''}`} id="view-explore">
              {view === 'explore' && <ExploreView />}
            </section>

            <section className={`view${view === 'library' ? ' active' : ''}`} id="view-library">
              {view === 'library' && <LibraryView />}
            </section>

            <section className={`view${view === 'playlist' ? ' active' : ''}`} id="view-playlist">
              {view === 'playlist' && playlistViewState.value && (
                <PlaylistView
                  playlist={playlistViewState.value.playlist}
                  isLiked={playlistViewState.value.isLiked}
                />
              )}
            </section>

            <section className={`view${view === 'album' ? ' active' : ''}`} id="view-album">
              {view === 'album' && albumViewState.value && (
                <AlbumView
                  albumId={albumViewState.value.albumId}
                  albumMeta={albumViewState.value.albumMeta}
                />
              )}
            </section>

            <section className={`view${view === 'artist' ? ' active' : ''}`} id="view-artist">
              {view === 'artist' && artistViewState.value && (
                <ArtistView
                  artistId={artistViewState.value.artistId}
                />
              )}
            </section>

            <section className={`view${view === 'settings' ? ' active' : ''}`} id="view-settings">
              {view === 'settings' && <SettingsView />}
            </section>
          </Suspense>
        </main>
      </div>

      {hasPlayer && (
        <NowPlayingBar
          audio={getAudio()}
          onTogglePlay={togglePlay}
          onNext={playNext}
          onPrev={playPrev}
          onToggleShuffle={toggleShuffle}
          onToggleRepeat={toggleRepeat}
          onSetVolume={setVolumeLevel}
          onToggleLyrics={toggleLyrics}
          onToggleQueue={toggleQueue}
          onShowAlbum={showAlbumDetail}
        />
      )}

      <QueuePanel visible={queueVisible} onClose={() => setQueueVisible(false)} />

      <Suspense fallback={null}>
        {lyricsVisible && <LyricsPanel visible={lyricsVisible} onClose={() => setLyricsVisible(false)} audio={getAudio()} />}

        {videoPlayerState.value && (
          <VideoPlayer
            videoId={videoPlayerState.value.videoId}
            title={videoPlayerState.value.title}
            artist={videoPlayerState.value.artist}
            onClose={closeVideoPlayer}
          />
        )}

        {spotifyVisible && <SpotifyImport visible={spotifyVisible} onClose={() => setSpotifyVisible(false)} />}
      </Suspense>

      <ContextMenu />
      <PlaylistContextMenu />
      <Toast />
      <InputModal />
      <PlaylistPickerModal />
    </NavigationProvider>
  );
}
