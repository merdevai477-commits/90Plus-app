import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    TextInput,
    FlatList,
    StyleSheet,
    Dimensions,
    Animated,
    Keyboard,
    Platform,
    Alert,
    Vibration,
    ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { X, Heart, Send, CheckCircle, AlertCircle, MessageCircle, ChevronDown, ChevronUp, Trash2, Flag } from 'lucide-react-native';
import { useHaptic } from '@/hooks/useHaptic';
import { Comment } from '../../contexts/VideosContext';
import { globalState } from '../../globalState';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/clerk-expo';
import { ReelsService } from '../../src/services/authService';
import { ActionSheetIOS } from 'react-native';
import { router } from 'expo-router';
import { toastManager } from '../../services/toastManager';
import { BlockService } from '../../services/blockService';
import { ReportSystem } from './ReportSystem';
import { useCommentReport } from '../../hooks/useReportSystem';

const MAX_COMMENTS_DISPLAY = 10;
// Requirements 15.1, 15.2: Separate limits for comments and replies
const MAX_COMMENTS_PER_USER = 5;
const MAX_REPLIES_PER_USER = 5;

// Comment / reply IDs from the backend are UUID v4. Any non-UUID id (e.g.
// `Date.now().toString()` left over from older client code) must NEVER be
// sent to backend endpoints — it produces 404s on `/reels/comments/<id>/*`.
// `isCommentId` short-circuits those handlers so the UI can warn the user
// politely instead of firing a doomed request.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isCommentId = (id: string | undefined | null): id is string =>
    typeof id === 'string' && UUID_RE.test(id);

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

import { COLORS as REEL_COLORS } from '../reels/constants';

const COLORS = {
    primary: REEL_COLORS.primary,
    secondary: '#ff00ff',
    accent: '#00ffff',
    background: '#0a0a0a',
    surface: '#1a1a1a',
    textPrimary: '#ffffff',
    textSecondary: '#a0a0a0',
    error: '#ff3b30',
    info: '#2196f3',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
};

function mapBackendComment(c: {
    id: string;
    content?: string;
    text?: string;
    createdAt: string;
    user: { id: string; displayName?: string; username: string; avatar?: string; isVerified?: boolean };
    likesCount?: number;
    likes?: number;
    liked?: boolean;
}) {
    return {
        id: c.id,
        user: {
            id: c.user.id,
            name: c.user.displayName || c.user.username,
            avatar: c.user.avatar,
            verified: c.user.isVerified,
        },
        text: c.content || c.text || '',
        timestamp: formatTimestamp(c.createdAt),
        likes: c.likesCount ?? c.likes ?? 0,
        liked: c.liked ?? false,
    };
}

/** Merge locally-added replies with server preview without dropping optimistic rows */
function mergeReplyLists(existing: Reply[] | undefined, fromServer: Reply[] | undefined): Reply[] {
    const merged = new Map<string, Reply>();
    for (const r of fromServer ?? []) {
        merged.set(r.id, r);
    }
    for (const r of existing ?? []) {
        merged.set(r.id, r);
    }
    return Array.from(merged.values());
}

// Reply interface extending Comment
interface Reply {
    id: string;
    user: {
        id: string;
        name: string;
        avatar?: string;
        verified?: boolean;
    };
    text: string;
    timestamp: string;
    likes: number;
    liked: boolean;
}

interface CommentWithReplies extends Comment {
    replies?: Reply[];
    repliesCount?: number;
    showReplies?: boolean;
    loadingReplies?: boolean;
}

interface CommentsModalProps {
    visible: boolean;
    onClose: () => void;
    reelId?: string | null;
    comments: Comment[];
    onAddComment?: (comment: Comment) => void;
    onToggleLike?: (commentId: string) => void;
    highlightCommentId?: string | null;
}

