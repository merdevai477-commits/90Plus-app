import { useEffect, useState } from 'react';

import { communityApi, type CommunityAuthor } from '../../services/community.api';
import { useCommunityToken } from './useCommunityFeed';

const cache = new Map<string, CommunityAuthor[]>();

/** Debounced `@mention` suggestions. `null` query = closed. */
export function useMentionSearch(query: string | null) {
  const getToken = useCommunityToken();
  const [results, setResults] = useState<CommunityAuthor[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query === null) {
      setResults([]);
      setLoading(false);
      return;
    }
    const key = query.toLowerCase();
    const hit = cache.get(key);
    if (hit) {
      setResults(hit);
      setLoading(false);
      return;
    }
    if (!key) {
      setResults([]);
      return;
    }
    setLoading(true);
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const users = await communityApi.searchMentions(getToken, key);
        cache.set(key, users);
        if (cache.size > 100) cache.delete(cache.keys().next().value as string);
        if (alive) setResults(users);
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 180);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [getToken, query]);

  return { results, loading };
}
