/**
 * Splits post/comment text into plain, #hashtag, @mention and link segments.
 * Mirrors the backend rules in `src/services/community-text.ts`.
 */

export type RichSegment =
  | { kind: 'text'; text: string }
  | { kind: 'hashtag'; text: string; tag: string }
  | { kind: 'mention'; text: string; username: string }
  | { kind: 'link'; text: string; url: string };

const TOKEN_RE =
  /(https?:\/\/[^\s]+|www\.[^\s]+)|(^|[^\p{L}\p{N}_&])#([\p{L}\p{N}_]{1,50})|(^|[^\p{L}\p{N}_.@])@([A-Za-z0-9_.]{2,30})/gu;

export function parseRichText(input: string): RichSegment[] {
  const out: RichSegment[] = [];
  let last = 0;
  const push = (text: string) => {
    if (!text) return;
    const prev = out[out.length - 1];
    if (prev?.kind === 'text') prev.text += text;
    else out.push({ kind: 'text', text });
  };

  for (const m of input.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    if (m[1]) {
      push(input.slice(last, start));
      const url = m[1].replace(/[.,!?؟،)]+$/, '');
      out.push({ kind: 'link', text: url, url: url.startsWith('http') ? url : `https://${url}` });
      last = start + url.length;
      continue;
    }
    const lead = m[2] ?? m[4] ?? '';
    push(input.slice(last, start) + lead);
    const tokenStart = start + lead.length;
    if (m[3]) {
      const tag = m[3].replace(/_+$/, '');
      out.push({ kind: 'hashtag', text: `#${tag}`, tag: tag.toLowerCase() });
      last = tokenStart + 1 + tag.length;
    } else if (m[5]) {
      const username = m[5].replace(/\.+$/, '');
      out.push({ kind: 'mention', text: `@${username}`, username });
      last = tokenStart + 1 + username.length;
    }
  }
  push(input.slice(last));
  return out;
}

/** True when the text starts with an Arabic letter (for alignment). */
export function isArabicText(text: string): boolean {
  const m = text.match(/[\p{L}]/u);
  return !!m && /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(m[0]);
}

/** The `@partial` being typed right before the caret, if any. */
export function activeMentionQuery(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const m = before.match(/(^|[\s(])@([A-Za-z0-9_.]{0,30})$/);
  if (!m) return null;
  return { query: m[2], start: caret - m[2].length - 1 };
}