export default function CommentsModal({
    visible,
    onClose,
    reelId,
    comments = [],
    onAddComment,
    onToggleLike,
    highlightCommentId
}: CommentsModalProps) {
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [commentLimitReached, setCommentLimitReached] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
    const [commentsWithReplies, setCommentsWithReplies] = useState<CommentWithReplies[]>([]);
    const [commentDisplayLimit, setCommentDisplayLimit] = useState(MAX_COMMENTS_DISPLAY);
    const [longPressedCommentId, setLongPressedCommentId] = useState<string | null>(null);

    // ✅ FIX: Use ref instead of state for loadedComments to prevent re-render loops
    const loadedCommentsRef = useRef<Comment[]>([]);
    const [loadedCommentsVersion, setLoadedCommentsVersion] = useState(0); // Only to trigger updates when needed

    // Mention picker state
    const [showMentionPicker, setShowMentionPicker] = useState(false);
    const [mentionUsers, setMentionUsers] = useState<any[]>([]);
    const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 });
    const mentionSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const inputRef = useRef<TextInput>(null);
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const loadedReelIdRef = useRef<string | null>(null);
    const commentsListRef = useRef<FlatList>(null);
    const haptic = useHaptic();
    const { getToken, userId: sessionUserId } = useAuth();

    // Clerk's `getToken` returns a NEW function reference on every render,
    // so don't put it in effect dep arrays — read it from a ref instead.
    const getTokenRef = useRef(getToken);
    useEffect(() => {
        getTokenRef.current = getToken;
    }, [getToken]);

    // Unified report system for comments/replies
    const {
        isVisible: isReportVisible,
        reportConfig,
        reportComment,
        closeReport,
        handleSuccess,
        getToken: reportGetToken,
    } = useCommentReport({
        onSuccess: () => {
            toastManager.showReportSuccess();
        }
    });

    // Parse mentions from text
    const parseMentions = useCallback((text: string): string[] => {
        const mentionRegex = /@(\w+)/g;
        const matches = text.match(mentionRegex);
        return matches ? matches.map(m => m.replace('@', '')) : [];
    }, []);

    // Search users for mentions with debouncing
    const searchUsers = useCallback(async (query: string) => {
        if (query.length < 1) {
            setMentionUsers([]);
            return;
        }

        try {
            const token = await getToken();
            if (token) {
                const users = await ReelsService.searchUsersForMention(token, query);
                setMentionUsers(users);
            }
        } catch (error) {
            console.error('Error searching users:', error);
            setMentionUsers([]);
        }
    }, [getToken]);

    // Handle text change with mention detection
    const handleTextChange = useCallback((text: string) => {
        setNewComment(text);

        // Detect @ mention
        const cursorPosition = text.length;
        const lastAtIndex = text.lastIndexOf('@', cursorPosition - 1);

        if (lastAtIndex >= 0) {
            const textAfterAt = text.substring(lastAtIndex + 1, cursorPosition);
            // Check if there's a space or newline after @ (means mention ended)
            if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                setMentionPosition({ start: lastAtIndex, end: cursorPosition });
                setShowMentionPicker(true);

                // Debounce search
                if (mentionSearchTimeoutRef.current) {
                    clearTimeout(mentionSearchTimeoutRef.current);
                }
                mentionSearchTimeoutRef.current = setTimeout(() => {
                    searchUsers(textAfterAt);
                }, 300);
            } else {
                setShowMentionPicker(false);
            }
        } else {
            setShowMentionPicker(false);
        }
    }, [searchUsers]);

    // Handle mention selection
    const handleSelectMention = useCallback((username: string) => {
        const beforeMention = newComment.substring(0, mentionPosition.start);
        const afterMention = newComment.substring(mentionPosition.end);
        const newText = `${beforeMention}@${username} ${afterMention}`;
        setNewComment(newText);
        setShowMentionPicker(false);
        setMentionUsers([]);
    }, [newComment, mentionPosition]);

    // Check if current user has reached comment/reply limits - Requirements 15.1, 15.2, 15.4
    // Primary source: active session userId, fallback to globalState only if session unavailable
    const currentUserId = sessionUserId || (globalState.userProfile?.id && !sessionUserId ? globalState.userProfile.id : null);

    // ✅ SIMPLIFIED FIX: Use refs to track comment IDs and prevent infinite loops
    const prevCommentIdsRef = useRef<string>('');
    const commentsWithRepliesRef = useRef<CommentWithReplies[]>([]);
    const isInitializedRef = useRef(false);

    const applyCommentsUpdate = useCallback(
        (updater: (prev: CommentWithReplies[]) => CommentWithReplies[]) => {
            setCommentsWithReplies(prev => {
                const next = updater(prev);
                commentsWithRepliesRef.current = next;
                return next;
            });
        },
        [],
    );

    // ✅ Get effective comments - prioritize props, fallback to loaded
    const getEffectiveComments = useCallback((): Comment[] => {
        if (comments && comments.length > 0) {
            return comments;
        }
        return loadedCommentsRef.current;
    }, [comments]);

    // ✅ Get current comment IDs as string for comparison
    const getCurrentCommentIds = useCallback((): string => {
        const effective = getEffectiveComments();
        return effective.map(c => c.id).join(',');
    }, [getEffectiveComments]);

    // Count top-level comments by current user
    const userCommentsCount = useMemo(() => {
        if (!currentUserId) return 0;
        const effective = getEffectiveComments();
        return effective.filter(c => c.user.id === currentUserId).length;
    }, [currentUserId, comments, loadedCommentsVersion, getEffectiveComments]);

    // Count replies by current user across all comments
    const userRepliesCount = useMemo(() => {
        if (!currentUserId) return 0;
        let count = 0;
        commentsWithReplies.forEach(c => {
            if (c.replies) {
                count += c.replies.filter(r => r.user.id === currentUserId).length;
            }
        });
        return count;
    }, [currentUserId, commentsWithReplies]);

    const canComment = userCommentsCount < MAX_COMMENTS_PER_USER;
    const canReply = userRepliesCount < MAX_REPLIES_PER_USER;

    // ✅ FIX: Load comments from backend - use refs to prevent infinite loops
    // `comments` prop is read from a ref to avoid re-firing on parent re-renders
    // when the parent passes a new array reference each render.
    const commentsPropRef = useRef(comments);
    useEffect(() => {
        commentsPropRef.current = comments;
    }, [comments]);

    useEffect(() => {
        // Reset when modal closes - only reset refs, NOT state
        if (!visible) {
            loadedReelIdRef.current = null;
            // ✅ Don't call any setState here - just reset refs
            return;
        }

        if (!reelId) {
            return;
        }

        // If comments are provided as props, mark as loaded
        const propsComments = commentsPropRef.current;
        if (propsComments && propsComments.length > 0) {
            loadedReelIdRef.current = reelId;
            return;
        }

        // Only load if we haven't loaded comments for this reel yet
        if (loadedReelIdRef.current === reelId) {
            return;
        }

        // Load comments from backend
        const loadComments = async () => {
            try {
                const token = await getTokenRef.current();
                if (!token) return;

                // Mark as loading immediately
                loadedReelIdRef.current = reelId;

                const { comments: backendComments, error: loadError } = await ReelsService.getComments(token, reelId, 50);
                if (loadError) {
                    toastManager.showError('خطأ', loadError);
                    loadedReelIdRef.current = null;
                    return;
                }
                const transformedComments = backendComments.map((c: any) => ({
                    ...mapBackendComment(c),
                    replies: (c.replies || []).map((r: any) => mapBackendComment(r)),
                    repliesCount: c.repliesCount ?? c.replies?.length ?? 0,
                    showReplies: (c.replies?.length ?? 0) > 0,
                    loadingReplies: false,
                }));

                // ✅ Update ref first, then trigger minimal re-render
                loadedCommentsRef.current = transformedComments as Comment[];
                commentsWithRepliesRef.current = transformedComments;
                prevCommentIdsRef.current = transformedComments.map((c) => c.id).join(',');
                isInitializedRef.current = true;
                setCommentsWithReplies(transformedComments);
                setLoadedCommentsVersion((v) => v + 1);
            } catch (error) {
                console.error('Error loading comments:', error);
                if ((error as any)?.status !== 429) {
                    loadedReelIdRef.current = null;
                }
            }
        };

        loadComments();
    }, [visible, reelId]);

    // Scroll to highlighted comment when modal opens or highlightCommentId changes
    // ✅ Use ref to avoid dependency on commentsWithReplies array (prevents infinite loop)
    const highlightCommentIdRef = useRef<string | null | undefined>(highlightCommentId);
    const hasScrolledRef = useRef(false);

    useEffect(() => {
        highlightCommentIdRef.current = highlightCommentId;
        // Reset scroll flag when highlightCommentId changes
        if (highlightCommentId) {
            hasScrolledRef.current = false;
        }
    }, [highlightCommentId]);

    // Reset scroll flag when modal closes
    useEffect(() => {
        if (!visible) {
            hasScrolledRef.current = false;
        }
    }, [visible]);

    // ✅ CRITICAL FIX: Sync commentsWithReplies with effective comments
    // Only update when comment IDs actually change to prevent infinite loops
    useEffect(() => {
        // ✅ Skip if modal is not visible
        if (!visible) {
            return;
        }

        // ✅ Get current effective comments
        const effectiveComments = getEffectiveComments();
        const currentIds = getCurrentCommentIds();

        // ✅ Skip if IDs haven't changed
        if (prevCommentIdsRef.current === currentIds && isInitializedRef.current) {
            return;
        }

        // ✅ Handle empty comments
        if (!effectiveComments || effectiveComments.length === 0) {
            if (commentsWithRepliesRef.current.length > 0) {
                commentsWithRepliesRef.current = [];
                prevCommentIdsRef.current = '';
                setCommentsWithReplies([]);
            }
            isInitializedRef.current = true;
            return;
        }

        // ✅ Update ref BEFORE setState to prevent loops
        prevCommentIdsRef.current = currentIds;
        isInitializedRef.current = true;

        // ✅ Transform comments and preserve existing replies
        const transformed: CommentWithReplies[] = effectiveComments.map(c => {
            const commentText = (c as any).content || c.text || '';
            const existing = commentsWithRepliesRef.current.find(ec => ec.id === c.id);
            const serverReplies = ((c as any).replies || []).map((r: any) => mapBackendComment(r));
            const mergedReplies = mergeReplyLists(existing?.replies, serverReplies);
            const repliesCount = Math.max(
                existing?.repliesCount ?? 0,
                (c as any).repliesCount ?? 0,
                mergedReplies.length,
            );

            return {
                ...c,
                text: commentText,
                user: {
                    ...c.user,
                    name: c.user.name || (c.user as any).displayName || (c.user as any).username || 'User'
                },
                replies: mergedReplies,
                repliesCount,
                showReplies:
                    existing?.showReplies ??
                    mergedReplies.length > 0,
                loadingReplies: existing?.loadingReplies ?? false
            };
        });

        // ✅ Update ref synchronously
        commentsWithRepliesRef.current = transformed;
        setCommentsWithReplies(transformed);

    }, [visible, comments, loadedCommentsVersion, getEffectiveComments, getCurrentCommentIds]);

    // ✅ Separate effect to handle scroll after commentsWithReplies updates
    // Use a separate ref to track when comments are ready for scrolling
    const commentsReadyForScrollRef = useRef(false);

    useEffect(() => {
        // Only attempt scroll when modal is visible and comments are loaded
        if (!visible || !highlightCommentIdRef.current) {
            commentsReadyForScrollRef.current = false;
            return;
        }

        // Wait for comments to be ready
        if (commentsWithRepliesRef.current.length === 0) {
            commentsReadyForScrollRef.current = false;
            return;
        }

        // Only scroll once per highlightCommentId change
        if (hasScrolledRef.current || commentsReadyForScrollRef.current) {
            return;
        }

        const commentIndex = commentsWithRepliesRef.current.findIndex(c => c.id === highlightCommentIdRef.current);
        if (commentIndex >= 0 && commentsListRef.current) {
            commentsReadyForScrollRef.current = true;
            hasScrolledRef.current = true;

            // Use setTimeout to ensure the list is fully rendered
            setTimeout(() => {
                try {
                    commentsListRef.current?.scrollToIndex({
                        index: commentIndex,
                        animated: true,
                        viewPosition: 0.5 // Center the comment
                    });
                } catch (error) {
                    // Fallback if scrollToIndex fails
                    console.warn('Failed to scroll to comment:', error);
                }
            }, 300);
        }
    }, [visible, commentsWithReplies]); // ✅ Depend on visible and commentsWithReplies

    // Shake animation for limit warning
    const triggerShake = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Vibration.vibrate([0, 50, 50, 50]);

        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
    };

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                damping: 20,
                stiffness: 90,
            }).start();
            setTimeout(() => inputRef.current?.focus(), 300);
        } else {
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            }).start();
            setReplyingTo(null);
            setLongPressedCommentId(null);
            setShowMentionPicker(false);
            setMentionUsers([]);
        }
    }, [visible]);

    // Cleanup mention search timeout on unmount
    useEffect(() => {
        return () => {
            if (mentionSearchTimeoutRef.current) {
                clearTimeout(mentionSearchTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const onShow = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
        const onHide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
        return () => {
            onShow.remove();
            onHide.remove();
        };
    }, []);

    const handleToggleLike = useCallback(async (commentId: string) => {
        // Defence in depth: every backend comment id is a UUID. A non-UUID
        // means the comment hasn't been persisted yet (or stale temp id) —
        // hitting the API would return 404.
        if (!isCommentId(commentId)) {
            toastManager.showError('خطأ', 'يرجى الانتظار حتى يتم حفظ التعليق');
            return;
        }
        haptic.trigger('light');

        // Find the comment to get current state
        const comment = commentsWithReplies.find(c => c.id === commentId);
        const wasLiked = comment?.liked ?? false;
        const prevLikes = comment?.likes ?? 0;

        // Optimistic UI update
        setCommentsWithReplies(prev => prev.map(c =>
            c.id === commentId
                ? { ...c, liked: !wasLiked, likes: wasLiked ? prevLikes - 1 : prevLikes + 1 }
                : c
        ));

        // Also call the parent handler for local state
        onToggleLike && onToggleLike(commentId);

        // Sync with backend
        try {
            const token = await getToken();
            if (token) {
                if (wasLiked) {
                    await ReelsService.unlikeComment(token, commentId);
                } else {
                    await ReelsService.likeComment(token, commentId);
                }
            }
        } catch (error) {
            // Rollback on failure
            console.error('Error syncing comment like:', error);
            setCommentsWithReplies(prev => prev.map(c =>
                c.id === commentId
                    ? { ...c, liked: wasLiked, likes: prevLikes }
                    : c
            ));
        }
    }, [haptic, commentsWithReplies, onToggleLike, getToken]);

    // Handle like on reply
    const handleToggleReplyLike = useCallback(async (replyId: string, parentCommentId: string) => {
        if (!isCommentId(replyId) || !isCommentId(parentCommentId)) {
            toastManager.showError('خطأ', 'يرجى الانتظار حتى يتم حفظ الرد');
            return;
        }
        haptic.trigger('light');

        // Find the reply to get current state
        const parentComment = commentsWithReplies.find(c => c.id === parentCommentId);
        const reply = parentComment?.replies?.find(r => r.id === replyId);
        const wasLiked = reply?.liked ?? false;
        const prevLikes = reply?.likes ?? 0;

        // Optimistic UI update
        setCommentsWithReplies(prev => prev.map(c =>
            c.id === parentCommentId
                ? {
                    ...c,
                    replies: c.replies?.map(r =>
                        r.id === replyId
                            ? { ...r, liked: !wasLiked, likes: wasLiked ? prevLikes - 1 : prevLikes + 1 }
                            : r
                    )
                }
                : c
        ));

        // Sync with backend
        try {
            const token = await getToken();
            if (token) {
                if (wasLiked) {
                    await ReelsService.unlikeComment(token, replyId);
                } else {
                    await ReelsService.likeComment(token, replyId);
                }
            }
        } catch (error) {
            // Rollback on failure
            console.error('Error syncing reply like:', error);
            setCommentsWithReplies(prev => prev.map(c =>
                c.id === parentCommentId
                    ? {
                        ...c,
                        replies: c.replies?.map(r =>
                            r.id === replyId
                                ? { ...r, liked: wasLiked, likes: prevLikes }
                                : r
                        )
                    }
                    : c
            ));
        }
    }, [haptic, commentsWithReplies, getToken]);

    // Handle reply button press - Requirements 14.1, 14.2
    const handleReplyPress = useCallback((commentId: string, username: string) => {
        haptic.trigger('light');
        setReplyingTo({ commentId, username });
        inputRef.current?.focus();
    }, [haptic]);

    // Cancel reply mode
    const cancelReply = useCallback(() => {
        setReplyingTo(null);
        setNewComment('');
    }, []);

    // Handle delete comment (own comments only)
    const handleDeleteComment = useCallback(async (commentId: string) => {
        if (!isCommentId(commentId)) {
            toastManager.showError('خطأ', 'يرجى الانتظار حتى يتم حفظ التعليق');
            return;
        }
        haptic.trigger('medium');

        try {
            const token = await getToken();
            if (!token) return;

            // Optimistic UI update - remove comment immediately
            setCommentsWithReplies(prev => prev.filter(c => c.id !== commentId));

            // Sync with backend
            const result = await ReelsService.deleteComment(token, commentId);
            if (!result.success) {
                // Rollback on failure - reload comments
                // Note: In a real app, you'd want to restore the exact comment
                // For now, we'll just show an error
                Alert.alert('Error', result.message || 'Failed to delete comment');
            }
        } catch (error: any) {
            console.error('Error deleting comment:', error);
            Alert.alert('Error', 'Failed to delete comment');
        }
    }, [haptic, getToken]);



    // Handle block user
    const handleBlockUser = useCallback(async (userId: string, username: string) => {
        // Confirmation alert
        Alert.alert(
            'حظر المستخدم',
            `هل أنت متأكد من حظر ${username}؟ لن تتمكن من رؤية محتواه مرة أخرى.`,
            [
                { text: 'إلغاء', style: 'cancel' },
                {
                    text: 'حظر',
                    style: 'destructive',
                    onPress: async () => {
                        haptic.trigger('medium');
                        try {
                            const token = await getToken();
                            if (!token) return;

                            // Optimistic UI update: Remove all comments from this user
                            setCommentsWithReplies(prev => prev.filter(c => c.user.id !== userId));

                            // Call Block Service
                            await BlockService.blockUser(userId, token);

                            Alert.alert('تم الحظر', 'تم حظر المستخدم بنجاح');
                        } catch (error) {
                            console.error('Error blocking user:', error);
                            toastManager.showError('خطأ', 'فشل حظر المستخدم');
                            // We could rollback here if needed, but for blocking it's better to just show error
                        }
                    }
                }
            ]
        );
    }, [haptic, getToken]);

    // Handle report comment
    const handleReportComment = useCallback(async (commentId: string, authorId?: string, authorName?: string) => {
        // The report flow ultimately hits `/api/reports/comment/<commentId>`,
        // which requires a real UUID. Short-circuit politely otherwise.
        if (!isCommentId(commentId)) {
            toastManager.showError('خطأ', 'يرجى الانتظار حتى يتم حفظ التعليق');
            return;
        }
        haptic.trigger('medium');

        const isOwnComment = currentUserId && authorId && String(currentUserId) === String(authorId);

        if (Platform.OS === 'ios') {
            const options = [
                'إبلاغ',
                'إلغاء'
            ];

            // Add Block option if not own comment
            if (!isOwnComment && authorId && authorName) {
                options.splice(1, 0, `حظر ${authorName}`);
            }

            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    destructiveButtonIndex: !isOwnComment ? 1 : undefined, // Block button index
                    cancelButtonIndex: options.length - 1,
                },
                async (buttonIndex) => {
                    // Handle cancel
                    if (buttonIndex === options.length - 1) return;

                    // Handle Block
                    if (!isOwnComment && buttonIndex === 1 && authorId && authorName) {
                        handleBlockUser(authorId, authorName);
                        return;
                    }

                    // Handle Report
                    // Use unified ReportSystem UI for reason selection + submission
                    reportComment(commentId);
                }
            );
        } else {
            // Android implementation
            const options = [{ text: 'إبلاغ', onPress: () => reportComment(commentId) }];

            if (!isOwnComment && authorId && authorName) {
                options.push({
                    text: `حظر ${authorName}`,
                    onPress: () => handleBlockUser(authorId, authorName)
                });
            }

            options.push({ text: 'إلغاء', onPress: () => { } });

            Alert.alert(
                'خيارات التعليق',
                'اختر إجراء',
                options
            );
        }
    }, [haptic, currentUserId, handleBlockUser, reportComment]);

    // Load replies for a comment - Requirements 14.4
    const loadReplies = useCallback(async (commentId: string) => {
        if (!isCommentId(commentId)) {
            // Without a backend UUID, GET /reels/comments/<id>/replies returns 404.
            return;
        }
        const token = await getToken();
        if (!token) return;

        applyCommentsUpdate(prev => prev.map(c =>
            c.id === commentId ? { ...c, loadingReplies: true } : c
        ));

        try {
            const replies = await ReelsService.getReplies(token, commentId);
            applyCommentsUpdate(prev => prev.map(c =>
                c.id === commentId ? {
                    ...c,
                    replies: replies.map((r: any) => mapBackendComment(r)),
                    repliesCount: Math.max(c.repliesCount ?? 0, replies.length),
                    showReplies: true,
                    loadingReplies: false
                } : c
            ));
        } catch (error) {
            console.error('Error loading replies:', error);
            applyCommentsUpdate(prev => prev.map(c =>
                c.id === commentId ? { ...c, loadingReplies: false } : c
            ));
        }
    }, [getToken, applyCommentsUpdate]);

    // Toggle replies visibility - Requirements 14.4
    const toggleReplies = useCallback((commentId: string) => {
        haptic.trigger('light');
        const comment = commentsWithReplies.find(c => c.id === commentId);
        if (comment?.showReplies) {
            setCommentsWithReplies(prev => prev.map(c =>
                c.id === commentId ? { ...c, showReplies: false } : c
            ));
        } else if (comment?.replies && comment.replies.length > 0) {
            setCommentsWithReplies(prev => prev.map(c =>
                c.id === commentId ? { ...c, showReplies: true } : c
            ));
        } else {
            loadReplies(commentId);
        }
    }, [commentsWithReplies, haptic, loadReplies]);

    const currentUser = globalState.userProfile;
    const currentUserAvatar = currentUser?.avatar || 'https://ui-avatars.com/api/?name=User&background=22c55e&color=fff';
    const currentUserName = currentUser?.displayName || currentUser?.username || 'أنت';

    const displayedComments = useMemo(() => {
        return commentsWithReplies.slice(0, commentDisplayLimit);
    }, [commentsWithReplies, commentDisplayLimit]);

    // Handle send - supports both comments and replies
    // Requirements 15.4: Check limits before sending to backend
    const handleSend = async () => {
        if (!newComment.trim() || isSubmitting) return;
        if (!replyingTo && !onAddComment) return;

        // Check appropriate limit based on whether it's a comment or reply
        const isReplyMode = !!replyingTo;
        if (isReplyMode && !canReply) {
            triggerShake();
            setCommentLimitReached(true);
            setTimeout(() => setCommentLimitReached(false), 3000);
            return;
        }
        if (!isReplyMode && !canComment) {
            triggerShake();
            setCommentLimitReached(true);
            setTimeout(() => setCommentLimitReached(false), 3000);
            return;
        }

        haptic.trigger('light');
        setIsSubmitting(true);

        // Parse mentions from comment text
        const mentions = parseMentions(newComment.trim());

        try {
            const token = await getToken();
            if (token && reelId) {
                if (replyingTo) {
                    // Adding a reply - Requirements 14.2, 14.3
                    const result = await ReelsService.addReply(token, reelId, replyingTo.commentId, newComment.trim(), mentions);

                    // We must only render the reply once we have the backend
                    // UUID — otherwise subsequent like/report/delete calls would
                    // hit `/reels/comments/<temp-id>/*` and 404.
                    if (result.success && isCommentId(result.reply?.id)) {
                        const newReply: Reply = {
                            id: result.reply.id,
                            user: {
                                id: sessionUserId || currentUser?.id || 'current_user',
                                name: currentUserName,
                                avatar: currentUserAvatar,
                                verified: currentUser?.isVerified || false
                            },
                            text: newComment.trim(),
                            timestamp: 'الآن',
                            likes: 0,
                            liked: false
                        };
                        applyCommentsUpdate(prev => prev.map(c =>
                            c.id === replyingTo.commentId ? {
                                ...c,
                                replies: [...(c.replies || []), newReply],
                                repliesCount: Math.max((c.repliesCount || 0) + 1, (c.replies?.length ?? 0) + 1),
                                showReplies: true
                            } : c
                        ));
                        setReplyingTo(null);
                        setNewComment('');
                    } else if (
                        result.error?.includes('الحد الأقصى') ||
                        result.error?.includes('LIMIT') ||
                        result.error?.includes('maximum number')
                    ) {
                        triggerShake();
                        setCommentLimitReached(true);
                        setTimeout(() => setCommentLimitReached(false), 3000);
                    } else {
                        toastManager.showError('خطأ', result.error || 'فشل إرسال الرد');
                    }
                } else {
                    // Adding a comment
                    const result = await ReelsService.addComment(token, reelId, newComment.trim(), mentions);
                    if (!result.success) {
                        if (
                            result.error?.includes('الحد الأقصى') ||
                            result.error?.includes('MAX_COMMENTS') ||
                            result.error?.includes('maximum number') ||
                            result.error?.includes('COMMENT_LIMIT') ||
                            result.error?.includes('REPLY_LIMIT')
                        ) {
                            triggerShake();
                            setCommentLimitReached(true);
                            setTimeout(() => setCommentLimitReached(false), 3000);
                            setIsSubmitting(false);
                            return;
                        }
                        toastManager.showError('خطأ', result.error || 'فشل إرسال التعليق');
                        setIsSubmitting(false);
                        return;
                    }

                    // Only surface the comment when we have a real backend UUID.
                    // Without it, every downstream action (like / report / delete /
                    // expand replies) would 404 against `/reels/comments/<id>/*`.
                    if (!isCommentId(result.comment?.id)) {
                        toastManager.showError('خطأ', 'فشل إرسال التعليق');
                        setIsSubmitting(false);
                        return;
                    }

                    const comment: Comment = {
                        id: result.comment.id,
                        user: {
                            id: sessionUserId || currentUser?.id || 'current_user',
                            name: currentUserName,
                            avatar: currentUserAvatar,
                            verified: currentUser?.isVerified || false
                        },
                        text: newComment.trim(),
                        timestamp: 'الآن',
                        likes: 0,
                        liked: false
                    };
                    onAddComment(comment);
                    applyCommentsUpdate(prev => [
                        {
                            ...comment,
                            replies: [],
                            repliesCount: 0,
                            showReplies: false,
                            loadingReplies: false,
                        },
                        ...prev,
                    ]);
                    setNewComment('');
                }
            }
        } catch (error) {
            console.log('Error sending:', error);
            toastManager.showError('خطأ', 'فشل إرسال التعليق');
        }

        setShowMentionPicker(false);
        setIsSubmitting(false);
        if (!isReplyMode) {
            Keyboard.dismiss();
        }
    };

    // Render text with clickable mentions
    const renderTextWithMentions = useCallback((text: string) => {
        const parts = text.split(/(@\w+)/g);
        return (
            <Text style={styles.commentText}>
                {parts.map((part, index) => {
                    if (part.startsWith('@')) {
                        const username = part.replace('@', '');
                        return (
                            <Text
                                key={index}
                                style={styles.mentionText}
                                onPress={() => {
                                    haptic.trigger('light');
                                    router.push({
                                        pathname: '/user/[username]',
                                        params: { username }
                                    });
                                }}
                            >
                                {part}
                            </Text>
                        );
                    }
                    return <Text key={index}>{part}</Text>;
                })}
            </Text>
        );
    }, [haptic]);

    // Render a single reply
    const renderReply = (reply: Reply, parentCommentId: string) => {
        const isOwnReply = currentUserId && reply.user.id &&
            String(currentUserId) === String(reply.user.id);

        return (
            <View key={reply.id} style={styles.replyItem}>
                <Image
                    source={{
                        uri: reply.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.user.name || 'User')}&background=0D8ABC&color=fff`
                    }}
                    style={styles.replyAvatar}
                    contentFit="cover"
                />
                <View style={styles.replyContent}>
                    <View style={styles.commentHeader}>
                        <View style={styles.commentUserInfo}>
                            <Text style={styles.replyUsername}>{reply.user.name}</Text>
                            {reply.user.verified && <CheckCircle size={10} color={COLORS.info} />}
                        </View>
                        <View style={styles.replyHeaderRight}>
                            <Text style={styles.replyTimestamp}>{reply.timestamp}</Text>
                            {/* Report and Delete buttons for replies */}
                            {!isOwnReply && (
                                <TouchableOpacity
                                    onPress={() => handleReportComment(reply.id, reply.user.id, reply.user.name)}
                                    style={styles.replyReportButton}
                                >
                                    <Flag size={12} color={COLORS.info} />
                                </TouchableOpacity>
                            )}
                            {isOwnReply && (
                                <TouchableOpacity
                                    onPress={() => {
                                        Alert.alert(
                                            'حذف الرد',
                                            'هل أنت متأكد من حذف هذا الرد؟',
                                            [
                                                { text: 'إلغاء', style: 'cancel' },
                                                { text: 'حذف', style: 'destructive', onPress: () => handleDeleteComment(reply.id) }
                                            ]
                                        );
                                    }}
                                    style={styles.replyDeleteButton}
                                >
                                    <Trash2 size={12} color={COLORS.error} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    {renderTextWithMentions(reply.text)}
                </View>
                {/* Like button for reply */}
                <TouchableOpacity
                    style={styles.replyLike}
                    onPress={() => handleToggleReplyLike(reply.id, parentCommentId)}
                >
                    <Heart size={12} color={reply.liked ? COLORS.error : '#666'} fill={reply.liked ? COLORS.error : 'none'} />
                    {reply.likes > 0 && (
                        <Text style={[styles.replyLikeCount, reply.liked && styles.commentLikeCountActive]}>
                            {reply.likes}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    const renderItem = ({ item }: { item: CommentWithReplies }) => {
        const isOwnComment = currentUserId && item.user.id &&
            String(currentUserId) === String(item.user.id);
        const showActionIcon = longPressedCommentId === item.id;
        const isHighlighted = highlightCommentId === item.id;

        return (
            <View style={styles.commentContainer}>
                <TouchableOpacity
                    activeOpacity={1}
                    onLongPress={() => {
                        haptic.trigger('medium');
                        setLongPressedCommentId(item.id);
                    }}
                    onPress={() => {
                        // Hide action icon when tapping elsewhere
                        if (longPressedCommentId === item.id) {
                            setLongPressedCommentId(null);
                        }
                    }}
                    delayLongPress={300}
                >
                    <View style={[
                        styles.commentItem,
                        isHighlighted && styles.commentItemHighlighted
                    ]}>
                        <Image
                            source={{
                                uri: item.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.name || 'User')}&background=0D8ABC&color=fff`
                            }}
                            style={styles.commentAvatar}
                            contentFit="cover"
                        />
                        <View style={styles.commentContent}>
                            <View style={styles.commentHeader}>
                                <View style={styles.commentUserInfo}>
                                    <Text style={styles.commentUsername}>{item.user.name}</Text>
                                    {item.user.verified && <CheckCircle size={12} color={COLORS.info} />}
                                </View>
                                <View style={styles.commentHeaderRight}>
                                    <Text style={styles.commentTimestamp}>{item.timestamp}</Text>
                                    {/* Action icon - Trash for own comments, Flag for others */}
                                    {showActionIcon && (
                                        <TouchableOpacity
                                            style={styles.commentActionButton}
                                            onPress={() => {
                                                setLongPressedCommentId(null);
                                                if (isOwnComment) {
                                                    Alert.alert(
                                                        'حذف التعليق',
                                                        'هل أنت متأكد من حذف هذا التعليق؟',
                                                        [
                                                            { text: 'إلغاء', style: 'cancel' },
                                                            { text: 'حذف', style: 'destructive', onPress: () => handleDeleteComment(item.id) }
                                                        ]
                                                    );
                                                } else {
                                                    handleReportComment(item.id, item.user.id, item.user.name);
                                                }
                                            }}
                                        >
                                            {isOwnComment ? (
                                                <Trash2 size={18} color={COLORS.error} />
                                            ) : (
                                                <Flag size={18} color={COLORS.info} />
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                            {renderTextWithMentions(item.text)}

                            {/* Comment Actions - Requirements 14.1 */}
                            <View style={styles.commentActions}>
                                <TouchableOpacity
                                    onPress={() => handleReplyPress(item.id, item.user.name)}
                                    style={styles.replyButton}
                                >
                                    <MessageCircle size={14} color="#888" />
                                    <Text style={styles.replyText}>رد</Text>
                                </TouchableOpacity>

                                {/* Report button - visible always */}
                                {!isOwnComment && (
                                    <TouchableOpacity
                                        onPress={() => handleReportComment(item.id)}
                                        style={styles.reportButton}
                                    >
                                        <Flag size={14} color={COLORS.info} />
                                        <Text style={styles.reportButtonText}>إبلاغ</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Delete button - visible always */}
                                {isOwnComment && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            Alert.alert(
                                                'حذف التعليق',
                                                'هل أنت متأكد من حذف هذا التعليق؟',
                                                [
                                                    { text: 'إلغاء', style: 'cancel' },
                                                    { text: 'حذف', style: 'destructive', onPress: () => handleDeleteComment(item.id) }
                                                ]
                                            );
                                        }}
                                        style={styles.deleteButton}
                                    >
                                        <Trash2 size={14} color={COLORS.error} />
                                        <Text style={styles.deleteButtonText}>حذف</Text>
                                    </TouchableOpacity>
                                )}

                                {/* View Replies - Requirements 14.4 */}
                                {(item.repliesCount || 0) > 0 && (
                                    <TouchableOpacity
                                        onPress={() => toggleReplies(item.id)}
                                        style={styles.viewRepliesButton}
                                    >
                                        {item.loadingReplies ? (
                                            <ActivityIndicator size="small" color={COLORS.primary} />
                                        ) : (
                                            <>
                                                {item.showReplies ? (
                                                    <ChevronUp size={14} color={COLORS.primary} />
                                                ) : (
                                                    <ChevronDown size={14} color={COLORS.primary} />
                                                )}
                                                <Text style={styles.viewRepliesText}>
                                                    {item.showReplies ? 'إخفاء الردود' : `عرض ${item.repliesCount} ردود`}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <TouchableOpacity style={styles.commentLike} onPress={() => handleToggleLike(item.id)}>
                            <Heart size={14} color={item.liked ? COLORS.error : '#666'} fill={item.liked ? COLORS.error : 'none'} />
                            {item.likes > 0 && (
                                <Text style={[styles.commentLikeCount, item.liked && styles.commentLikeCountActive]}>
                                    {item.likes}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>

                {/* Replies Section — show whenever replies are loaded */}
                {item.replies && item.replies.length > 0 && (
                    <View style={styles.repliesContainer}>
                        {item.replies.map(reply => renderReply(reply, item.id))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.modalOverlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

                <Animated.View
                    style={[
                        styles.container,
                        {
                            transform: [{ translateY: slideAnim }],
                            paddingBottom: Platform.OS === 'ios' ? keyboardHeight : 0
                        }
                    ]}
                >
                    <View style={styles.handleContainer}><View style={styles.handle} /></View>

                    <View style={styles.header}>
                        <Text style={styles.title}>{displayedComments.length} {displayedComments.length === 1 ? 'تعليق' : 'تعليقات'}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        ref={commentsListRef}
                        data={displayedComments}
                        keyExtractor={item => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        onScrollToIndexFailed={(info) => {
                            // Fallback if scroll fails
                            setTimeout(() => {
                                commentsListRef.current?.scrollToOffset({
                                    offset: info.averageItemLength * info.index,
                                    animated: true
                                });
                            }, 100);
                        }}
                        onScrollBeginDrag={() => {
                            // Hide action icon when scrolling starts
                            if (longPressedCommentId) {
                                setLongPressedCommentId(null);
                            }
                        }}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>كن أول من يعلق! 👇</Text>
                            </View>
                        }
                        ListFooterComponent={
                            commentsWithReplies.length > commentDisplayLimit ? (
                                <TouchableOpacity
                                    style={styles.moreCommentsContainer}
                                    onPress={() => setCommentDisplayLimit((n) => n + MAX_COMMENTS_DISPLAY)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.moreCommentsText}>
                                        Load more ({commentsWithReplies.length - commentDisplayLimit} remaining)
                                    </Text>
                                </TouchableOpacity>
                            ) : null
                        }
                    />

                    {commentLimitReached && (
                        <Animated.View style={[styles.limitWarning, { transform: [{ translateX: shakeAnim }] }]}>
                            <AlertCircle size={16} color="#FF6B6B" />
                            <Text style={styles.limitWarningText}>
                                {replyingTo
                                    ? `لقد وصلت للحد الأقصى من الردود (${MAX_REPLIES_PER_USER} ردود)`
                                    : `لقد وصلت للحد الأقصى من التعليقات (${MAX_COMMENTS_PER_USER} تعليقات)`
                                }
                            </Text>
                        </Animated.View>
                    )}

                    {/* Reply indicator - Requirements 14.2 */}
                    {replyingTo && (
                        <View style={styles.replyingToContainer}>
                            <Text style={styles.replyingToText}>
                                الرد على <Text style={styles.replyingToUsername}>@{replyingTo.username}</Text>
                            </Text>
                            <TouchableOpacity onPress={cancelReply} style={styles.cancelReplyButton}>
                                <X size={16} color="#888" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Mention Picker */}
                    {showMentionPicker && mentionUsers.length > 0 && (
                        <View style={styles.mentionPickerContainer}>
                            <FlatList
                                data={mentionUsers}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.mentionItem}
                                        onPress={() => handleSelectMention(item.username)}
                                    >
                                        <Image
                                            source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.username}` }}
                                            style={styles.mentionAvatar}
                                        />
                                        <View style={styles.mentionInfo}>
                                            <Text style={styles.mentionUsername}>@{item.username}</Text>
                                            {item.displayName && (
                                                <Text style={styles.mentionDisplayName}>{item.displayName}</Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                )}
                                style={styles.mentionList}
                                keyboardShouldPersistTaps="handled"
                            />
                        </View>
                    )}

                    <Animated.View
                        style={[
                            styles.inputContainer,
                            {
                                marginBottom: Platform.OS === 'android' ? keyboardHeight : 0,
                                transform: [{ translateX: shakeAnim }]
                            }
                        ]}
                    >
                        <View style={[styles.inputWrapper, (replyingTo ? !canReply : !canComment) && styles.inputWrapperDisabled]}>
                            <Image source={{ uri: currentUserAvatar }} style={styles.inputAvatar} />
                            <TextInput
                                ref={inputRef}
                                style={styles.input}
                                placeholder={
                                    replyingTo
                                        ? (canReply ? `رد على @${replyingTo.username}...` : "وصلت للحد الأقصى من الردود")
                                        : (canComment ? "أضف تعليقاً..." : "وصلت للحد الأقصى من التعليقات")
                                }
                                placeholderTextColor={(replyingTo ? canReply : canComment) ? "#666" : "#FF6B6B"}
                                value={newComment}
                                onChangeText={handleTextChange}
                                multiline
                                maxLength={500}
                                editable={replyingTo ? canReply : canComment}
                            />
                            <TouchableOpacity
                                onPress={handleSend}
                                disabled={!newComment.trim() || isSubmitting || (replyingTo ? !canReply : !canComment)}
                                style={[styles.sendButton, (!newComment.trim() || (replyingTo ? !canReply : !canComment)) && styles.sendButtonDisabled]}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Send size={18} color="#fff" />
                                )}
                            </TouchableOpacity>
                        </View>
                        {(!canComment || !canReply) && (
                            <Text style={styles.remainingComments}>
                                {!canComment && `تعليقات: ${userCommentsCount}/${MAX_COMMENTS_PER_USER}`}
                                {!canComment && !canReply && ' | '}
                                {!canReply && `ردود: ${userRepliesCount}/${MAX_REPLIES_PER_USER}`}
                            </Text>
                        )}
                    </Animated.View>
                </Animated.View>
            </View>

            {/* Unified Report System */}
            {reportConfig && (
                <ReportSystem
                    visible={isReportVisible}
                    onClose={closeReport}
                    contentType={reportConfig.contentType}
                    contentId={reportConfig.contentId}
                    getToken={reportGetToken}
                    onSuccess={handleSuccess}
                />
            )}
        </Modal>
    );
}

// Helper function to format timestamp
function formatTimestamp(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    return date.toLocaleDateString('ar');
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    container: {
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '70%',
        maxHeight: SCREEN_HEIGHT * 0.8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 5,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#404040',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        position: 'relative'
    },
    title: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    closeButton: {
        position: 'absolute',
        right: 16,
        top: 0,
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    commentContainer: {
        marginBottom: 16,
    },
    commentItemHighlighted: {
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        borderWidth: 2,
        borderColor: COLORS.primary,
        borderRadius: 12,
        padding: 8,
    },
    commentItem: {
        flexDirection: 'row',
    },
    commentAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 10,
        marginTop: 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    commentContent: {
        flex: 1,
        marginRight: 10,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    commentHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    replyHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    commentActionButton: {
        padding: 4,
        marginLeft: 4,
    },
    commentUserInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    commentUsername: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13,
    },
    commentTimestamp: {
        color: '#666',
        fontSize: 11,
    },
    commentText: {
        color: '#ddd',
        fontSize: 14,
        lineHeight: 20,
    },
    commentActions: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 16,
        alignItems: 'center',
    },
    replyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    replyText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
    },
    viewRepliesButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    viewRepliesText: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: '600',
    },
    commentLike: {
        alignItems: 'center',
        paddingTop: 4,
    },
    commentLikeCount: {
        color: '#666',
        fontSize: 11,
        marginTop: 2,
    },
    commentLikeCountActive: {
        color: COLORS.error,
    },
    // Replies styles
    repliesContainer: {
        marginLeft: 46,
        marginTop: 12,
        borderLeftWidth: 2,
        borderLeftColor: 'rgba(255,255,255,0.1)',
        paddingLeft: 12,
    },
    replyItem: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    replyAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    replyContent: {
        flex: 1,
    },
    replyUsername: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 12,
    },
    replyTimestamp: {
        color: '#666',
        fontSize: 10,
    },
    replyLike: {
        alignItems: 'center',
        paddingTop: 4,
        paddingLeft: 8,
    },
    replyLikeCount: {
        color: '#666',
        fontSize: 10,
        marginTop: 2,
    },
    replyingToContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(168, 85, 247, 0.2)',
    },
    replyingToText: {
        color: '#888',
        fontSize: 13,
    },
    replyingToUsername: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    cancelReplyButton: {
        padding: 4,
    },
    inputContainer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        backgroundColor: '#1E1E1E',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    inputAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: '#fff',
        paddingHorizontal: 8,
        paddingVertical: 8,
        maxHeight: 100,
        fontSize: 15,
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    sendButtonDisabled: {
        backgroundColor: '#333',
        opacity: 0.5,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingTop: 40,
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
    },
    moreCommentsContainer: {
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        marginTop: 8,
    },
    moreCommentsText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '600',
    },
    limitWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 107, 107, 0.15)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginHorizontal: 12,
        marginBottom: 8,
        borderRadius: 8,
        gap: 8,
    },
    limitWarningText: {
        color: '#FF6B6B',
        fontSize: 13,
        fontWeight: '500',
    },
    inputWrapperDisabled: {
        opacity: 0.6,
        borderColor: 'rgba(255, 107, 107, 0.3)',
        borderWidth: 1,
    },
    remainingComments: {
        color: '#FF6B6B',
        fontSize: 11,
        textAlign: 'center',
        marginTop: 4,
    },
    // Mention Picker Styles
    mentionPickerContainer: {
        position: 'absolute',
        bottom: 60,
        left: 12,
        right: 12,
        maxHeight: 200,
        backgroundColor: '#2A2A2A',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    mentionList: {
        maxHeight: 200,
    },
    mentionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    mentionAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 12,
    },
    mentionInfo: {
        flex: 1,
    },
    mentionUsername: {
        color: COLORS.textPrimary,
        fontSize: 14,
        fontWeight: '600',
    },
    mentionDisplayName: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    mentionText: {
        color: COLORS.primary,
        fontWeight: '600',
    },
    // Report & Delete Button Styles
    reportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    reportButtonText: {
        color: COLORS.info,
        fontSize: 12,
        fontWeight: '600',
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    deleteButtonText: {
        color: COLORS.error,
        fontSize: 12,
        fontWeight: '600',
    },
    replyReportButton: {
        padding: 4,
        marginLeft: 8,
    },
    replyDeleteButton: {
        padding: 4,
        marginLeft: 8,
    },
});
