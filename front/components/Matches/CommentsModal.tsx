import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { X, Send, Heart, CheckCircle } from 'lucide-react-native';
import { useHaptics } from '../Home/useHaptics';

// Types
interface User {
  id: string;
  name: string;
  avatar: string;
  verified?: boolean;
}

interface Comment {
  id: string;
  user: User;
  text: string;
  timestamp: string;
  likes: number;
  liked: boolean;
  replies?: Comment[];
}

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  reelId: string;
}

// Constants
const COLORS = {
  primary: '#FFD700',
  error: '#FF5252',
  info: '#2196F3',
};

// Enhanced Comments Modal Component
export const CommentsModal: React.FC<CommentsModalProps> = ({ 
  visible, 
  onClose, 
  reelId 
}) => {
  const [comments, setComments] = useState<Comment[]>([
    {
      id: '1',
      user: { 
        id: '1', 
        name: 'أحمد محمد', 
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop',
        verified: true
      },
      text: 'هدف رائع! مهارة عالية جداً ⚽🔥',
      timestamp: '2 د',
      likes: 24,
      liked: false
    },
    {
      id: '2',
      user: { 
        id: '2', 
        name: 'سارة أحمد', 
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b047?w=40&h=40&fit=crop' 
      },
      text: 'احترافية عالية جداً 👏',
      timestamp: '5 د',
      likes: 12,
      liked: true
    }
  ]);

  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const haptic = useHaptics();

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible]);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const handleToggleCommentLike = (commentId: string) => {
    haptic.hapticFeedback();
    setComments(prev => prev.map(comment =>
      comment.id === commentId
        ? {
            ...comment,
            liked: !comment.liked,
            likes: comment.liked ? comment.likes - 1 : comment.likes + 1
          }
        : comment
    ));
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || isSubmitting) return;
    
    haptic.hapticFeedback();
    setIsSubmitting(true);
    Keyboard.dismiss();

    const comment: Comment = {
      id: Date.now().toString(),
      user: { 
        id: 'current_user', 
        name: 'أنت', 
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=40&h=40&fit=crop' 
      },
      text: newComment.trim(),
      timestamp: 'الآن',
      likes: 0,
      liked: false
    };

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    setComments(prev => [comment, ...prev]);
    setNewComment('');
    setIsSubmitting(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <View 
          style={[
            styles.commentsContainer,
            { marginBottom: keyboardHeight }
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandle} />
          
          {/* Header */}
          <View style={styles.commentsHeader}>
            <Text style={styles.commentsTitle}>
              {comments.length} تعليق
            </Text>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
            >
              <X size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {/* Comments List */}
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.commentsList}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                <Image
                  source={{ uri: item.user.avatar }}
                  style={styles.commentAvatar}
                />
                <View style={styles.commentContent}>
                  <View style={styles.commentHeader}>
                    <View style={styles.commentUserInfo}>
                      <Text style={styles.commentUsername}>{item.user.name}</Text>
                      {item.user.verified && (
                        <CheckCircle size={14} color={COLORS.info} />
                      )}
                    </View>
                    <Text style={styles.commentTimestamp}>{item.timestamp}</Text>
                  </View>
                  <Text style={styles.commentText}>{item.text}</Text>
                  <TouchableOpacity 
                    style={styles.commentLike}
                    onPress={() => handleToggleCommentLike(item.id)}
                  >
                    <Heart 
                      size={16} 
                      color={item.liked ? COLORS.error : '#999'}
                      fill={item.liked ? COLORS.error : 'none'}
                    />
                    {item.likes > 0 && (
                      <Text style={[
                        styles.commentLikeCount,
                        item.liked && styles.commentLikeCountActive
                      ]}>
                        {item.likes}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
          
          {/* Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <View style={styles.commentInputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.commentTextInput}
                placeholder="أضف تعليق..."
                placeholderTextColor="#999"
                value={newComment}
                onChangeText={setNewComment}
                onSubmitEditing={handleAddComment}
                editable={!isSubmitting}
                multiline
                maxLength={500}
              />
              <TouchableOpacity 
                onPress={handleAddComment}
                disabled={!newComment.trim() || isSubmitting}
                style={[
                  styles.sendButton, 
                  (!newComment.trim() || isSubmitting) && styles.sendButtonDisabled
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Send size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  commentsContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: 600,
    paddingBottom: 20,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
  },
  commentsList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  commentTimestamp: {
    fontSize: 12,
    color: '#999',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentLike: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentLikeCount: {
    fontSize: 12,
    color: '#999',
  },
  commentLikeCountActive: {
    color: COLORS.error,
    fontWeight: '600',
  },
  commentInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: 'white',
    gap: 12,
  },
  commentTextInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 24,
    fontSize: 14,
    backgroundColor: '#f8f8f8',
    maxHeight: 100,
    color: '#000',
  },
  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
});
