/**
 * BadgesDisplay Component
 * عرض ميداليات وإنجازات المستخدم
 */

import React, { useEffect, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Award, Trophy, Star, Crown, Medal } from 'lucide-react-native';
import { getUserBadges, UserBadgesResponse, UserBadge } from '../../services/rankingsService';
import { useTranslation } from '../../src/i18n';

interface BadgesDisplayProps {
  userId: string;
  token: string | null;
  compact?: boolean; // For showing in profile header
}

// Badge icon based on type
const getBadgeIcon = (badgeType: string, size: number = 20) => {
  switch (badgeType) {
    case 'gold':
      return <Crown color="#FFD700" size={size} fill="#FFD700" />;
    case 'silver':
      return <Medal color="#C0C0C0" size={size} />;
    case 'bronze':
      return <Award color="#CD7F32" size={size} />;
    case 'diamond':
      return <Star color="#00BFFF" size={size} fill="#00BFFF" />;
    default:
      return <Trophy color="#22c55e" size={size} />;
  }
};

// Badge emoji based on type
const getBadgeEmoji = (badgeType: string): string => {
  switch (badgeType) {
    case 'gold':
      return '🥇';
    case 'silver':
      return '🥈';
    case 'bronze':
      return '🥉';
    case 'diamond':
      return '💎';
    default:
      // For rank badges like 'rank_4', 'rank_15', etc.
      if (badgeType.startsWith('rank_')) {
        const rank = badgeType.replace('rank_', '');
        return `#${rank}`;
      }
      return '🏆';
  }
};

// Category / period labels via i18n
function categoryLabel(category: string, t: ReturnType<typeof useTranslation>['t']): string {
  const map: Record<string, string> = {
    views: t.profile.badgeCategoryViews,
    shares: t.profile.badgeCategoryShares,
    comments: t.profile.badgeCategoryComments,
    predictions: t.profile.badgeCategoryPredictions,
    team_of_month: t.profile.badgeCategoryTeamOfMonth,
  };
  return map[category] ?? category;
}

function periodLabel(period: string, t: ReturnType<typeof useTranslation>['t']): string {
  const map: Record<string, string> = {
    daily: t.profile.badgePeriodDaily,
    weekly: t.profile.badgePeriodWeekly,
    monthly: t.profile.badgePeriodMonthly,
    '3_days': t.profile.badgePeriodThreeDays,
  };
  return map[period] ?? period;
}

