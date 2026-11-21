/**
 * Session memory cache for public `/user/[username]` visits.
 * Avoids AsyncStorage round-trips and blank skeletons on revisit / prefetch.
 */

import type { SearchUserResult, UserReel } from '../src/services/authService';

const PROFILE_TTL_MS = 5 * 60 * 1000;
const VIDEOS_TTL_MS = 2 * 60 * 1000;
const MAX_ENTRIES = 40;

type Entry<T> = { data: T; at: number };

const profiles = new Map<string, Entry<SearchUserResult>>();
const videos = new Map<string, Entry<UserReel[]>>();
const inflightProfiles = new Map<string, Promise<SearchUserResult | null>>();
const inflightVideos = new Map<string, Promise<UserReel[]>>();

function cacheKey(username: string): string {
  return username.trim().toLowerCase();
}

function touchEvict<T>(map: Map<string, Entry<T>>, key: string, entry: Entry<T>) {
  map.delete(key);
  map.set(key, entry);
  if (map.size <= MAX_ENTRIES) return;
  const oldest = map.keys().next().value;
  if (oldest != null) map.delete(oldest);
}

function readFresh<T>(map: Map<string, Entry<T>>, key: string, ttl: number): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttl) {
    map.delete(key);
    return null;
  }
  // LRU: re-insert
  map.delete(key);
  map.set(key, hit);
  return hit.data;
}

export function peekPublicProfile(username: string): SearchUserResult | null {
  return readFresh(profiles, cacheKey(username), PROFILE_TTL_MS);
}

export function peekPublicVideos(username: string): UserReel[] | null {
  return readFresh(videos, cacheKey(username), VIDEOS_TTL_MS);
}

export function setPublicProfileMemory(username: string, data: SearchUserResult): void {
  touchEvict(profiles, cacheKey(username), { data, at: Date.now() });
}

export function setPublicVideosMemory(username: string, data: UserReel[]): void {
  touchEvict(videos, cacheKey(username), { data, at: Date.now() });
}

export function clearPublicProfileMemory(username?: string): void {
  if (!username) {
    profiles.clear();
    videos.clear();
    inflightProfiles.clear();
    inflightVideos.clear();
    return;
  }
  const key = cacheKey(username);
  profiles.delete(key);
  videos.delete(key);
  inflightProfiles.delete(key);
  inflightVideos.delete(key);
}

type FetchOpts = {
  /** Skip memory short-circuit and always hit the network (or join in-flight). */
  revalidate?: boolean;
};

/**
 * Deduped network fetch — concurrent navigations / screen mounts share one request.
 * Prefetch uses memory short-circuit; the screen passes `revalidate: true` for SWR.
 */
export async function fetchPublicProfileCached(
  username: string,
  fetcher: () => Promise<SearchUserResult | null>,
  opts?: FetchOpts,
): Promise<SearchUserResult | null> {
  const key = cacheKey(username);
  if (!opts?.revalidate) {
    const mem = peekPublicProfile(key);
    if (mem) return mem;
  }
  const existing = inflightProfiles.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fetcher();
      if (data) setPublicProfileMemory(key, data);
      return data;
    } finally {
      inflightProfiles.delete(key);
    }
  })();

  inflightProfiles.set(key, promise);
  return promise;
}

export async function fetchPublicVideosCached(
  username: string,
  fetcher: () => Promise<UserReel[]>,
  opts?: FetchOpts,
): Promise<UserReel[]> {
  const key = cacheKey(username);
  if (!opts?.revalidate) {
    const mem = peekPublicVideos(key);
    if (mem) return mem;
  }
  const existing = inflightVideos.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fetcher();
      if (data) setPublicVideosMemory(key, data);
      return data;
    } finally {
      inflightVideos.delete(key);
    }
  })();

  inflightVideos.set(key, promise);
  return promise;
}
