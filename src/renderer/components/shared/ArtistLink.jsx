import { currentView } from '../../state/index.js';

/**
 * Renders clickable artist name(s) that navigate to an artist page.
 *
 * Props:
 *   - track: object with optional `artists` array, `artistId`, and `artist` string
 *
 * Each artist with an id becomes a clickable link; others render as plain text.
 * Replaces the old renderArtistLinks + bindArtistLinks pattern from the vanilla JS code.
 */
export function ArtistLink({ track }) {
  if (!track) return <span>Unknown Artist</span>;

  // Handler to navigate to the artist page
  function goToArtist(e, artistId) {
    e.stopPropagation();
    if (!artistId) return;
    // Set state for navigation; the parent App component will handle loading artist data
    currentView.value = 'artist';
    // Dispatch a custom event so the app layer can respond with the artist ID
    window.dispatchEvent(new CustomEvent('navigate-artist', { detail: { artistId } }));
  }

  // Multiple artists array
  if (track.artists && track.artists.length) {
    return (
      <>
        {track.artists.map((a, i) => {
          const isLast = i === track.artists.length - 1;
          if (a.id) {
            return (
              <span key={a.id || i}>
                <span
                  className="artist-link"
                  data-artist-id={a.id}
                  onClick={(e) => goToArtist(e, a.id)}
                >
                  {a.name}
                </span>
                {!isLast && ', '}
              </span>
            );
          }
          return (
            <span key={i}>
              {a.name}
              {!isLast && ', '}
            </span>
          );
        })}
      </>
    );
  }

  // Single artist with ID
  if (track.artistId) {
    return (
      <span
        className="artist-link"
        data-artist-id={track.artistId}
        onClick={(e) => goToArtist(e, track.artistId)}
      >
        {track.artist}
      </span>
    );
  }

  // Fallback: plain text
  return <span>{track.artist || 'Unknown Artist'}</span>;
}
