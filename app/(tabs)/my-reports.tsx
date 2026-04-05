/**
 * My Reports Screen
 * Shows user's submitted reports and their status
 */

import React, { useState, useEffect, useCallback } from 'react';
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

export default function MyReportsScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { language, t } = useLanguage();
  const isRTL = language === 'ar';

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error(isRTL ? 'يجب تسجيل الدخول' : 'Authentication required');
      }

      const response = await fetch(`${getApiUrl()}/reports/my-reports`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || (isRTL ? 'فشل تحميل البلاغات' : 'Failed to load reports'));
      }

      setReports(data.reports || []);
    } catch (error: any) {
      logger.error('Error fetching reports:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken, isRTL]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReports(true);
  };

  const handleReportPress = (report: Report) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Alert.alert(
      isRTL ? 'تفاصيل البلاغ' : 'Report Details',
      `${isRTL ? 'النوع' : 'Type'}: ${
        REPORT_TYPE_LABELS[language][report.type as keyof typeof REPORT_TYPE_LABELS.ar] || report.type
      }\n${isRTL ? 'الحالة' : 'Status'}: ${
        STATUS_LABELS[language][report.status]
      }\n${isRTL ? 'السبب' : 'Reason'}: ${report.reason}`,
      [{ text: isRTL ? 'حسناً' : 'OK' }]
    );
  };

  const renderReportItem = ({ item }: { item: Report }) => {
    const statusColor = STATUS_COLORS[item.status];
    const statusLabel = STATUS_LABELS[language][item.status];
    const typeLabel =
      REPORT_TYPE_LABELS[language][item.type as keyof typeof REPORT_TYPE_LABELS.ar] || item.type;

    return (
      <TouchableOpacity
        style={styles.reportCard}
        onPress={() => handleReportPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.reportHeader, isRTL && styles.reportHeaderRTL]}>
          <View style={[styles.reportIcon, { backgroundColor: `${statusColor}20` }]}>
            <Ionicons name="flag" size={20} color={statusColor} />
          </View>
          <View style={[styles.reportInfo, isRTL && styles.reportInfoRTL]}>
            <Text style={[styles.reportType, isRTL && styles.textRTL]}>{typeLabel}</Text>
            <Text style={[styles.reportDate, isRTL && styles.textRTL]}>
              {new Date(item.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <Text style={[styles.reportReason, isRTL && styles.textRTL]} numberOfLines={2}>
          {item.reason}
        </Text>

        <View style={[styles.reportFooter, isRTL && styles.reportFooterRTL]}>
          <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          <Text style={styles.reportContentType}>
            {item.contentType === 'reel'
              ? isRTL
                ? 'فيديو'
                : 'Reel'
              : item.contentType === 'comment'
              ? isRTL
                ? 'تعليق'
                : 'Comment'
              : isRTL
              ? 'مستخدم'
              : 'User'}
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
        {isRTL ? 'لا توجد بلاغات' : 'No Reports'}
      </Text>
      <Text style={styles.emptyMessage}>
        {isRTL
          ? 'لم تقم بإرسال أي بلاغات بعد'
          : "You haven't submitted any reports yet"}
      </Text>
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
      <Text style={styles.errorTitle}>{isRTL ? 'حدث خطأ' : 'Error'}</Text>
      <Text style={styles.errorMessage}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => fetchReports()}>
        <LinearGradient
          colors={[COLORS.primary, '#FFA500']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.retryButtonGradient}
        >
          <Text style={styles.retryButtonText}>
            {isRTL ? 'إعادة المحاولة' : 'Retry'}
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
            name={isRTL ? 'chevron-forward' : 'chevron-back'}
            size={28}
            color={COLORS.textPrimary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isRTL ? 'بلاغاتي' : 'My Reports'}
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
  reportHeaderRTL: {
    flexDirection: 'row-reverse',
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
  reportInfoRTL: {
    alignItems: 'flex-end',
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
  textRTL: {
    textAlign: 'right',
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
  reportFooterRTL: {
    flexDirection: 'row-reverse',
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
