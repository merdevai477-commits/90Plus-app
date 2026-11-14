import { useCallback, useRef, useState } from 'react';
import { Share } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { buildCommunityPostShareUrl } from '../../constants/shareLinks';
import { communityApi, pollChoices, pollVotedIndex, type CommunityPost, type ReportReason } from '../../services/community.api';
import { toastManager } from '../../services/toastManager';
import { useTranslation } from '../../src/i18n';
import { FollowService } from '../../src/services/authService';
import { getClerkBearerToken } from '../../utils/clerkAuthToken';
import { navigateUserProfile } from '../../utils/navigateUserProfile';
import { communityErrorMessage, fillTemplate } from '../../components/community/format';
import { findPost, removePostEverywhere, updateAuthorFollowingEverywhere, updatePostEverywhere } from './communityCache';
import { useCommunityToken } from './useCommunityFeed';

export type ReportPrompt = {
  kind: 'post' | 'comment';
  id: string;
  onHidden?: () => void;
};

/**
 * Likes are optimistic and coalesced: rapid taps only flip local state, and
 * at most one request per post is in flight — when it lands we send one more
 * only if the user's final intent differs from what the server now has.
 */
const likeIntent = new Map<string, boolean>();
const likeServer = new Map<string, boolean>();
const likeInFlight = new Set<string>();

function clearLikeSync(postId: string) {
  likeIntent.delete(postId);
  likeServer.delete(postId);
}

