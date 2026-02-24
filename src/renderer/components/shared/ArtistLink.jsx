import { useNavigation } from '../../hooks/useNavigation.js';

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
  const { openArtistPage } = useNavigation();

  if (!track) return <span>Unknown Artist</span>;

  // Handler to navigate to the artist page
  function goToArtist(e, artistId) {
    e.stopPropagation();
    if (!artistId) return;
    openArtistPage(artistId);
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
