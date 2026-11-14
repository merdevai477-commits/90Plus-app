import React, { useMemo } from 'react';

import { ReelCommentsSheet } from '../reels/ReelCommentsSheet';
import type { Comment } from '../../contexts/VideosContext';

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  reelId?: string | null;
  comments?: Comment[];
  onAddComment?: (comment: Comment) => void;
  onToggleLike?: (commentId: string) => void;
  onRemoved?: () => void;
  canModerate?: boolean;
  highlightCommentId?: string | null;
  highlightReplyId?: string | null;
}

/**
 * Reel comments use the same sheet, composer, and comment row as community posts.
 * The unused list props stay so older call sites keep compiling.
 */
export default function CommentsModal({
  visible,
  onClose,
  reelId,
  onAddComment,
  onRemoved,
  canModerate,
}: CommentsModalProps) {
  const id = visible ? reelId ?? null : null;
  const added = useMemo(() => {
    if (!onAddComment || !reelId) return undefined;
    return () => {
      onAddComment({
        id: `local-${Date.now()}`,
        user: { id: 'me', name: '' },
        text: '',
        timestamp: '',
        likes: 0,
        liked: false,
      });
    };
  }, [onAddComment, reelId]);

  return (
    <ReelCommentsSheet
      reelId={id}
      onClose={onClose}
      canModerate={canModerate}
      onAdded={added}
      onRemoved={onRemoved}
    />
  );
}