export const REPORT_REASONS: ReportReason[] = ['SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'FAKE_INFO', 'OTHER'];

export function usePostActions() {
  const qc = useQueryClient();
  const getToken = useCommunityToken();
  const router = useRouter();
  const { t } = useTranslation();
  const s = t.community;
  const [reportPrompt, setReportPrompt] = useState<ReportPrompt | null>(null);
  const reportPromptRef = useRef<ReportPrompt | null>(null);

  const flushLike = useCallback(
    async (postId: string): Promise<void> => {
      if (likeInFlight.has(postId)) return;
      const want = likeIntent.get(postId);
      const server = likeServer.get(postId);
      if (want === undefined || want === server) {
        clearLikeSync(postId);
        return;
      }
      likeInFlight.add(postId);
      try {
        const res = await communityApi.likePost(getToken, postId, want);
        likeInFlight.delete(postId);
        likeServer.set(postId, res.liked);
        if (likeIntent.get(postId) === res.liked) {
          clearLikeSync(postId);
          updatePostEverywhere(qc, postId, (p) => ({ ...p, likesCount: res.likesCount, likedByMe: res.liked }));
        } else {
          void flushLike(postId);
        }
      } catch {
        likeInFlight.delete(postId);
        const confirmed = likeServer.get(postId) ?? false;
        clearLikeSync(postId);
        updatePostEverywhere(qc, postId, (p) =>
          p.likedByMe === confirmed
            ? p
            : { ...p, likedByMe: confirmed, likesCount: Math.max(0, p.likesCount + (confirmed ? 1 : -1)) },
        );
      }
    },
    [getToken, qc],
  );

  const toggleLike = useCallback(
    (post: CommunityPost) => {
      const current = findPost(qc, post.id) ?? post;
      const next = !current.likedByMe;
      if (next) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!likeServer.has(post.id)) likeServer.set(post.id, current.likedByMe);
      likeIntent.set(post.id, next);
      updatePostEverywhere(qc, post.id, (p) => ({
        ...p,
        likedByMe: next,
        likesCount: Math.max(0, p.likesCount + (next ? 1 : -1)),
      }));
      void flushLike(post.id);
    },
    [qc, flushLike],
  );

  /** Double-tap on the image: like only, never unlike. */
  const likeOnce = useCallback(
    (post: CommunityPost) => {
      const current = findPost(qc, post.id) ?? post;
      if (!current.likedByMe) toggleLike(current);
      else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [qc, toggleLike],
  );

  const share = useCallback(
    async (post: CommunityPost) => {
      const name = post.author.displayName || post.author.username;
      const body = post.content || '';
      const postUrl = buildCommunityPostShareUrl(post.id);
      try {
        const result = await Share.share({
          message: `${fillTemplate(s.shareMessage, { name, content: body }).trim()}\n\n${postUrl}`,
          url: postUrl,
        });
        if (result.action !== Share.sharedAction) return;
        updatePostEverywhere(qc, post.id, (p) => ({ ...p, sharesCount: p.sharesCount + 1 }));
        const res = await communityApi.sharePost(getToken, post.id, result.activityType ?? 'system');
        updatePostEverywhere(qc, post.id, (p) => ({ ...p, sharesCount: res.sharesCount }));
      } catch {
        /* share sheet dismissed or bookkeeping failed — nothing to undo for the user */
      }
    },
    [getToken, qc, s.shareMessage],
  );

  const report = useCallback(
    async (kind: 'post' | 'comment', id: string, reason: ReportReason, onHidden?: () => void) => {
      try {
        const res = await communityApi.report(getToken, kind, id, reason);
        if (kind === 'post') removePostEverywhere(qc, id);
        else onHidden?.();
        toastManager.showSuccess(s.report, res.hidden ? s.hiddenAfterReport : s.reportThanks);
      } catch (err) {
        toastManager.showError(s.report, communityErrorMessage(err, s));
      }
    },
    [getToken, qc, s],
  );

  const askReport = useCallback((kind: 'post' | 'comment', id: string, onHidden?: () => void) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prompt = { kind, id, onHidden };
    reportPromptRef.current = prompt;
    setReportPrompt(prompt);
  }, []);

  const closeReport = useCallback(() => {
    reportPromptRef.current = null;
    setReportPrompt(null);
  }, []);

  const pickReportReason = useCallback(
    (reason: ReportReason) => {
      const prompt = reportPromptRef.current;
      reportPromptRef.current = null;
      setReportPrompt(null);
      if (prompt) void report(prompt.kind, prompt.id, reason, prompt.onHidden);
    },
    [report],
  );

  const performDelete = useCallback(
    async (post: CommunityPost, onDeleted?: () => void) => {
      removePostEverywhere(qc, post.id);
      onDeleted?.();
      try {
        await communityApi.deletePost(getToken, post.id);
      } catch (err) {
        toastManager.showError(s.delete, communityErrorMessage(err, s));
        void qc.invalidateQueries({ queryKey: ['community', 'feed'] });
      }
    },
    [getToken, qc, s],
  );

  const copyText = useCallback(
    async (text: string) => {
      await Clipboard.setStringAsync(text);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toastManager.showSuccess(s.copied, '');
    },
    [s.copied],
  );

  const openProfile = useCallback(
    (username: string) => {
      // Own avatar/name on a post → profile tab; others → public profile.
      navigateUserProfile(router, username);
    },
    [router],
  );

  const openHashtag = useCallback(
    (tag: string) => {
      router.push({ pathname: '/community/tag/[tag]', params: { tag } });
    },
    [router],
  );

  const openPost = useCallback(
    (postId: string, opts?: { comments?: boolean }) => {
      router.push({ pathname: '/community/post/[id]', params: { id: postId, ...(opts?.comments ? { comments: '1' } : {}) } });
    },
    [router],
  );

  const toggleFollow = useCallback(
    async (post: CommunityPost) => {
      const current = findPost(qc, post.id) ?? post;
      const next = !current.author.isFollowing;
      updateAuthorFollowingEverywhere(qc, current.author.id, next);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const token = await getClerkBearerToken(getToken);
        if (!token) throw new Error('AUTH');
        const res = next
          ? await FollowService.followUser(token, current.author.username)
          : await FollowService.unfollowUser(token, current.author.username);
        if (!res.success) throw new Error(res.error ?? 'FAILED');
      } catch {
        updateAuthorFollowingEverywhere(qc, current.author.id, !next);
        toastManager.showError(s.follow, s.followFailed);
      }
    },
    [getToken, qc, s],
  );

  const votePoll = useCallback(
    async (post: CommunityPost, optionIndex: number) => {
      const current = findPost(qc, post.id) ?? post;
      if (!current.poll) return;
      const prev = current.poll;
      const choices = pollChoices(prev);
      const from = pollVotedIndex(prev);
      if (from === optionIndex || optionIndex < 0 || optionIndex >= choices.length) return;
      const options = choices.map((option) => ({
        ...option,
        votes: option.votes + (option.index === optionIndex ? 1 : 0) - (option.index === from ? 1 : 0),
      }));
      const optimistic = {
        ...prev,
        options,
        votedIndex: optionIndex,
        votedByMe: optionIndex === 0 ? 'A' as const : optionIndex === 1 ? 'B' as const : null,
        votesA: options[0]?.votes ?? prev.votesA,
        votesB: options[1]?.votes ?? prev.votesB,
        totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
      };
      updatePostEverywhere(qc, post.id, (p) => (p.poll ? { ...p, poll: optimistic } : p));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        const poll = await communityApi.votePoll(getToken, post.id, optionIndex);
        updatePostEverywhere(qc, post.id, (p) => ({ ...p, poll }));
      } catch (err) {
        updatePostEverywhere(qc, post.id, (p) => (p.poll ? { ...p, poll: prev } : p));
        toastManager.showError(s.voteFailed, communityErrorMessage(err, s));
      }
    },
    [getToken, qc, s],
  );

  return {
    toggleLike,
    likeOnce,
    share,
    askReport,
    report,
    reportPrompt,
    closeReport,
    pickReportReason,
    performDelete,
    copyText,
    openProfile,
    openHashtag,
    openPost,
    toggleFollow,
    votePoll,
  };
}
