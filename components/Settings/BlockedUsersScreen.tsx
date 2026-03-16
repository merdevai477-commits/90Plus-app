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
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@clerk/clerk-expo';
import { BlockService, BlockedUser } from '../../services/blockService';
import { toastManager } from '../../services/toastManager';
import { useTranslation } from '../../src/i18n';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

export default function BlockedUsersScreen() {
  const { getToken } = useAuth();
  const { t } = useTranslation();

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);

  // Set status bar style when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setBarStyle('light-content');
      StatusBar.setBackgroundColor('#000', true);
      return () => {
        // Reset when leaving screen
        StatusBar.setBarStyle('default');
      };
    }, [])
  );

  // Load blocked users
  const loadBlockedUsers = async () => {
    try {
      const token = await getToken();
      if (!token) {
        toastManager.showAuthError();
        return;
      }

      const users = await BlockService.getBlockedUsers(token);
      setBlockedUsers(users);
    } catch (error) {
      console.error('Load blocked users error:', error);
      toastManager.showError(t.common.error, 'فشل تحميل المستخدمين المحظورين');
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
      '🔓 إلغاء حظر المستخدم',
      `هل تريد إلغاء حظر @${user.username}؟\n\nسيتمكن من رؤية محتواك والتفاعل معه مرة أخرى.`,
      [
        { 
          text: 'إلغاء', 
          style: 'cancel',
          onPress: () => console.log('Unblock cancelled')
        },
        {
          text: 'إلغاء الحظر',
          style: 'default',
          onPress: async () => {
            setUnblockingUserId(user.id);
            try {
              const token = await getToken();
              if (!token) {
                toastManager.showAuthError();
                return;
              }

              await BlockService.unblockUser(user.id, token);
              
              // Remove from list with animation
              setBlockedUsers(prev => prev.filter(u => u.id !== user.id));
              
              toastManager.showUnblockSuccess(user.username);
            } catch (error) {
              console.error('Unblock error:', error);
              toastManager.showError(t.common.error, 'فشل إلغاء الحظر. حاول مرة أخرى.');
            } finally {
              setUnblockingUserId(null);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Render blocked user item
  const renderBlockedUser = ({ item }: { item: BlockedUser }) => (
    <View style={styles.userCard}>
      {/* User Info Section */}
      <TouchableOpacity
        style={styles.userInfoSection}
        onPress={() => router.push(`/user/${item.username}`)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: item.avatarUrl || 'https://via.placeholder.com/60' }}
            style={styles.avatar}
          />
          <View style={styles.blockedBadge}>
            <Ionicons name="ban" size={16} color="#ef4444" />
          </View>
        </View>
        
        <View style={styles.userDetails}>
          <Text style={styles.fullName} numberOfLines={1}>
            {item.fullName || item.username}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{item.username}
          </Text>
          <View style={styles.blockedInfo}>
            <Ionicons name="time-outline" size={14} color="#666" />
            <Text style={styles.blockedDate}>
              {t.profile.blockedSince} {formatDate(item.blockedAt)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Unblock Button */}
      <TouchableOpacity
        style={[
          styles.unblockButton,
          unblockingUserId === item.id && styles.unblockButtonLoading
        ]}
        onPress={() => handleUnblock(item)}
        disabled={unblockingUserId === item.id}
        activeOpacity={0.8}
      >
        {unblockingUserId === item.id ? (
          <View style={styles.buttonLoadingContainer}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.buttonLoadingText}>جاري الإلغاء...</Text>
          </View>
        ) : (
          <View style={styles.buttonContent}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.unblockText}>إلغاء الحظر</Text>
          </View>
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
        <LinearGradient
          colors={['#22c55e', '#16a34a']}
          style={styles.emptyIconGradient}
        >
          <Ionicons name="shield-checkmark" size={48} color="#fff" />
        </LinearGradient>
      </View>
      <Text style={styles.emptyTitle}>رائع! لا يوجد مستخدمين محظورين</Text>
      <Text style={styles.emptySubtitle}>
        لم تقم بحظر أي مستخدم حتى الآن. عندما تحظر مستخدماً، ستتمكن من إدارته من هنا.
      </Text>
      <TouchableOpacity 
        style={styles.emptyButton}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={20} color="#22c55e" />
        <Text style={styles.emptyButtonText}>العودة للإعدادات</Text>
      </TouchableOpacity>
    </View>
  );

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>{t.common.loading}...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent={false} />
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
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>المستخدمون المحظورون</Text>
            {blockedUsers.length > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{blockedUsers.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={20} color="#888" />
          </TouchableOpacity>
        </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <View style={styles.infoIconContainer}>
          <Ionicons name="shield-checkmark" size={20} color="#3b82f6" />
        </View>
        <View style={styles.infoTextContainer}>
          <Text style={styles.infoTitle}>المستخدمون المحظورون</Text>
          <Text style={styles.infoText}>
            يمكنك إلغاء حظر أي مستخدم من هنا. المستخدمون المحظورون لا يمكنهم رؤية محتواك أو التواصل معك.
          </Text>
        </View>
      </View>

      {/* Stats Banner */}
      {blockedUsers.length > 0 && (
        <View style={styles.statsBanner}>
          <View style={styles.statsItem}>
            <Text style={styles.statsNumber}>{blockedUsers.length}</Text>
            <Text style={styles.statsLabel}>مستخدم محظور</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsItem}>
            <Text style={styles.statsNumber}>
              {blockedUsers.filter(u => {
                const days = Math.floor((new Date().getTime() - new Date(u.blockedAt).getTime()) / (1000 * 60 * 60 * 24));
                return days <= 7;
              }).length}
            </Text>
            <Text style={styles.statsLabel}>محظور هذا الأسبوع</Text>
          </View>
        </View>
      )}

      {/* Blocked Users List */}
      <FlashList
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
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
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#000',
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
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 16,
    padding: 16,
    margin: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoText: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 18,
  },
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  statsDivider: {
    width: 1,
    backgroundColor: '#333',
    marginHorizontal: 20,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  userCard: {
    backgroundColor: '#0a0a0a',
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  userInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
  },
  blockedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    flex: 1,
  },
  fullName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  username: {
    fontSize: 15,
    color: '#888',
    marginBottom: 8,
  },
  blockedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockedDate: {
    fontSize: 13,
    color: '#666',
  },
  unblockButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  unblockButtonLoading: {
    backgroundColor: '#666',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonLoadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  unblockText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  emptyButtonText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '600',
  },
});
