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
    KeyboardAvoidingView,
    Alert,
    Vibration,
    ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { X, Heart, Send, CheckCircle, AlertCircle, MessageCircle, ChevronDown, ChevronUp, MoreVertical, Trash2, Flag } from 'lucide-react-native';
import { useHaptic } from '@/hooks/useHaptic';
import { useLanguage } from '../../contexts/LanguageContext';
import { Comment } from '../../contexts/VideosContext';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { globalState } from '../../globalState';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/clerk-expo';
import { ReelsService } from '../../src/services/authService';
import { ActionSheetIOS } from 'react-native';

const MAX_COMMENTS_DISPLAY = 10;
// Requirements 15.1, 15.2: Separate limits for comments and replies
const MAX_COMMENTS_PER_USER = 5;
const MAX_REPLIES_PER_USER = 5;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
    primary: '#32cd32',
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
}

export default function CommentsModal({
    visible,
    onClose,
    reelId,
    comments = [],
    onAddComment,
    onToggleLike
}: CommentsModalProps) {
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [commentLimitReached, setCommentLimitReached] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
    const [commentsWithReplies, setCommentsWithReplies] = useState<CommentWithReplies[]>([]);
    const [loadedComments, setLoadedComments] = useState<Comment[]>([]);
    const inputRef = useRef<TextInput>(null);
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const loadedReelIdRef = useRef<string | null>(null);
    const haptic = useHaptic();
    const { t } = useLanguage();
    const { getToken, userId: sessionUserId } = useAuth();

    // Check if current user has reached comment/reply limits - Requirements 15.1, 15.2, 15.4
    // Primary source: active session userId, fallback to globalState only if session unavailable
    const currentUserId = sessionUserId || (globalState.userProfile?.id && !sessionUserId ? globalState.userProfile.id : null);

    // Use loaded comments if prop comments are empty, otherwise use prop comments
    const effectiveComments = useMemo(() => {
        return (comments && comments.length > 0) ? comments : loadedComments;
    }, [comments, loadedComments]);

    // Count top-level comments by current user
    const userCommentsCount = useMemo(() => {
        if (!currentUserId) return 0;
        return effectiveComments.filter(c => c.user.id === currentUserId).length;
    }, [effectiveComments, currentUserId]);

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
    }, [commentsWithReplies, currentUserId]);

    const canComment = userCommentsCount < MAX_COMMENTS_PER_USER;
    const canReply = userRepliesCount < MAX_REPLIES_PER_USER;

    // Load comments from backend when modal opens (only once per reelId when visible)
    useEffect(() => {
        // Reset loaded reel ID when modal closes
        if (!visible) {
            loadedReelIdRef.current = null;
            setLoadedComments([]);
            return;
        }
        
        if (!reelId) {
            return;
        }
        
        // If comments are provided as props, mark as loaded but don't clear loadedComments
        // This prevents unnecessary state updates that cause infinite loops
        if (comments && comments.length > 0) {
            loadedReelIdRef.current = reelId;
            // Don't call setLoadedComments([]) here - it causes re-renders
            return;
        }
        
        // Only load if we haven't loaded comments for this reel yet while modal is visible (prevent infinite loop)
        // This prevents multiple simultaneous requests for the same reelId
        if (loadedReelIdRef.current === reelId) {
            return;
        }
        
        // Load comments from backend (only once per reelId when modal opens)
        const loadComments = async () => {
            try {
                const token = await getToken();
                if (!token) return;
                
                // Mark as loading immediately to prevent duplicate requests
                loadedReelIdRef.current = reelId;
                
                const backendComments = await ReelsService.getComments(token, reelId, 50);
                // Transform backend comments (content -> text, format user data)
                const transformedComments: Comment[] = backendComments.map((c: any) => ({
                    id: c.id,
                    user: {
                        id: c.user.id,
                        name: c.user.displayName || c.user.username,
                        avatar: c.user.avatar,
                        verified: c.user.isVerified
                    },
                    text: c.content || c.text || '', // Transform content to text
                    timestamp: formatTimestamp(c.createdAt),
                    likes: (c as any).likes || 0,
                    liked: (c as any).liked || false
                }));
                setLoadedComments(transformedComments);
            } catch (error) {
                console.error('Error loading comments:', error);
                // On rate limit (429), don't reset to prevent retry loop
                // On other errors, reset to allow retry when modal reopens
                if ((error as any)?.status !== 429) {
                    loadedReelIdRef.current = null;
                }
                // Don't set empty array on error - keep existing comments if any
            }
        };
        
        loadComments();
    }, [visible, reelId, getToken]); // Removed comments from dependencies to prevent infinite loop

    // Update commentsWithReplies when comments change - transform content to text
    // Use useMemo to prevent unnecessary updates that cause infinite loops
    const transformedComments = useMemo(() => {
        return effectiveComments.map(c => {
            // Transform comment: handle both content (backend) and text (frontend) fields
            const commentText = (c as any).content || c.text || '';
            return {
                ...c,
                text: commentText, // Ensure text field exists
                user: {
                    ...c.user,
                    name: c.user.name || (c.user as any).displayName || (c.user as any).username || 'User'
                },
                replies: [],
                repliesCount: (c as any).repliesCount || 0,
                showReplies: false,
                loadingReplies: false
            };
        });
    }, [effectiveComments]);

    // Update commentsWithReplies only when transformedComments actually changes
    useEffect(() => {
        setCommentsWithReplies(transformedComments);
    }, [transformedComments]);

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
        }
    }, [visible]);

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

    // Handle report comment
    const handleReportComment = useCallback(async (commentId: string) => {
        haptic.trigger('medium');
        
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: [
                        'محتوى غير لائق',
                        'سبام أو إعلانات',
                        'خطاب كراهية',
                        'أخرى',
                        'إلغاء'
                    ],
                    cancelButtonIndex: 4,
                },
                async (buttonIndex) => {
                    if (buttonIndex < 4) {
                        const reasons = [
                            'محتوى غير لائق',
                            'سبام أو إعلانات',
                            'خطاب كراهية',
                            'أخرى'
                        ];
                        const reason = reasons[buttonIndex];
                        
                        try {
                            const token = await getToken();
                            if (!token) return;

                            const result = await ReelsService.reportComment(token, commentId, reason);
                            if (result.success) {
                                Alert.alert('تم الإبلاغ', 'شكراً لك، سيتم مراجعة البلاغ');
                            } else {
                                Alert.alert('Error', result.message || 'Failed to report comment');
                            }
                        } catch (error: any) {
                            console.error('Error reporting comment:', error);
                            Alert.alert('Error', 'Failed to report comment');
                        }
                    }
                }
            );
        } else {
            // Android - use Alert with input
            Alert.prompt(
                'Report Comment',
                'Please provide a reason',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Report',
                        onPress: async (reason) => {
                            if (reason) {
                                try {
                                    const token = await getToken();
                                    if (!token) return;

                                    const result = await ReelsService.reportComment(token, commentId, reason);
                                    if (result.success) {
                                        Alert.alert('تم الإبلاغ', 'شكراً لك، سيتم مراجعة البلاغ');
                                    } else {
                                        Alert.alert('Error', result.message || 'Failed to report comment');
                                    }
                                } catch (error: any) {
                                    console.error('Error reporting comment:', error);
                                    Alert.alert('Error', 'Failed to report comment');
                                }
                            }
                        }
                    }
                ],
                'plain-text'
            );
        }
    }, [haptic, getToken]);

    // Load replies for a comment - Requirements 14.4
    const loadReplies = useCallback(async (commentId: string) => {
        const token = await getToken();
        if (!token) return;

        setCommentsWithReplies(prev => prev.map(c => 
            c.id === commentId ? { ...c, loadingReplies: true } : c
        ));

        try {
            const replies = await ReelsService.getReplies(token, commentId);
            setCommentsWithReplies(prev => prev.map(c => 
                c.id === commentId ? { 
                    ...c, 
                    replies: replies.map((r: any) => ({
                        id: r.id,
                        user: {
                            id: r.user.id,
                            name: r.user.displayName || r.user.username,
                            avatar: r.user.avatar,
                            verified: r.user.isVerified
                        },
                        text: r.content,
                        timestamp: formatTimestamp(r.createdAt),
                        likes: 0,
                        liked: false
                    })),
                    showReplies: true,
                    loadingReplies: false 
                } : c
            ));
        } catch (error) {
            console.error('Error loading replies:', error);
            setCommentsWithReplies(prev => prev.map(c => 
                c.id === commentId ? { ...c, loadingReplies: false } : c
            ));
        }
    }, [getToken]);

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
    const currentUserAvatar = currentUser?.avatar || 'https://ui-avatars.com/api/?name=User&background=32cd32&color=fff';
    const currentUserName = currentUser?.displayName || currentUser?.username || 'أنت';

    const displayedComments = useMemo(() => {
        return commentsWithReplies.slice(0, MAX_COMMENTS_DISPLAY);
    }, [commentsWithReplies]);

    // Handle send - supports both comments and replies
    // Requirements 15.4: Check limits before sending to backend
    const handleSend = async () => {
        if (!newComment.trim() || isSubmitting || !onAddComment) return;
        
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

        try {
            const token = await getToken();
            if (token && reelId) {
                if (replyingTo) {
                    // Adding a reply - Requirements 14.2, 14.3
                    const result = await ReelsService.addReply(token, reelId, replyingTo.commentId, newComment.trim());
                    if (result.success && result.reply) {
                        // Optimistic update - add reply to UI immediately (Requirement 14.3)
                        const newReply: Reply = {
                            id: result.reply.id || Date.now().toString(),
                            user: {
                                id: sessionUserId || verifiedCurrentUser?.id || 'current_user',
                                name: currentUserName,
                                avatar: currentUserAvatar,
                                verified: verifiedCurrentUser?.isVerified || false
                            },
                            text: newComment.trim(),
                            timestamp: 'الآن',
                            likes: 0,
                            liked: false
                        };
                        setCommentsWithReplies(prev => prev.map(c => 
                            c.id === replyingTo.commentId ? {
                                ...c,
                                replies: [...(c.replies || []), newReply],
                                repliesCount: (c.repliesCount || 0) + 1,
                                showReplies: true
                            } : c
                        ));
                        setReplyingTo(null);
                    } else if (result.error?.includes('الحد الأقصى') || result.error?.includes('LIMIT')) {
                        triggerShake();
                        setCommentLimitReached(true);
                        setTimeout(() => setCommentLimitReached(false), 3000);
                    }
                } else {
                    // Adding a comment
                    const result = await ReelsService.addComment(token, reelId, newComment.trim());
                    if (!result.success) {
                        if (result.error?.includes('الحد الأقصى') || result.error?.includes('MAX_COMMENTS')) {
                            triggerShake();
                            setCommentLimitReached(true);
                            setTimeout(() => setCommentLimitReached(false), 3000);
                            setIsSubmitting(false);
                            return;
                        }
                    }
                    // Add comment locally
                    const comment: Comment = {
                        id: result.comment?.id || Date.now().toString(),
                        user: {
                            id: sessionUserId || verifiedCurrentUser?.id || 'current_user',
                            name: currentUserName,
                            avatar: currentUserAvatar,
                            verified: verifiedCurrentUser?.isVerified || false
                        },
                        text: newComment.trim(),
                        timestamp: 'الآن',
                        likes: 0,
                        liked: false
                    };
                    onAddComment(comment);
                }
            }
        } catch (error) {
            console.log('Error sending:', error);
        }

        setNewComment('');
        setIsSubmitting(false);
        Keyboard.dismiss();
    };

    // Render a single reply
    const renderReply = (reply: Reply, parentCommentId: string) => (
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
                    <Text style={styles.replyTimestamp}>{reply.timestamp}</Text>
                </View>
                <Text style={styles.replyText}>{reply.text}</Text>
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

    const renderItem = ({ item }: { item: CommentWithReplies }) => (
        <View style={styles.commentContainer}>
            <View style={styles.commentItem}>
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
                            {/* Action menu - Delete for own comments, Report for others */}
                            <TouchableOpacity
                                style={styles.commentActionButton}
                                onPress={() => {
                                    const isOwnComment = currentUserId && item.user.id && 
                                        String(currentUserId) === String(item.user.id);
                                    if (isOwnComment) {
                                        Alert.alert(
                                            'Delete Comment',
                                            'Are you sure you want to delete this comment?',
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                { text: 'Delete', style: 'destructive', onPress: () => handleDeleteComment(item.id) }
                                            ]
                                        );
                                    } else {
                                        handleReportComment(item.id);
                                    }
                                }}
                            >
                                <MoreVertical size={16} color={COLORS.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <Text style={styles.commentText}>{item.text}</Text>

                    {/* Comment Actions - Requirements 14.1 */}
                    <View style={styles.commentActions}>
                        <TouchableOpacity 
                            onPress={() => handleReplyPress(item.id, item.user.name)}
                            style={styles.replyButton}
                        >
                            <MessageCircle size={14} color="#888" />
                            <Text style={styles.replyText}>رد</Text>
                        </TouchableOpacity>
                        
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

            {/* Replies Section */}
            {item.showReplies && item.replies && item.replies.length > 0 && (
                <View style={styles.repliesContainer}>
                    {item.replies.map(reply => renderReply(reply, item.id))}
                </View>
            )}
        </View>
    );

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
                        data={displayedComments}
                        keyExtractor={item => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>كن أول من يعلق! 👇</Text>
                            </View>
                        }
                        ListFooterComponent={
                            comments.length > MAX_COMMENTS_DISPLAY ? (
                                <View style={styles.moreCommentsContainer}>
                                    <Text style={styles.moreCommentsText}>
                                        +{comments.length - MAX_COMMENTS_DISPLAY} تعليقات أخرى
                                    </Text>
                                </View>
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
                                onChangeText={setNewComment}
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
    commentActionButton: {
        padding: 4,
        marginLeft: 4,
    },
    commentUserInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
        alignItems: 'center',
        gap: 4,
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
        backgroundColor: 'rgba(50, 205, 50, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(50, 205, 50, 0.2)',
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
    }
});
