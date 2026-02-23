// ─── YTMusic API instance ───

let ytmusic = null;

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 8000];

export async function initYTMusic() {
  const YTMusic = (await import('ytmusic-api')).default;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      ytmusic = new YTMusic();
      await ytmusic.initialize();
      return;
    } catch (err) {
      console.error(`YTMusic init attempt ${attempt + 1}/${MAX_RETRIES} failed:`, err.message);
      ytmusic = null;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }
  throw new Error('YTMusic initialization failed after all retries');
}

export function getYtMusic() {
  return ytmusic;
}
