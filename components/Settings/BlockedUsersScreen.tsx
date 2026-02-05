/**
 * Blocked Users Screen
 * Shows list of blocked users with unblock functionality
 * Required for Apple Guideline 1.2 compliance
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { BlockService, BlockedUser } from '../../services/blockService';
import { useToast } from '../../contexts/ToastContext';
import { router } from 'expo-router';

export default function BlockedUsersScreen() {
  const { getToken } = useAuth();
  const toast = useToast();

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);

  // Load blocked users
  const loadBlockedUsers = async () => {
    try {
      const token = await getToken();
      if (!token) {
        toast.showError('خطأ', 'يرجى تسجيل الدخول');
        return;
      }

      const users = await BlockService.getBlockedUsers(token);
      setBlockedUsers(users);
    } catch (error) {
      console.error('Load blocked users error:', error);
      toast.showError('خطأ', 'فشل تحميل المستخدمين المحظورين');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadBlockedUsers();
  };

  // Unblock user
  const handleUnblock = (user: BlockedUser) => {
    Alert.alert(
      'إلغاء الحظر',
      `هل تريد إلغاء حظر @${user.username}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إلغاء الحظر',
          onPress: async () => {
            setUnblockingUserId(user.id);
            try {
              const token = await getToken();
              if (!token) {
                toast.showError('خطأ', 'يرجى تسجيل الدخول');
                return;
              }

              await BlockService.unblockUser(user.id, token);
              
              // Remove from list
              setBlockedUsers(prev => prev.filter(u => u.id !== user.id));
              
              toast.showSuccess('تم', 'تم إلغاء حظر المستخدم');
            } catch (error) {
              console.error('Unblock error:', error);
              toast.showError('خطأ', 'فشل إلغاء الحظر');
            } finally {
              setUnblockingUserId(null);
            }
          },
        },
      ]
    );
  };

  // Render blocked user item
  const renderBlockedUser = ({ item }: { item: BlockedUser }) => (
    <View style={styles.userItem}>
      <TouchableOpacity
        style={styles.userInfo}
        onPress={() => router.push(`/user/${item.username}`)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.avatarUrl || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        <View style={styles.userDetails}>
          <Text style={styles.fullName} numberOfLines={1}>
            {item.fullName || item.username}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{item.username}
          </Text>
          <Text style={styles.blockedDate}>
            محظور منذ {formatDate(item.blockedAt)}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.unblockButton}
        onPress={() => handleUnblock(item)}
        disabled={unblockingUserId === item.id}
        activeOpacity={0.7}
      >
        {unblockingUserId === item.id ? (
          <ActivityIndicator size="small" color="#22c55e" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            <Text style={styles.unblockText}>إلغاء الحظر</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'اليوم';
    if (days === 1) return 'أمس';
    if (days < 7) return `${days} أيام`;
    if (days < 30) return `${Math.floor(days / 7)} أسابيع`;
    if (days < 365) return `${Math.floor(days / 30)} أشهر`;
    return `${Math.floor(days / 365)} سنة`;
  };

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="people-outline" size={64} color="#666" />
      </View>
      <Text style={styles.emptyTitle}>لا يوجد مستخدمين محظورين</Text>
      <Text style={styles.emptySubtitle}>
        عندما تقوم بحظر مستخدم، سيظهر هنا
      </Text>
    </View>
  );

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المستخدمون المحظورون</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={20} color="#3b82f6" />
        <Text style={styles.infoText}>
          المستخدمون المحظورون لن يتمكنوا من رؤية محتواك أو التواصل معك
        </Text>
      </View>

      {/* Blocked Users List */}
      <FlatList
        data={blockedUsers}
        renderItem={renderBlockedUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#22c55e"
            colors={['#22c55e']}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    width: 40,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    padding: 16,
    margin: 16,
  },
  infoText: {
    flex: 1,
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 18,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1a1a1a',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  fullName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  blockedDate: {
    fontSize: 12,
    color: '#666',
  },
  unblockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  unblockText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
});
