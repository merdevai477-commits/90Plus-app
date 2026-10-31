/**
 * Parse invite payloads carried through Play Install Referrer, iOS clipboard,
 * and deep-link URLs. Supports legacy (code only) and click_id formats.
 *
 * Local normalize/validate helpers avoid a cycle with share-win.service.
 */

const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export function normalizeInviteCode(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isValidInviteCode(raw: string): boolean {
  return CODE_PATTERN.test(normalizeInviteCode(raw));
}

export interface ParsedInvitePayload {
  code: string;
  clickId: string | null;
}

/** Play referrer: invite_CODE or invite_CODE_CLICKID (optionally mixed with utm_*). */
const PLAY_REFERRER_RE = /invite_([A-Za-z0-9]+)(?:_([A-Za-z0-9_-]{8,64}))?/;

/** Clipboard: 90plus-invite:CODE or 90plus-invite:CODE:CLICKID */
const IOS_CLIPBOARD_RE =
  /^90plus-invite:([A-Za-z0-9]{6})(?::([A-Za-z0-9_-]{8,64}))?$/i;

export function parsePlayInstallReferrer(raw: string | null | undefined): ParsedInvitePayload | null {
  if (!raw) return null;
  const match = PLAY_REFERRER_RE.exec(raw);
  if (!match?.[1]) return null;
  const code = normalizeInviteCode(match[1]);
  if (!isValidInviteCode(code)) return null;
  const clickId = match[2]?.trim() || null;
  return { code, clickId };
}

export function parseIosInviteClipboard(raw: string | null | undefined): ParsedInvitePayload | null {
  if (!raw) return null;
  const match = IOS_CLIPBOARD_RE.exec(String(raw).trim());
  if (!match?.[1]) return null;
  const code = normalizeInviteCode(match[1]);
  if (!isValidInviteCode(code)) return null;
  const clickId = match[2]?.trim() || null;
  return { code, clickId };
}

export function buildPlayInviteReferrer(code: string, clickId: string): string {
  return `invite_${normalizeInviteCode(code)}_${clickId}`;
}

export function buildIosInviteClipboard(code: string, clickId: string): string {
  return `90plus-invite:${normalizeInviteCode(code)}:${clickId}`;
}

/** Extract code (+ optional click_id from ?c=) from invite / deep-link URLs. */
export function parseInviteFromUrl(url: string): ParsedInvitePayload | null {
  if (!url) return null;
  const trimmed = url.trim();

  let code: string | null = null;
  const custom = trimmed.match(/ninetyplus:\/\/(?:invite|ref)\/([A-Za-z0-9]+)/i);
  if (custom?.[1]) code = normalizeInviteCode(custom[1]);
  if (!code) {
    const https = trimmed.match(/\/(?:invite|ref)\/([A-Za-z0-9]+)/i);
    if (https?.[1]) code = normalizeInviteCode(https[1]);
  }
  if (!code || !isValidInviteCode(code)) return null;

  let clickId: string | null = null;
  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://dummy${trimmed.startsWith('/') ? '' : '/'}${trimmed}`);
    const c = parsed.searchParams.get('c') || parsed.searchParams.get('click_id');
    if (c && /^[A-Za-z0-9_-]{8,64}$/.test(c)) clickId = c;
  } catch {
    const m = trimmed.match(/[?&](?:c|click_id)=([A-Za-z0-9_-]{8,64})/i);
    if (m?.[1]) clickId = m[1];
  }

  return { code, clickId };
}
