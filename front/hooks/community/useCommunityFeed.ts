import { useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { communityApi, type CommunityPage, type CommunityPost } from '../../services/community.api';
import type { GetTokenFn } from '../../utils/clerkAuthToken';
import { communityKeys } from './communityCache';

/** Stable token getter that survives Clerk re-renders. */
export function useCommunityToken(): GetTokenFn {
  const { getToken } = useAuth();
  const ref = useRef(getToken);
  ref.current = getToken;
  return useCallback<GetTokenFn>((opts) => ref.current(opts), []);
}

type FeedSource =
  | { kind: 'feed' }
  | { kind: 'tag'; tag: string }
  | { kind: 'user'; username: string };

function keyFor(source: FeedSource) {
  if (source.kind === 'tag') return communityKeys.tag(source.tag);
  if (source.kind === 'user') return communityKeys.user(source.username);
  return communityKeys.feed;
}

export function useCommunityPosts(source: FeedSource) {
  const { isLoaded, isSignedIn } = useAuth();
  const getToken = useCommunityToken();

  const query = useInfiniteQuery<
    CommunityPage<CommunityPost> & { postsCount?: number },
    Error,
    { pages: (CommunityPage<CommunityPost> & { postsCount?: number })[]; pageParams: (string | null)[] },
    readonly unknown[],
    string | null
  >({
    queryKey: keyFor(source),
    queryFn: ({ pageParam }) => {
      if (source.kind === 'tag') return communityApi.hashtagPosts(getToken, source.tag, pageParam);
      if (source.kind === 'user') return communityApi.userPosts(getToken, source.username, pageParam);
      return communityApi.feed(getToken, pageParam);
    },
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: isLoaded === true && isSignedIn === true,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });

  const posts = useMemo(() => {
    const seen = new Set<string>();
    const out: CommunityPost[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const p of page.items) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p);
      }
    }
    return out;
  }, [query.data]);

  const postsCount = query.data?.pages[0]?.postsCount;

  return { ...query, posts, postsCount };
}

export function useTrendingHashtags() {
  const { isLoaded, isSignedIn } = useAuth();
  const getToken = useCommunityToken();
  return useQuery({
    queryKey: communityKeys.trending,
    queryFn: () => communityApi.trending(getToken),
    enabled: isLoaded === true && isSignedIn === true,
    staleTime: 5 * 60_000,
  });
}
