// ─── YTMusic API instance ───

let ytmusic = null;

export async function initYTMusic() {
  const YTMusic = (await import('ytmusic-api')).default;
  ytmusic = new YTMusic();
  await ytmusic.initialize();
}

export function getYtMusic() {
  return ytmusic;
}
