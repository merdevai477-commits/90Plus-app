import type { Request } from 'express';
import { clerkClient } from '@clerk/express';
import { logger } from '../utils/logger';
import { CatalogCountry, mapCountryInput } from '../data/country-catalog';
import { countryCodeFromHeaders, getClientIp, isPublicIp } from '../utils/client-ip';

const IP_GEO_TIMEOUT_MS = 900;

function countryFromUnknown(value: unknown): CatalogCountry | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return mapCountryInput(value);
}

async function countryFromClerkSession(clerkUserId: string): Promise<CatalogCountry | null> {
  try {
    const response = await clerkClient.sessions.getSessionList({
      userId: clerkUserId,
      limit: 10,
    });
    const sessions = Array.isArray(response)
      ? response
      : ((response as { data?: unknown[] })?.data ?? []);
    for (const session of sessions) {
      const activity =
        (session as { latestActivity?: { country?: string } }).latestActivity ??
        (session as { latest_activity?: { country?: string } }).latest_activity;
      const mapped = countryFromUnknown(activity?.country);
      if (mapped) return mapped;
    }
  } catch (err) {
    logger.debug('[geo-country] Clerk session lookup skipped:', (err as Error)?.message);
  }
  return null;
}

async function countryFromIpApi(ip: string): Promise<CatalogCountry | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IP_GEO_TIMEOUT_MS);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: string; country?: string; countryCode?: string };
    if (json.status !== 'success') return null;
    return mapCountryInput(json.countryCode) ?? mapCountryInput(json.country);
  } catch (err) {
    logger.debug('[geo-country] IP lookup skipped:', (err as Error)?.message);
    return null;
  }
}

/** Best-effort country from Clerk activity, CDN headers, then IP geo. Never throws. */
export async function resolveGeoCountry(opts: {
  clerkUserId?: string | null;
  req?: Request;
}): Promise<CatalogCountry | null> {
  if (opts.clerkUserId) {
    const fromClerk = await countryFromClerkSession(opts.clerkUserId);
    if (fromClerk) return fromClerk;
  }

  if (opts.req) {
    const headerCode = countryCodeFromHeaders(opts.req);
    const fromHeader = mapCountryInput(headerCode);
    if (fromHeader) return fromHeader;

    const ip = getClientIp(opts.req);
    if (isPublicIp(ip)) {
      const fromIp = await countryFromIpApi(ip);
      if (fromIp) return fromIp;
    }
  }

  return null;
}
