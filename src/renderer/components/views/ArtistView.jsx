import { useState, useEffect, useCallback } from 'preact/hooks';
import { followedArtists, saveState } from '../../state/index.js';
import { TrackList } from '../shared/TrackList.jsx';
import { AlbumCard } from '../shared/AlbumCard.jsx';
import { VideoCard } from '../shared/VideoCard.jsx';
import { ArtistCard } from '../shared/ArtistCard.jsx';
import { ScrollContainer } from '../shared/ScrollContainer.jsx';
import { Spinner } from '../shared/Spinner.jsx';
import { showToast } from '../shared/Toast.jsx';
import { HomeView } from './HomeView.jsx';

/**
 * ArtistView - Full artist page with banner, popular tracks, discography, videos, similar artists.
 *
 * Props:
 *   artistId           - the artist channel ID
 *   onPlayFromList     - callback(tracks, index)
 *   onShowAlbum        - callback(albumId, albumMeta)
 *   onOpenVideoPlayer  - callback(videoId, name, artist)
 *   onOpenArtist       - callback(artistId)
 *   onLike             - callback(track, buttonEl)
 *   onContextMenu      - callback(e, track)
 *   onDragStart        - callback(e, track)
 *   onAlbumPlay        - callback(albumId)
 *   onAlbumContextMenu - callback(e, albumId, albumMeta)
 */
