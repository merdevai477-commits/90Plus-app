const STREAMIN_HOSTS = new Set(['streamin.link', 'streamin.me']);

/** Turn a Streamin watch page into the MP4, so the app plays the file itself. */
export function resolveHighlightPlaybackUrl(pageUrl: string): string {
  const trimmed = pageUrl.trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (STREAMIN_HOSTS.has(host) || host.endsWith('.streamin.link') || host.endsWith('.streamin.me')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
      if (/^[a-z0-9]+$/i.test(id)) {
        return `https://c-cdn.streamin.top/uploads/${id}.mp4`;
      }
    }
  } catch {
    return trimmed;
  }
  return trimmed.split('#')[0];
}

export function isDirectHighlightFile(url: string): boolean {
  return /\.(mp4|m3u8)(?:$|\?)/i.test(url);
}
