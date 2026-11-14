import type { CommunityComment } from '../../services/community.api';

export function mapReelComment(raw: any, reelId: string, viewerId?: string | null): CommunityComment {
  const user = raw?.user ?? {};
  const createdAt = raw?.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString();
  const replies = Array.isArray(raw?.replies)
    ? raw.replies.map((reply: any) => mapReelComment(reply, reelId, viewerId))
    : [];
  return {
    id: String(raw?.id ?? ''),
    postId: reelId,
    parentId: raw?.parentId ?? null,
    content: raw?.content || raw?.text || '',
    createdAt,
    author: {
      id: user.id || 'unknown',
      username: user.username || 'user',
      displayName: user.displayName || user.name || null,
      avatar: user.avatar ?? null,
      isVerified: !!(user.isVerified || user.identity?.isVerified || user.verified),
      isDeveloper: !!(user.isDeveloper || user.identity?.isDeveloper),
      isFollowing: false,
      identity: user.identity ?? undefined,
    },
    likesCount: raw?.likesCount ?? raw?.likes ?? 0,
    repliesCount: raw?.repliesCount ?? raw?._count?.replies ?? replies.length,
    likedByMe: !!(raw?.liked ?? raw?.likedByMe),
    isMine: !!viewerId && user.id === viewerId,
    replies,
  };
}
