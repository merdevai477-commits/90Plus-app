const STREAMIN_HOSTS = new Set(['streamin.link', 'streamin.me']);
/** Streamin moved live files off c-cdn. Try the current host first, then the old one. */
const STREAMIN_CDN_HOSTS = ['w-cdn.streamin.top', 'c-cdn.streamin.top'];

export function streaminClipId(pageUrl: string): string | null {
  try {
    const parsed = new URL(pageUrl.trim());
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const cdnHost = STREAMIN_CDN_HOSTS.some((cdn) => host === cdn);
    const watchHost = STREAMIN_HOSTS.has(host) || host.endsWith('.streamin.link') || host.endsWith('.streamin.me');
    if (!cdnHost && !watchHost) return null;
    const id = parsed.pathname.split('/').filter(Boolean).pop()?.replace(/\.mp4$/i, '') ?? '';
    return /^[a-z0-9]+$/i.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function streaminPlaybackCandidates(pageUrl: string): string[] {
  const id = streaminClipId(pageUrl);
  if (!id) return [];
  return STREAMIN_CDN_HOSTS.map((host) => `https://${host}/uploads/${id}.mp4`);
}

/** Turn a Streamin watch page into the MP4, so the app plays the file itself. */
export function resolveHighlightPlaybackUrl(pageUrl: string): string {
  const trimmed = pageUrl.trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const candidates = streaminPlaybackCandidates(trimmed);
    if (candidates.length) return candidates[0];
  } catch {
    return trimmed;
  }
  return trimmed.split('#')[0];
}

export function isDirectHighlightFile(url: string): boolean {
  return /\.(mp4|m3u8)(?:$|\?)/i.test(url);
}

/** YouTube watch, share, shorts, and embed links. */
export function youtubeVideoId(pageUrl: string): string | null {
  try {
    const parsed = new URL(pageUrl.trim());
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
      return /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const fromQuery = parsed.searchParams.get('v');
      if (fromQuery && /^[\w-]{6,}$/.test(fromQuery)) return fromQuery;
      const parts = parsed.pathname.split('/').filter(Boolean);
      const marker = parts.findIndex((part) => part === 'embed' || part === 'shorts' || part === 'live');
      const id = marker >= 0 ? parts[marker + 1] ?? '' : '';
      return /^[\w-]{6,}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

/** Player-only embed. No watch-page title, share row, or recommendations. */
export function youtubeEmbedUrl(pageUrl: string): string | null {
  const id = youtubeVideoId(pageUrl);
  if (!id) return null;
  const params = new URLSearchParams({
    autoplay: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    controls: '1',
    iv_load_policy: '3',
    enablejsapi: '1',
    origin: 'https://90plus.pro',
  });
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

