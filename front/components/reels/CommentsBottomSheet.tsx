import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Image,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Heart, Send } from 'lucide-react-native';
import { Comment } from './types';
import { COLORS, EFFECTS } from './constants';
import { useLanguage } from '../../contexts/LanguageContext';

interface CommentsBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    reelId: string;
    comments: Comment[];
    onLikeComment: (commentId: string) => void;
    onReplyComment: (commentId: string) => void;
    onSubmitComment: (text: string) => void;
    onUserPress: (userId: string) => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    isLoadingMore?: boolean;
}

export const CommentsBottomSheet: React.FC<CommentsBottomSheetProps> = ({
    visible,
    onClose,
    comments,
    onLikeComment,
    onSubmitComment,
    onUserPress,
}) => {
    const [commentText, setCommentText] = useState('');
    const { t } = useLanguage();

    const handleSubmit = () => {
        if (commentText.trim()) {
            onSubmitComment(commentText);
            setCommentText('');
        }
    };

    const renderComment = ({ item }: { item: Comment }) => (
        <View style={styles.commentItem}>
            <TouchableOpacity onPress={() => onUserPress(item.user.id)}>
                <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
            </TouchableOpacity>
            <View style={styles.commentContent}>
                <TouchableOpacity onPress={() => onUserPress(item.user.id)}>
                    <Text style={styles.userName}>{item.user.name}</Text>
                </TouchableOpacity>
                <Text style={styles.commentText}>{item.text}</Text>
                <View style={styles.commentMeta}>
                    <Text style={styles.timeAgo}>{item.timeAgo}</Text>
                    <TouchableOpacity onPress={() => onLikeComment(item.id)}>
                        <Text style={[styles.likeCount, item.liked && styles.likeCountActive]}>
                            {item.likes} {t.reels.likes}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
            <TouchableOpacity onPress={() => onLikeComment(item.id)} style={styles.likeButton}>
                <Heart
                    size={18}
                    color={item.liked ? COLORS.error : COLORS.textSecondary}
                    fill={item.liked ? COLORS.error : 'none'}
                />
            </TouchableOpacity>
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                <LinearGradient
                    colors={['rgba(26, 26, 26, 0.98)' as const, 'rgba(13, 13, 13, 0.98)' as const]}
                    style={styles.sheet}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                >
                    <LinearGradient
                        colors={['rgba(50, 205, 50, 0.15)' as const, 'rgba(57, 255, 20, 0.05)' as const]}
                        style={styles.header}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <Text style={styles.headerTitle}>
                            💬 {t.reels.viewComments} ({comments.length})
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                    </LinearGradient>

                    <FlashList
                        data={comments}
                        renderItem={renderComment}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.commentsList}
                        showsVerticalScrollIndicator={false}
                    />

                    <LinearGradient
                        colors={['rgba(26, 26, 26, 0.95)' as const, 'rgba(13, 13, 13, 0.95)' as const]}
                        style={styles.inputContainer}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                    >
                        <TextInput
                            style={styles.input}
                            placeholder={t.reels.commentPlaceholder}
                            placeholderTextColor={COLORS.textTertiary}
                            value={commentText}
                            onChangeText={setCommentText}
                            multiline
                            maxLength={500}
                        />
                        <TouchableOpacity
                            onPress={handleSubmit}
                            style={[styles.sendButton, !commentText.trim() && styles.sendButtonDisabled]}
                            disabled={!commentText.trim()}
                        >
                            <LinearGradient
                                colors={
                                    commentText.trim()
                                        ? ['#32CD32' as const, '#39FF14' as const]
                                        : ['rgba(255, 255, 255, 0.1)' as const, 'rgba(255, 255, 255, 0.05)' as const]
                                }
                                style={styles.sendButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Send
                                    size={18}
                                    color={commentText.trim() ? COLORS.deepBlack : COLORS.textSecondary}
                                    strokeWidth={2.5}
                                />
                            </LinearGradient>
                        </TouchableOpacity>
                    </LinearGradient>
                </LinearGradient>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.glassBorder,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.primary,
    },
    closeButton: {
        padding: 6,
    },
    commentsList: {
        padding: 16,
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    commentContent: {
        flex: 1,
    },
    userName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    commentText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },
    commentMeta: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 6,
    },
    timeAgo: {
        fontSize: 12,
        color: COLORS.textTertiary,
    },
    likeCount: {
        fontSize: 12,
        color: COLORS.textTertiary,
    },
    likeCountActive: {
        color: COLORS.error,
    },
    likeButton: {
        padding: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: COLORS.glassBorder,
    },
    input: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: COLORS.textPrimary,
        fontSize: 14,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: COLORS.glassBorder,
    },
    sendButton: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    sendButtonGradient: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
});
