import prisma from '../lib/prisma';

export interface PlayerSocialLinks {
  athleteId: number;
  facebookUrl: string | null;
  instagramUrl: string | null;
}

export class PlayerSocialLinkError extends Error {}

const HOSTS = {
  facebook: ['facebook.com', 'fb.com'],
  instagram: ['instagram.com'],
} as const;

/**
 * Accepts a full URL or a bare handle ("@user" / "user") and returns a canonical
 * https URL on the expected host. `null`/empty clears the link.
 */
export function normalizeSocialUrl(
  kind: keyof typeof HOSTS,
  raw: unknown,
): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;

  const handle = value.replace(/^@/, '');
  if (/^[A-Za-z0-9._-]{1,80}$/.test(handle)) {
    return kind === 'facebook'
      ? `https://www.facebook.com/${handle}`
      : `https://www.instagram.com/${handle}`;
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new PlayerSocialLinkError(`Invalid ${kind} link`);
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
  if (!HOSTS[kind].some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new PlayerSocialLinkError(`${kind} link must be on ${HOSTS[kind].join(' / ')}`);
  }
  url.protocol = 'https:';
  return url.toString();
}

export async function getPlayerSocialLinks(athleteId: number): Promise<PlayerSocialLinks> {
  const row = await prisma.playerSocialLink.findUnique({ where: { athleteId } });
  return {
    athleteId,
    facebookUrl: row?.facebookUrl ?? null,
    instagramUrl: row?.instagramUrl ?? null,
  };
}

export async function upsertPlayerSocialLinks(
  athleteId: number,
  input: { name?: unknown; facebookUrl?: unknown; instagramUrl?: unknown },
) {
  const data: { name?: string | null; facebookUrl?: string | null; instagramUrl?: string | null } = {};
  if (input.facebookUrl !== undefined) data.facebookUrl = normalizeSocialUrl('facebook', input.facebookUrl);
  if (input.instagramUrl !== undefined) data.instagramUrl = normalizeSocialUrl('instagram', input.instagramUrl);
  if (input.name !== undefined) data.name = input.name ? String(input.name).trim().slice(0, 120) : null;

  return prisma.playerSocialLink.upsert({
    where: { athleteId },
    create: { athleteId, ...data },
    update: data,
  });
}

export async function deletePlayerSocialLinks(athleteId: number): Promise<void> {
  await prisma.playerSocialLink.deleteMany({ where: { athleteId } });
}

export async function listPlayerSocialLinks(take = 100, skip = 0) {
  return prisma.playerSocialLink.findMany({ orderBy: { updatedAt: 'desc' }, take, skip });
}
