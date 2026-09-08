export type ChatNavLinkType = 'player' | 'club' | 'match' | 'matches';

export type ChatNavLink = {
  type: ChatNavLinkType;
  label: string;
  id?: number;
  photo?: string | null;
  logo?: string | null;
  teamName?: string | null;
  teamId?: number | string | null;
};

const NAV_MARKER_RE = /\n?<!--90plus-nav:([\s\S]*?)-->\s*$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function positiveId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

export function sanitizeChatNavLinks(raw: unknown): ChatNavLink[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatNavLink[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const type = item.type;
    if (type !== 'player' && type !== 'club' && type !== 'match' && type !== 'matches') continue;
    const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : type;
    if (type === 'matches') {
      out.push({ type, label });
      continue;
    }
    const id = positiveId(item.id);
    if (!id) continue;
    out.push({
      type,
      id,
      label,
      photo: typeof item.photo === 'string' ? item.photo : null,
      logo: typeof item.logo === 'string' ? item.logo : null,
      teamName: typeof item.teamName === 'string' ? item.teamName : null,
      teamId: item.teamId == null ? null : (item.teamId as number | string),
    });
  }
  return out;
}

export function decodeChatNavMarker(text: string): { text: string; navLinks: ChatNavLink[] } {
  const source = text ?? '';
  const match = source.match(NAV_MARKER_RE);
  if (!match || match.index == null) return { text: source, navLinks: [] };
  try {
    const navLinks = sanitizeChatNavLinks(JSON.parse(match[1]));
    return { text: source.slice(0, match.index).trimEnd(), navLinks };
  } catch {
    return { text: source.replace(NAV_MARKER_RE, '').trimEnd(), navLinks: [] };
  }
}

export function stripChatNavMarker(text: string): string {
  return decodeChatNavMarker(text).text;
}