export function ArtistView({
  artistId,
  onPlayFromList,
  onShowAlbum,
  onOpenVideoPlayer,
  onOpenArtist,
  onLike,
  onContextMenu,
  onDragStart,
  onAlbumPlay,
  onAlbumContextMenu
}) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [discoFilter, setDiscoFilter] = useState('all');
  const [avatarLoaded, setAvatarLoaded] = useState(false);

  const followed = followedArtists.value;

  useEffect(() => {
    let cancelled = false;

    async function fetchArtist() {
      setLoading(true);
      setInfo(null);
      setDiscoFilter('all');
      setAvatarLoaded(false);

      try {
        const result = await window.snowify.artistInfo(artistId);
        if (cancelled) return;
        setInfo(result);
      } catch (err) {
        console.error('Artist load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (artistId) fetchArtist();
    return () => { cancelled = true; };
  }, [artistId]);

  const isFollowed = followed.some(a => a.artistId === artistId);

  function handleFollow() {
    if (isFollowed) {
      followedArtists.value = followedArtists.value.filter(a => a.artistId !== artistId);
      showToast(`Unfollowed ${info?.name || 'artist'}`);
    } else {
      followedArtists.value = [
        ...followedArtists.value,
        { artistId, name: info?.name || '', avatar: info?.avatar || '' }
      ];
      showToast(`Following ${info?.name || 'artist'}`);
    }
    // Invalidate release cache
    HomeView._cachedReleases = null;
    HomeView._lastReleaseFetch = 0;
    saveState();
  }

  function handleShare() {
    navigator.clipboard.writeText(`https://music.youtube.com/channel/${artistId}`);
    showToast('Link copied to clipboard');
  }

  function handlePlayAll() {
    const popular = (info?.topSongs || []).slice(0, 5);
    if (popular.length && onPlayFromList) onPlayFromList(popular, 0);
  }

  function handlePlay(tracks, index) {
    if (onPlayFromList) onPlayFromList(tracks, index);
  }

  const handleAlbumClick = useCallback((albumId, album) => {
    if (onShowAlbum) onShowAlbum(albumId, album);
  }, [onShowAlbum]);

  const handleAlbumPlayClick = useCallback((albumId) => {
    if (onAlbumPlay) onAlbumPlay(albumId);
  }, [onAlbumPlay]);

  function handleVideoClick(video) {
    const id = video.videoId || video.id;
    const name = video.name || video.title;
    if (onOpenVideoPlayer) onOpenVideoPlayer(id, name, video.artist);
  }

  function handleSimilarArtistClick(aid) {
    if (onOpenArtist) onOpenArtist(aid);
  }

  if (loading) {
    return (
      <div>
        <div className="artist-banner" style={{ display: 'none' }}></div>
        <div className="artist-header">
          <img
            className="artist-avatar shimmer"
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
            alt=""
          />
          <h1 id="artist-name">Loading...</h1>
          <p id="artist-followers"></p>
        </div>
        <div id="artist-popular-tracks">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div>
        <div className="artist-header">
          <h1 id="artist-name">Artist not found</h1>
        </div>
        <div id="artist-popular-tracks">
          <div className="empty-state"><p>Could not load artist info.</p></div>
        </div>
      </div>
    );
  }

  const popular = (info.topSongs || []).slice(0, 5);
  const allReleases = [
    ...(info.topAlbums || []),
    ...(info.topSingles || [])
  ].sort((a, b) => (b.year || 0) - (a.year || 0));
  const filteredReleases = discoFilter === 'all'
    ? allReleases
    : allReleases.filter(a => a.type === discoFilter);
  const topVideos = info.topVideos || [];
  const livePerfs = info.livePerformances || [];
  const fansAlsoLike = info.fansAlsoLike || [];

  return (
    <div>
      {/* Banner */}
      {info.banner && (
        <div id="artist-banner" className="artist-banner">
          <img id="artist-banner-img" src={info.banner} alt="" />
        </div>
      )}

      {/* Header: Avatar + Name + Listeners */}
      <div className="artist-header">
        <img
          id="artist-avatar"
          className={`artist-avatar${avatarLoaded ? ' loaded' : ' shimmer'}`}
          src={info.avatar || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}
          alt=""
          onLoad={() => setAvatarLoaded(true)}
        />
        <h1 id="artist-name">{info.name}</h1>
        <p id="artist-followers">{info.monthlyListeners || ''}</p>
      </div>

      {/* Action buttons */}
      <div className="artist-actions">
        <button id="btn-artist-play-all" className="btn-primary" onClick={handlePlayAll}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7L8 5z" />
          </svg>
          Play
        </button>
        <button
          id="btn-artist-follow"
          className={`btn-secondary${isFollowed ? ' following' : ''}`}
          onClick={handleFollow}
        >
          {isFollowed ? 'Following' : 'Follow'}
        </button>
        <button id="btn-artist-share" className="btn-secondary" onClick={handleShare}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </button>
      </div>

      {/* Popular Tracks */}
      <div className="artist-section">
        <h2>Popular</h2>
        <div id="artist-popular-tracks">
          {popular.length > 0 ? (
            <TrackList
              tracks={popular}
              context="artist-popular"
              onPlay={handlePlay}
              onLike={onLike}
              onContextMenu={onContextMenu}
              onDragStart={onDragStart}
            />
          ) : (
            <div className="empty-state"><p>No tracks found for this artist.</p></div>
          )}
        </div>
      </div>

      {/* Discography */}
      {allReleases.length > 0 && (
        <div className="artist-section">
          <h2>Discography</h2>
          <div id="disco-filters" className="disco-filters">
            {['all', 'Album', 'Single'].map(filter => (
              <button
                key={filter}
                className={`disco-filter${discoFilter === (filter === 'all' ? 'all' : filter) ? ' active' : ''}`}
                data-filter={filter === 'all' ? 'all' : filter}
                onClick={() => setDiscoFilter(filter === 'all' ? 'all' : filter)}
              >
                {filter === 'all' ? 'All' : filter + 's'}
              </button>
            ))}
          </div>
          <div id="artist-discography">
            {filteredReleases.length > 0 ? (
              <ScrollContainer>
                <div className="album-scroll">
                  {filteredReleases.map(album => (
                    <AlbumCard
                      key={album.albumId}
                      album={album}
                      onPlay={handleAlbumPlayClick}
                      onClick={handleAlbumClick}
                      onContextMenu={onAlbumContextMenu}
                    />
                  ))}
                </div>
              </ScrollContainer>
            ) : (
              <div className="empty-state"><p>No releases found.</p></div>
            )}
          </div>
        </div>
      )}

      {/* Music Videos */}
      {topVideos.length > 0 && (
        <div className="artist-section" id="artist-videos-section">
          <h2>Music Videos</h2>
          <ScrollContainer>
            <div id="artist-videos" className="album-scroll">
              {topVideos.map(v => (
                <VideoCard
                  key={v.videoId}
                  video={v}
                  onClick={handleVideoClick}
                />
              ))}
            </div>
          </ScrollContainer>
        </div>
      )}

      {/* Live Performances */}
      {livePerfs.length > 0 && (
        <div className="artist-section" id="artist-live-section">
          <h2>Live Performances</h2>
          <ScrollContainer>
            <div id="artist-live" className="album-scroll">
              {livePerfs.map(v => (
                <VideoCard
                  key={v.videoId}
                  video={v}
                  onClick={handleVideoClick}
                />
              ))}
            </div>
          </ScrollContainer>
        </div>
      )}

      {/* Fans might also like */}
      {fansAlsoLike.length > 0 && (
        <div className="artist-section" id="artist-fans-section">
          <h2>Fans might also like</h2>
          <ScrollContainer>
            <div id="artist-fans" className="album-scroll similar-artists-scroll">
              {fansAlsoLike.map(a => (
                <ArtistCard
                  key={a.artistId}
                  artist={a}
                  onClick={handleSimilarArtistClick}
                />
              ))}
            </div>
          </ScrollContainer>
        </div>
      )}
    </div>
  );
}
