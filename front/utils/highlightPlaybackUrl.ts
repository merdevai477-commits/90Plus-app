const STREAMIN_HOSTS = new Set(['streamin.link', 'streamin.me']);
/** Streamin moved live files off c-cdn. Try the current host first, then the old one. */
const STREAMIN_CDN_HOSTS = ['w-cdn.streamin.top', 'c-cdn.streamin.top'];

export const YOUTUBE_EMBED_ORIGIN = 'https://90plus.pro';

/**
 * YouTube requires a non-empty HTTPS Referer in WebView embeds (Error 153 otherwise).
 * Format: https://{bundleId} — see YouTube API Required Minimum Functionality.
 */
export const YOUTUBE_APP_REFERER = 'https://com.mhmdsh1892.ninetyplusapp';

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

function sanitizeYoutubeId(videoId: string): string {
  return videoId.replace(/[^a-zA-Z0-9_-]/g, '');
}

/** Player-only embed URI (pair with {@link youtubeWebViewEmbedSource} Referer headers). */
export function youtubeEmbedUrl(pageUrl: string): string | null {
  const id = youtubeVideoId(pageUrl) || (/^[\w-]{6,}$/.test(pageUrl.trim()) ? pageUrl.trim() : null);
  if (!id) return null;
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    controls: '1',
    iv_load_policy: '3',
    fs: '1',
  });
  // www.youtube.com + app Referer header is the supported WebView path (fixes Error 153).
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

/** WebView `source` for in-app embed — Referer is required or YouTube returns Error 153. */
export function youtubeWebViewEmbedSource(
  pageUrlOrId: string,
): { uri: string; headers: Record<string, string> } | null {
  const uri = youtubeEmbedUrl(pageUrlOrId);
  if (!uri) return null;
  return {
    uri,
    headers: {
      Referer: YOUTUBE_APP_REFERER,
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  };
}

/**
 * First-party page on 90plus.pro that hosts the YouTube IFrame API.
 * Loading this as WebView `uri` (not injected HTML) gives a real Referer and
 * is the most reliable in-app path on iPhone WKWebView.
 */
export function youtubeHostedPlayerUrl(pageUrlOrId: string): string | null {
  const id = youtubeVideoId(pageUrlOrId) || (/^[\w-]{6,}$/.test(pageUrlOrId.trim()) ? pageUrlOrId.trim() : null);
  if (!id) return null;
  return `${YOUTUBE_EMBED_ORIGIN}/embed/youtube.html?v=${encodeURIComponent(id)}`;
}

/** YouTube watch page for in-app WebView (full page, not iframe embed). */
export function youtubeMobileWatchUrl(pageUrlOrId: string): string | null {
  const id = youtubeVideoId(pageUrlOrId) || (/^[\w-]{6,}$/.test(pageUrlOrId.trim()) ? pageUrlOrId.trim() : null);
  if (!id) return null;
  // Use www (not m.) so the WebView gets a normal viewport; m.youtube often paints as a thin strip in RN.
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}&playsinline=1`;
}

export type YoutubeEmbedDocumentOptions = {
  /** When true, show an explicit play overlay (required for reliable iOS WKWebView playback). */
  requireTap?: boolean;
};

/**
 * Local page so the WebView sends a Referer and the embed is allowed to paint.
 * Uses the IFrame API so iOS can report PLAYER_READY / PLAYING / typed errors
 * instead of treating the wrapper HTML load as "video ready".
 *
 * Important: rights-claimed clips often show a *false* "unavailable in your country"
 * inside WKWebView when eurl/referer is missing. base + origin + widget_referrer
 * mitigate that; failures still fall through to Open in YouTube.
 */
export function youtubeEmbedDocument(
  videoId: string,
  options: YoutubeEmbedDocumentOptions = {},
): string {
  const id = sanitizeYoutubeId(videoId);
  const requireTap = options.requireTap === true;
  return `<!DOCTYPE html><html><head><base href="${YOUTUBE_EMBED_ORIGIN}/"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden;-webkit-tap-highlight-color:transparent}#player{position:absolute;inset:0;width:100%;height:100%}#tap{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.35);border:0;padding:0}#tap[hidden]{display:none!important}#tap .disc{width:72px;height:72px;border-radius:999px;background:rgba(255,255,255,.94);display:flex;align-items:center;justify-content:center}#tap .tri{width:0;height:0;border-style:solid;border-width:12px 0 12px 20px;border-color:transparent transparent transparent #1a0b3a;margin-left:4px}</style></head><body><div id="player"></div><button id="tap" type="button" aria-label="Play"${requireTap ? '' : ' hidden'}><span class="disc"><span class="tri"></span></span></button><script>
window.__HL_VID='${id}';
var player=null,started=false,tap=document.getElementById('tap');
function post(reason){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage('reason:'+reason+':${id}:'+location.href);}catch(e){}}
function hideTap(){if(tap)tap.hidden=true;}
function tryPlay(fromGesture){if(!player)return;try{if(fromGesture){try{player.unMute();}catch(e1){}try{player.setVolume(100);}catch(e2){}}else{try{player.mute();}catch(e3){}}player.playVideo();}catch(e4){}}
if(tap){tap.addEventListener('click',function(){hideTap();tryPlay(true);post('USER_PLAY');},{passive:true});}
var tag=document.createElement('script');
tag.src='https://www.youtube.com/iframe_api';
document.head.appendChild(tag);
function onYouTubeIframeAPIReady(){
  try{
    player=new YT.Player('player',{
      width:'100%',height:'100%',videoId:'${id}',
      host:'https://www.youtube-nocookie.com',
      playerVars:{autoplay:1,mute:1,playsinline:1,rel:0,modestbranding:1,controls:1,iv_load_policy:3,enablejsapi:1,origin:'${YOUTUBE_EMBED_ORIGIN}',widget_referrer:'${YOUTUBE_EMBED_ORIGIN}'},
      events:{
        onReady:function(){post('PLAYER_READY');tryPlay(false);setTimeout(function(){if(!started&&tap)tap.hidden=false;},700);},
        onStateChange:function(e){if(e&&e.data===1){started=true;hideTap();post('PLAYING');}},
        onError:function(e){var c=String(e&&e.data!=null?e.data:'');if(/^(2|5|100|101|150|153)$/.test(c)){post('YT_ERROR:'+c);return;}post('EMBED_UNAVAILABLE');}
      }
    });
  }catch(err){post('EMBED_UNAVAILABLE');}
}
</script></body></html>`;
}
