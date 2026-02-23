// ─── Pure formatting helpers ───

export function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds) || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getBestThumbnail(thumbnails) {
  if (!thumbnails?.length) return '';
  const sorted = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url || '';
}

export function getSquareThumbnail(thumbnails, size = 226) {
  const url = getBestThumbnail(thumbnails);
  if (!url) return '';
  if (url.includes('lh3.googleusercontent.com')) {
    return url.replace(/=(?:w\d+-h\d+|s\d+|p-w\d+).*$/, `=w${size}-h${size}-l90-rj`);
  }
  return url;
}
