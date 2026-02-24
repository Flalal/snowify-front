// ─── IPC Handler Middleware ───

// Generic wrapper: try/catch + log + fallback value
export function createHandler(channel, fn, fallback = null) {
  return async (event, ...args) => {
    try {
      return await fn(event, ...args);
    } catch (err) {
      console.error(`[IPC:${channel}]`, err);
      return fallback;
    }
  };
}

// Auth/sync wrapper: returns { ok: false, error } on failure
export function createOkHandler(channel, fn) {
  return async (event, ...args) => {
    try {
      return await fn(event, ...args);
    } catch (err) {
      console.error(`[IPC:${channel}]`, err);
      return { ok: false, error: err.message };
    }
  };
}
