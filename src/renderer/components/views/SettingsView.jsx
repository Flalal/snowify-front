import { useEffect, useState } from 'preact/hooks';
import {
  autoplay, audioQuality, videoQuality, videoPremuxed,
  animations, effects, theme, discordRpc, country,
  recentTracks, saveState,
  isPlaying, queue, queueIndex
} from '../../state/index.js';
import { showToast } from '../shared/Toast.jsx';
import { invalidateExploreCache } from './ExploreView.jsx';

function applyThemeToDOM(themeName) {
  if (themeName === 'dark') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', themeName);
  }
}

/**
 * SettingsView - Playback, video, appearance, and data settings.
 *
 * Props:
 *   onRenderHome - callback() to re-render home after clearing history
 */
export function SettingsView({ onRenderHome }) {
  // ── Auto-update state ──
  const [updateStatus, setUpdateStatus] = useState('idle'); // idle | checking | available | downloading | ready
  const [updateVersion, setUpdateVersion] = useState('');
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [appVersion, setAppVersion] = useState('');

  // Apply theme on mount + listen for update events
  useEffect(() => {
    applyThemeToDOM(theme.value);
    document.documentElement.classList.toggle('no-animations', !animations.value);
    document.documentElement.classList.toggle('no-effects', !effects.value);
    if (country.value) window.snowify.setCountry(country.value);

    window.snowify.getAppVersion().then((v) => setAppVersion(v));

    window.snowify.onUpdateAvailable((info) => {
      setUpdateVersion(info.version);
      setUpdateStatus('available');
    });
    window.snowify.onUpdateNotAvailable(() => {
      setUpdateStatus('idle');
    });
    window.snowify.onDownloadProgress((info) => {
      setDownloadPercent(Math.round(info.percent));
    });
    window.snowify.onUpdateDownloaded(() => {
      setUpdateStatus('ready');
    });
    window.snowify.onUpdateError((info) => {
      setUpdateStatus('available');
      showToast('Update error: ' + info.message);
    });

    return () => {
      window.snowify.removeUpdateListeners();
    };
  }, []);

  // ── Settings change handlers ──
  function handleAutoplayChange(e) {
    autoplay.value = e.currentTarget.checked;
    saveState();
  }

  async function handleDiscordRpcChange(e) {
    const checked = e.currentTarget.checked;
    discordRpc.value = checked;
    saveState();
    if (checked) {
      const ok = await window.snowify.connectDiscord();
      if (!ok) {
        showToast('Could not connect to Discord -- is it running?');
        discordRpc.value = false;
        saveState();
        return;
      }
      const track = queue.value[queueIndex.value];
      if (track && isPlaying.value) {
        window.snowify.updatePresence({
          title: track.title,
          artist: track.artist,
          thumbnail: track.thumbnail || '',
          startTimestamp: Date.now()
        });
      }
    } else {
      window.snowify.clearPresence();
      window.snowify.disconnectDiscord();
    }
  }

  function handleAudioQualityChange(e) {
    audioQuality.value = e.currentTarget.value;
    saveState();
  }

  function handleVideoQualityChange(e) {
    videoQuality.value = e.currentTarget.value;
    saveState();
  }

  function handleVideoPremuxedChange(e) {
    videoPremuxed.value = e.currentTarget.checked;
    saveState();
  }

  function handleAnimationsChange(e) {
    animations.value = e.currentTarget.checked;
    document.documentElement.classList.toggle('no-animations', !animations.value);
    saveState();
  }

  function handleEffectsChange(e) {
    effects.value = e.currentTarget.checked;
    document.documentElement.classList.toggle('no-effects', !effects.value);
    saveState();
  }

  function handleThemeChange(e) {
    theme.value = e.currentTarget.value;
    applyThemeToDOM(theme.value);
    saveState();
  }

  function handleCountryChange(e) {
    country.value = e.currentTarget.value;
    window.snowify.setCountry(country.value);
    invalidateExploreCache();
    saveState();
    if (country.value) {
      const select = e.currentTarget;
      const text = select.options[select.selectedIndex].text;
      showToast(`Explore region set to ${text}`);
    } else {
      showToast('Explore region cleared');
    }
  }

  function handleClearHistory() {
    if (confirm('Clear play history?')) {
      recentTracks.value = [];
      saveState();
      if (onRenderHome) onRenderHome();
      showToast('Play history cleared');
    }
  }

  async function handleCheckForUpdates() {
    setUpdateStatus('checking');
    try {
      await window.snowify.checkForUpdates();
    } catch {
      setUpdateStatus('idle');
    }
  }

  async function handleDownloadUpdate() {
    setUpdateStatus('downloading');
    setDownloadPercent(0);
    try {
      await window.snowify.downloadUpdate();
    } catch (err) {
      setUpdateStatus('available');
      showToast('Download failed: ' + (err?.message || 'unknown error'));
    }
  }

  function handleInstallUpdate() {
    window.snowify.installUpdate();
  }

  function handleResetAll() {
    if (confirm('Reset ALL data? This will delete all playlists, liked songs, and settings.')) {
      localStorage.removeItem('snowify_state');
      location.reload();
    }
  }

  return (
    <div className="settings-content">
      {/* ── Updates ── */}
      <div className="settings-section">
        <h2>Updates</h2>
        <div className="settings-row">
          <label>Current version</label>
          <span>Snowify {appVersion ? `v${appVersion}` : '...'}</span>
        </div>
        <div className="settings-row">
          {updateStatus === 'idle' && (
            <button className="btn-secondary" onClick={handleCheckForUpdates}>
              Check for updates
            </button>
          )}
          {updateStatus === 'checking' && (
            <span>Checking for updates...</span>
          )}
          {updateStatus === 'available' && (
            <>
              <span>v{updateVersion} available</span>
              <button className="btn-secondary" onClick={handleDownloadUpdate}>
                Download
              </button>
            </>
          )}
          {updateStatus === 'downloading' && (
            <span>Downloading... {downloadPercent}%</span>
          )}
          {updateStatus === 'ready' && (
            <button className="btn-secondary" onClick={handleInstallUpdate}>
              Restart & Update
            </button>
          )}
        </div>
      </div>

      {/* ── Country ── */}
      <div className="settings-section">
        <h2>Region</h2>
        <div className="settings-row">
          <label htmlFor="setting-country">Country</label>
          <select
            id="setting-country"
            className="settings-select"
            value={country.value || ''}
            onChange={handleCountryChange}
          >
            <option value="">Auto-detect</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
            <option value="DE">Germany</option>
            <option value="FR">France</option>
            <option value="JP">Japan</option>
            <option value="KR">South Korea</option>
            <option value="BR">Brazil</option>
            <option value="MX">Mexico</option>
            <option value="IN">India</option>
            <option value="ES">Spain</option>
            <option value="IT">Italy</option>
            <option value="NL">Netherlands</option>
            <option value="SE">Sweden</option>
            <option value="NO">Norway</option>
            <option value="DK">Denmark</option>
            <option value="FI">Finland</option>
            <option value="PL">Poland</option>
            <option value="RU">Russia</option>
            <option value="TR">Turkey</option>
            <option value="ID">Indonesia</option>
            <option value="PH">Philippines</option>
            <option value="TH">Thailand</option>
            <option value="VN">Vietnam</option>
            <option value="ZA">South Africa</option>
            <option value="NG">Nigeria</option>
            <option value="EG">Egypt</option>
            <option value="AR">Argentina</option>
            <option value="CL">Chile</option>
            <option value="CO">Colombia</option>
            <option value="PE">Peru</option>
          </select>
        </div>
      </div>

      {/* ── Playback Settings ── */}
      <div className="settings-section">
        <h2>Playback</h2>
        <div className="settings-row">
          <label htmlFor="setting-autoplay">Autoplay similar songs</label>
          <input
            id="setting-autoplay"
            type="checkbox"
            className="settings-toggle"
            checked={autoplay.value}
            onChange={handleAutoplayChange}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="setting-discord-rpc">Discord Rich Presence</label>
          <input
            id="setting-discord-rpc"
            type="checkbox"
            className="settings-toggle"
            checked={discordRpc.value}
            onChange={handleDiscordRpcChange}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="setting-quality">Audio quality</label>
          <select
            id="setting-quality"
            className="settings-select"
            value={audioQuality.value}
            onChange={handleAudioQualityChange}
          >
            <option value="bestaudio">Best</option>
            <option value="worstaudio">Low (save data)</option>
          </select>
        </div>
      </div>

      {/* ── Video Settings ── */}
      <div className="settings-section">
        <h2>Video</h2>
        <div className="settings-row">
          <label htmlFor="setting-video-quality">Video quality</label>
          <select
            id="setting-video-quality"
            className="settings-select"
            value={videoQuality.value}
            onChange={handleVideoQualityChange}
            disabled={videoPremuxed.value}
          >
            <option value="360">360p</option>
            <option value="480">480p</option>
            <option value="720">720p</option>
            <option value="1080">1080p</option>
          </select>
        </div>
        <div className="settings-row">
          <label htmlFor="setting-video-premuxed">Use premuxed streams (faster, lower quality)</label>
          <input
            id="setting-video-premuxed"
            type="checkbox"
            className="settings-toggle"
            checked={videoPremuxed.value}
            onChange={handleVideoPremuxedChange}
          />
        </div>
      </div>

      {/* ── Appearance Settings ── */}
      <div className="settings-section">
        <h2>Appearance</h2>
        <div className="settings-row">
          <label htmlFor="theme-select">Theme</label>
          <select
            id="theme-select"
            className="settings-select"
            value={theme.value}
            onChange={handleThemeChange}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="midnight">Midnight</option>
            <option value="catppuccin">Catppuccin</option>
            <option value="nord">Nord</option>
            <option value="dracula">Dracula</option>
            <option value="gruvbox">Gruvbox</option>
            <option value="solarized">Solarized</option>
            <option value="rosepine">Rose Pine</option>
          </select>
        </div>
        <div className="settings-row">
          <label htmlFor="setting-animations">Animations</label>
          <input
            id="setting-animations"
            type="checkbox"
            className="settings-toggle"
            checked={animations.value}
            onChange={handleAnimationsChange}
          />
        </div>
        <div className="settings-row">
          <label htmlFor="setting-effects">Visual effects</label>
          <input
            id="setting-effects"
            type="checkbox"
            className="settings-toggle"
            checked={effects.value}
            onChange={handleEffectsChange}
          />
        </div>
      </div>

      {/* ── Data Section ── */}
      <div className="settings-section">
        <h2>Data</h2>
        <div className="settings-row">
          <button id="setting-clear-history" className="btn-secondary" onClick={handleClearHistory}>
            Clear play history
          </button>
        </div>
        <div className="settings-row">
          <button
            id="setting-reset-all"
            className="btn-secondary"
            style={{ color: 'var(--red)' }}
            onClick={handleResetAll}
          >
            Reset all data
          </button>
        </div>
      </div>
    </div>
  );
}
