/**
 * Splits post/comment text into plain, #hashtag, @mention, /page and link segments.
 * Mention and hashtag rules mirror `src/services/community-text.ts`.
 */

import { resolvePageCommand } from './pageLinks';

export type RichSegment =
  | { kind: 'text'; text: string }
  | { kind: 'hashtag'; text: string; tag: string }
  | { kind: 'mention'; text: string; username: string }
  | { kind: 'everyone'; text: string }
  | { kind: 'page'; text: string; href: string }
  | { kind: 'link'; text: string; url: string };

const EVERYONE = new Set(['all', 'everyone', 'الكل', 'الجميع']);

const TOKEN_RE =
  /(https?:\/\/[^\s]+|www\.[^\s]+)|(^|[^\p{L}\p{N}_&])#([\p{L}\p{N}_]{1,50})|(^|[^\p{L}\p{N}_.@])@(all|everyone|الكل|الجميع)(?![\p{L}\p{N}_])|(^|[^\p{L}\p{N}_.@])@([A-Za-z0-9_.]{2,30})|(^|[^\p{L}\p{N}_/])\/((?:search|بحث|البحث)(?:[-\s]+[\p{L}\p{N}][\p{L}\p{N}.'’\-]{0,40}(?:[-\s]+[\p{L}\p{N}][\p{L}\p{N}.'’\-]{0,40}){0,5})?|[\p{L}\p{N}_-]{1,40}(?:\s+[\p{L}\p{N}_-]{1,40}){0,3})/gu;

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
    const lead = m[2] ?? m[4] ?? m[6] ?? m[8] ?? '';
    const tokenStart = start + lead.length;
    if (m[3]) {
      push(input.slice(last, start) + lead);
      const tag = m[3].replace(/_+$/, '');
      out.push({ kind: 'hashtag', text: `#${tag}`, tag: tag.toLowerCase() });
      last = tokenStart + 1 + tag.length;
    } else if (m[5]) {
      push(input.slice(last, start) + lead);
      out.push({ kind: 'everyone', text: `@${m[5]}` });
      last = tokenStart + 1 + m[5].length;
    } else if (m[7]) {
      push(input.slice(last, start) + lead);
      const username = m[7].replace(/\.+$/, '');
      if (EVERYONE.has(username.toLowerCase())) {
        out.push({ kind: 'everyone', text: `@${username}` });
      } else {
        out.push({ kind: 'mention', text: `@${username}`, username });
      }
      last = tokenStart + 1 + username.length;
    } else if (m[9]) {
      const command = resolvePageCommand(m[9]);
      if (!command) continue;
      push(input.slice(last, start) + lead);
      const visible = m[9].slice(0, command.consumed).replace(/[-\s]+$/, '');
      out.push({ kind: 'page', text: `/${visible}`, href: command.href });
      last = tokenStart + 1 + command.consumed;
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
  const m = before.match(/(^|[\s(])@([\p{L}\p{N}_.]{0,30})$/u);
  if (!m) return null;
  return { query: m[2], start: caret - m[2].length - 1 };
}

/** The `/partial` being typed right before the caret, including a search name with spaces. */
export function activeSlashQuery(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const m = before.match(
    /(^|[\s(])\/((?:search|بحث|البحث)(?:[-\s]+[\p{L}\p{N}.'’\-]{0,40}(?:[-\s]+[\p{L}\p{N}.'’\-]{0,40}){0,5})?|[\p{L}\p{N}_-]{0,40}(?:\s+[\p{L}\p{N}_-]{0,40}){0,3})$/iu,
  );
  if (!m) return null;
  return { query: m[2], start: caret - m[2].length - 1 };
}

const EVERYONE_ALIASES = ['all', 'everyone', 'الكل', 'الجميع'];

/** True when the text after `@` is a prefix of a broadcast mention. */
export function everyoneSuggestionMatches(query: string): boolean {
  const q = query.trim().toLowerCase();
  return EVERYONE_ALIASES.some((alias) => alias.startsWith(q));
}
