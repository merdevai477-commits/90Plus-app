/**
 * My Reports Screen
 * Shows user's submitted reports and their status
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '../../contexts/LanguageContext';
import { getApiUrl } from '../../config/api.config';
import { logger } from '../../utils/logger';

// Types
interface Report {
  id: string;
  type: string;
  reason: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'REJECTED';
  createdAt: string;
  contentType: 'reel' | 'comment' | 'user';
  contentId: string;
}

// Constants
const COLORS = {
  primary: '#FFD700',
  background: '#000000',
  backgroundCard: '#1C1C1E',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
};

const STATUS_COLORS = {
  PENDING: COLORS.warning,
  REVIEWED: COLORS.primary,
  RESOLVED: COLORS.success,
  REJECTED: COLORS.error,
};

const STATUS_LABELS = {
  ar: {
    PENDING: 'قيد المراجعة',
    REVIEWED: 'تمت المراجعة',
    RESOLVED: 'تم الحل',
    REJECTED: 'مرفوض',
  },
  en: {
    PENDING: 'Pending',
    REVIEWED: 'Reviewed',
    RESOLVED: 'Resolved',
    REJECTED: 'Rejected',
  },
};

const REPORT_TYPE_LABELS = {
  ar: {
    SPAM: 'سبام',
    HARASSMENT: 'تحرش',
    INAPPROPRIATE: 'محتوى غير لائق',
    VIOLENCE: 'عنف',
    HATE: 'خطاب كراهية',
    COPYRIGHT: 'حقوق نشر',
    FAKE_INFO: 'معلومات مضللة',
    OTHER: 'أخرى',
  },
  en: {
    SPAM: 'Spam',
    HARASSMENT: 'Harassment',
    INAPPROPRIATE: 'Inappropriate',
    VIOLENCE: 'Violence',
    HATE: 'Hate Speech',
    COPYRIGHT: 'Copyright',
    FAKE_INFO: 'Misinformation',
    OTHER: 'Other',
  },
};

const STATUS_LABELS_KEYS: Record<Report['status'], string> = {
  PENDING: 'statusPending',
  REVIEWED: 'statusReviewed',
  RESOLVED: 'statusResolved',
  REJECTED: 'statusRejected',
};

const REPORT_TYPE_KEYS: Record<string, string> = {
  SPAM: 'typeSpam',
  HARASSMENT: 'typeHarassment',
  INAPPROPRIATE: 'typeInappropriate',
  VIOLENCE: 'typeViolence',
  HATE: 'typeHate',
  COPYRIGHT: 'typeCopyright',
  FAKE_INFO: 'typeFakeInfo',
  OTHER: 'typeOther',
};

export default function MyReportsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { language, t } = useLanguage();
  const tReports = t.myReports;

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * `@clerk/clerk-expo`'s `useAuth` rebuilds `getToken` on every render, so
   * listing it as a dependency made `fetchReports` a new function each render.
   * The mount effect below depends on that function and the fetch ends with
   * `setReports(data.reports || [])` — always a fresh array — so it re-rendered,
   * rebuilt the callback, and fetched again, without end. Pinning the identity
   * in a ref is what the rest of the app already does for this hook.
   */
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const tReportsRef = useRef(tReports);
  tReportsRef.current = tReports;

  const fetchReports = useCallback(async (isRefresh = false) => {
    const tReports = tReportsRef.current;
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      const token = await getTokenRef.current();
      if (!token) {
        throw new Error(tReports.authRequired);
      }

      const response = await fetch(`${getApiUrl()}/reports/my-reports`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || tReports.loadFailed);
      }

      setReports(data.reports || []);
    } catch (error: any) {
      logger.error('Error fetching reports:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // No dependencies: both the token function and the copy are read from
    // refs, so this callback is created once and the mount effect below fires
    // exactly once.
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReports(true);
  };

  const handleReportPress = (report: Report) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const typeKey = REPORT_TYPE_KEYS[report.type] ?? 'typeOther';
    const statusKey = STATUS_LABELS_KEYS[report.status];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typeLabel = (tReports as any)[typeKey] || report.type;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusLabel = (tReports as any)[statusKey];

    Alert.alert(
      tReports.detailTitle,
      `${tReports.detailType}: ${typeLabel}\n${tReports.detailStatus}: ${statusLabel}\n${tReports.detailReason}: ${report.reason}`,
      [{ text: tReports.ok }]
    );
  };

  const renderReportItem = ({ item }: { item: Report }) => {
    const statusColor = STATUS_COLORS[item.status];
    const statusKey = STATUS_LABELS_KEYS[item.status];
    const typeKey = REPORT_TYPE_KEYS[item.type] ?? 'typeOther';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statusLabel = (tReports as any)[statusKey];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typeLabel = (tReports as any)[typeKey] || item.type;

    return (
      <TouchableOpacity
        style={styles.reportCard}
        onPress={() => handleReportPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.reportHeader}>
          <View style={[styles.reportIcon, { backgroundColor: `${statusColor}20` }]}>
            <Ionicons name="flag" size={20} color={statusColor} />
          </View>
          <View style={styles.reportInfo}>
            <Text style={styles.reportType}>{typeLabel}</Text>
            <Text style={styles.reportDate}>
              {new Date(item.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <Text style={styles.reportReason} numberOfLines={2}>
          {item.reason}
        </Text>

        <View style={styles.reportFooter}>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          <Text style={styles.reportContentType}>
            {item.contentType === 'reel'
              ? tReports.contentReel
              : item.contentType === 'comment'
              ? tReports.contentComment
              : tReports.contentUser}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="flag-outline" size={64} color={COLORS.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>
        {tReports.empty}
      </Text>
      <Text style={styles.emptyMessage}>
        {tReports.emptySub}
      </Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
      <Text style={styles.errorTitle}>{tReports.error}</Text>
      <Text style={styles.errorMessage}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => fetchReports()}>
        <LinearGradient
          colors={[COLORS.primary, '#FFA500']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.retryButtonGradient}
        >
          <Text style={styles.retryButtonText}>
            {tReports.retry}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color={COLORS.textPrimary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {tReports.title}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        renderError()
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReportItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            reports.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glassBorder,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  headerRight: {
    width: 44,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  listContentEmpty: {
    flex: 1,
  },
  reportCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reportInfo: {
    flex: 1,
  },
  reportType: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reportReason: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reportContentType: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: 24,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  retryButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.background,
  },
});