// Compact badges row for profile header
const CompactBadges = memo(({ summary, onPress }: { summary: any; onPress: () => void }) => {
  if (summary.total === 0) return null;

  return (
    <TouchableOpacity style={styles.compactContainer} onPress={onPress} activeOpacity={0.7}>
      {summary.diamond > 0 && (
        <View style={styles.compactBadge}>
          <Text style={styles.compactEmoji}>💎</Text>
          <Text style={styles.compactCount}>{summary.diamond}</Text>
        </View>
      )}
      {summary.gold > 0 && (
        <View style={styles.compactBadge}>
          <Text style={styles.compactEmoji}>🥇</Text>
          <Text style={styles.compactCount}>{summary.gold}</Text>
        </View>
      )}
      {summary.silver > 0 && (
        <View style={styles.compactBadge}>
          <Text style={styles.compactEmoji}>🥈</Text>
          <Text style={styles.compactCount}>{summary.silver}</Text>
        </View>
      )}
      {summary.bronze > 0 && (
        <View style={styles.compactBadge}>
          <Text style={styles.compactEmoji}>🥉</Text>
          <Text style={styles.compactCount}>{summary.bronze}</Text>
        </View>
      )}
      {summary.ranked > 0 && (
        <View style={styles.compactBadge}>
          <Text style={styles.compactEmoji}>🏆</Text>
          <Text style={styles.compactCount}>{summary.ranked}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// Full badges modal
const BadgesModal = memo(({ 
  visible, 
  onClose, 
  badges, 
  summary, 
  streak,
}: { 
  visible: boolean; 
  onClose: () => void; 
  badges: UserBadge[];
  summary: any;
  streak: any;
}) => {
  const { t, language } = useTranslation();
  const dateLocale = language === 'ar' ? 'ar-EG' : 'en-US';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e']}
            style={styles.modalGradient}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.profile.badgesTitle}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X color="#fff" size={24} />
              </TouchableOpacity>
            </View>

            {/* Summary */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryEmoji}>💎</Text>
                  <Text style={styles.summaryCount}>{summary.diamond}</Text>
                  <Text style={styles.summaryLabel}>{t.profile.badgesDiamond}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryEmoji}>🥇</Text>
                  <Text style={styles.summaryCount}>{summary.gold}</Text>
                  <Text style={styles.summaryLabel}>{t.profile.badgesGold}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryEmoji}>🥈</Text>
                  <Text style={styles.summaryCount}>{summary.silver}</Text>
                  <Text style={styles.summaryLabel}>{t.profile.badgesSilver}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryEmoji}>🥉</Text>
                  <Text style={styles.summaryCount}>{summary.bronze}</Text>
                  <Text style={styles.summaryLabel}>{t.profile.badgesBronze}</Text>
                </View>
              </View>

              {/* Streak info */}
              {streak && streak.consecutiveMonths > 0 && (
                <View style={styles.streakContainer}>
                  <Text style={styles.streakText}>
                    🔥 {t.profile.badgesStreak.replace('{count}', String(streak.consecutiveMonths))}
                  </Text>
                  {!streak.diamondAwarded && streak.consecutiveMonths < 3 && (
                    <Text style={styles.streakHint}>
                      {t.profile.badgesStreakHint.replace('{remaining}', String(3 - streak.consecutiveMonths))}
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Badges List */}
            <ScrollView style={styles.badgesList} showsVerticalScrollIndicator={false}>
              {badges.length === 0 ? (
                <View style={styles.emptyState}>
                  <Trophy color="#666" size={48} />
                  <Text style={styles.emptyText}>{t.profile.badgesEmpty}</Text>
                  <Text style={styles.emptyHint}>{t.profile.badgesEmptyHint}</Text>
                </View>
              ) : (
                badges.map((badge, index) => (
                  <View key={badge.id || index} style={styles.badgeItem}>
                    <View style={styles.badgeIconContainer}>
                      <Text style={styles.badgeEmoji}>{getBadgeEmoji(badge.badgeType)}</Text>
                    </View>
                    <View style={styles.badgeInfo}>
                      <Text style={styles.badgeCategory}>{categoryLabel(badge.category, t)}</Text>
                      <Text style={styles.badgePeriod}>
                        {periodLabel(badge.period, t)} • {t.profile.badgeRank.replace('{rank}', String(badge.rank))}
                      </Text>
                      <Text style={styles.badgeDate}>
                        {new Date(badge.earnedAt).toLocaleDateString(dateLocale)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
});

export const BadgesDisplay: React.FC<BadgesDisplayProps> = memo(({ userId, token, compact = true }) => {
  const [badgesData, setBadgesData] = useState<UserBadgesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const fetchBadges = async () => {
      if (!userId) return;
      
      setLoading(true);
      try {
        const data = await getUserBadges(token, userId);
        setBadgesData(data);
      } catch (error) {
        // Silently handle errors - component will just not show badges
        console.warn('Failed to load badges:', error);
        setBadgesData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBadges();
  }, [userId, token]);

  if (loading) {
    return compact ? null : <ActivityIndicator color="#22c55e" />;
  }

  if (!badgesData || badgesData.summary.total === 0) {
    return null;
  }

  if (compact) {
    return (
      <>
        <CompactBadges 
          summary={badgesData.summary} 
          onPress={() => setModalVisible(true)} 
        />
        <BadgesModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          badges={badgesData.badges}
          summary={badgesData.summary}
          streak={badgesData.streak}
        />
      </>
    );
  }

  // Full display (for dedicated badges page if needed)
  return (
    <View style={styles.fullContainer}>
      {/* Summary cards */}
      <View style={styles.summaryRow}>
        {badgesData.summary.diamond > 0 && (
          <View style={[styles.summaryCard, styles.diamondCard]}>
            <Text style={styles.cardEmoji}>💎</Text>
            <Text style={styles.cardCount}>{badgesData.summary.diamond}</Text>
          </View>
        )}
        {badgesData.summary.gold > 0 && (
          <View style={[styles.summaryCard, styles.goldCard]}>
            <Text style={styles.cardEmoji}>🥇</Text>
            <Text style={styles.cardCount}>{badgesData.summary.gold}</Text>
          </View>
        )}
        {badgesData.summary.silver > 0 && (
          <View style={[styles.summaryCard, styles.silverCard]}>
            <Text style={styles.cardEmoji}>🥈</Text>
            <Text style={styles.cardCount}>{badgesData.summary.silver}</Text>
          </View>
        )}
        {badgesData.summary.bronze > 0 && (
          <View style={[styles.summaryCard, styles.bronzeCard]}>
            <Text style={styles.cardEmoji}>🥉</Text>
            <Text style={styles.cardCount}>{badgesData.summary.bronze}</Text>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 20,
    marginTop: 8,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  compactEmoji: {
    fontSize: 16,
  },
  compactCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  modalGradient: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },

  // Summary styles
  summaryContainer: {
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  summaryCount: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryLabel: {
    color: '#888',
    fontSize: 12,
  },

  // Streak styles
  streakContainer: {
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  streakText: {
    color: '#FFA500',
    fontSize: 14,
    fontWeight: '600',
  },
  streakHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },

  // Badges list styles
  badgesList: {
    flex: 1,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  badgeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  badgeEmoji: {
    fontSize: 24,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeCategory: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  badgePeriod: {
    color: '#22c55e',
    fontSize: 12,
    marginTop: 2,
  },
  badgeDate: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  emptyHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },

  // Full display styles
  fullContainer: {
    padding: 16,
  },
  summaryCard: {
    width: 70,
    height: 70,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diamondCard: {
    backgroundColor: 'rgba(0, 191, 255, 0.2)',
  },
  goldCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  silverCard: {
    backgroundColor: 'rgba(192, 192, 192, 0.2)',
  },
  bronzeCard: {
    backgroundColor: 'rgba(205, 127, 50, 0.2)',
  },
  cardEmoji: {
    fontSize: 24,
  },
  cardCount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
});

export default BadgesDisplay;
