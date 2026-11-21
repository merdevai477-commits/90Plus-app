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

/** Prefer owned CDN / direct MP4 before YouTube embeds (fewer false geo blocks). */
export function preferDirectHighlightUrls(urls: string[]): string[] {
  const score = (url: string): number => {
    if (/\.mp4(?:$|\?)|streamin\.|media\.90plus|r2\.cloudflarestorage/i.test(url)) return 0;
    if (youtubeVideoId(url)) return 2;
    return 1;
  };
  return [...urls].sort((a, b) => score(a) - score(b));
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

const YOUTUBE_EMBED_ORIGIN = 'https://90plus.pro';

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
    origin: YOUTUBE_EMBED_ORIGIN,
    widget_referrer: YOUTUBE_EMBED_ORIGIN,
  });
  // youtube-nocookie reduces some embed/claim edge cases in WKWebView.
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

/**
 * Local page so the WebView sends a Referer and the embed is allowed to paint.
 * Uses the IFrame API so iOS can report PLAYER_READY / PLAYING / typed errors
 * instead of treating the wrapper HTML load as "video ready".
 *
 * Important: rights-claimed clips often show a *false* "unavailable in your country"
 * inside WKWebView when eurl/referer is missing. base + origin + widget_referrer
 * mitigate that; failures still fall through to Open in YouTube.
 */
export function youtubeEmbedDocument(videoId: string): string {
  const id = videoId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `<!DOCTYPE html><html><head><base href="${YOUTUBE_EMBED_ORIGIN}/"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#player{position:absolute;inset:0;width:100%;height:100%}</style></head><body><div id="player"></div><script>
window.__HL_VID='${id}';
var tag=document.createElement('script');
tag.src='https://www.youtube.com/iframe_api';
document.head.appendChild(tag);
function post(reason){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage('reason:'+reason+':${id}:'+location.href);}catch(e){}}
function onYouTubeIframeAPIReady(){
  try{
    new YT.Player('player',{
      width:'100%',height:'100%',videoId:'${id}',
      host:'https://www.youtube-nocookie.com',
      playerVars:{autoplay:1,playsinline:1,rel:0,modestbranding:1,controls:1,iv_load_policy:3,enablejsapi:1,origin:'${YOUTUBE_EMBED_ORIGIN}',widget_referrer:'${YOUTUBE_EMBED_ORIGIN}'},
      events:{
        onReady:function(e){try{e.target.playVideo();}catch(x){}post('PLAYER_READY');},
        onStateChange:function(e){if(e&&e.data===1)post('PLAYING');},
        onError:function(e){var c=String(e&&e.data);post(c==='100'?'SOURCE_NOT_FOUND':'EMBED_UNAVAILABLE');}
      }
    });
  }catch(err){post('EMBED_UNAVAILABLE');}
}
</script></body></html>`;
}

