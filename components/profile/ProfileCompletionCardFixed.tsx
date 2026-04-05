/**
 * ✅ FIXED: Profile Completion Card Component
 * 
 * Uses the fixed useProfileCompletion hook with Error Boundary protection
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useProfileCompletion } from '../../hooks/useProfileCompletion';
import ProfileErrorBoundary from '../common/ProfileErrorBoundary';

export interface ProfileCompletionStep {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  weight: number;
  icon: keyof typeof Ionicons.glyphMap;
  action?: () => void;
}

interface ProfileCompletionCardProps {
  onStepPress: (stepId: string) => void;
}

// ============================================================================
// MAIN COMPONENT (Wrapped in Error Boundary)
// ============================================================================

export const ProfileCompletionCard: React.FC<ProfileCompletionCardProps> = (props) => {
  return (
    <ProfileErrorBoundary
      maxRenderCount={50}
      onError={(error, errorInfo) => {
        console.error('[ProfileCompletionCard] Error caught:', error);
      }}
    >
      <ProfileCompletionCardInner {...props} />
    </ProfileErrorBoundary>
  );
};

// ============================================================================
// INNER COMPONENT (Protected by Error Boundary)
// ============================================================================

const ProfileCompletionCardInner: React.FC<ProfileCompletionCardProps> = ({ onStepPress }) => {
  const {
    completionStatus,
    isLoading,
    error,
    refresh,
    markStepCompleted,
    retryCount,
  } = useProfileCompletion();

  const [isExpanded, setIsExpanded] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const toggleExpand = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const toValue = isExpanded ? 0 : 1;

    Animated.spring(animation, {
      toValue,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start();

    setIsExpanded(!isExpanded);
  }, [isExpanded, animation]);

  const handleStepPress = useCallback((stepId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStepPress(stepId);
  }, [onStepPress]);

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refresh();
  }, [refresh]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const percentage = completionStatus?.percentage || 0;
  const completedSteps = completionStatus?.completedSteps || 0;
  const totalSteps = completionStatus?.totalSteps || 8;
  const canUploadVideo = completionStatus?.canUploadVideo || false;

  const getProgressColor = (): [string, string] => {
    if (percentage >= 80) return ['#22c55e', '#16a34a']; // Green
    if (percentage >= 50) return ['#eab308', '#ca8a04']; // Yellow
    if (percentage >= 30) return ['#f97316', '#ea580c']; // Orange
    return ['#ef4444', '#dc2626']; // Red
  };

  const progressColors = getProgressColor();

  const maxHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500],
  });

  const rotateArrow = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // ============================================================================
  // RENDER: Loading State
  // ============================================================================

  if (isLoading && !completionStatus) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="hourglass-outline" size={24} color="#666" />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </View>
    );
  }

  // ============================================================================
  // RENDER: Error State
  // ============================================================================

  if (error && !completionStatus) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={24} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          {retryCount < 3 && (
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
              <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ============================================================================
  // RENDER: Main Content
  // ============================================================================

  return (
    <View style={styles.container}>
      {/* Header - Always visible */}
      <TouchableOpacity style={styles.header} onPress={toggleExpand} activeOpacity={0.8}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={24} color={progressColors[0]} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>إكمال البروفايل</Text>
            <Text style={styles.subtitle}>
              {completedSteps} من {totalSteps} خطوات مكتملة
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Text style={[styles.percentage, { color: progressColors[0] }]}>{percentage}%</Text>
          <Animated.View style={{ transform: [{ rotate: rotateArrow }] }}>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <LinearGradient
            colors={progressColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: `${percentage}%` }]}
          />
        </View>
      </View>

      {/* Upload Video Warning */}
      {!canUploadVideo && (
        <View style={styles.warningContainer}>
          <Ionicons name="warning" size={16} color="#f97316" />
          <Text style={styles.warningText}>أكمل 3 خطوات على الأقل لرفع الفيديوهات</Text>
        </View>
      )}

      {/* Expandable Steps List */}
      <Animated.View style={[styles.stepsContainer, { maxHeight }]}>
        {isExpanded && completionStatus?.steps && (
          <View style={styles.stepsList}>
            {completionStatus.steps.map((step) => (
              <TouchableOpacity
                key={step.id}
                style={[styles.stepItem, step.completed && styles.stepItemCompleted]}
                onPress={() => !step.completed && handleStepPress(step.id)}
                activeOpacity={step.completed ? 1 : 0.7}
                disabled={step.completed}
              >
                <View style={styles.stepLeft}>
                  <View
                    style={[
                      styles.stepIconContainer,
                      step.completed && styles.stepIconContainerCompleted,
                    ]}
                  >
                    {step.completed ? (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    ) : (
                      <Ionicons name={getStepIcon(step.id)} size={16} color="#666" />
                    )}
                  </View>
                  <View style={styles.stepTextContainer}>
                    <Text style={[styles.stepLabel, step.completed && styles.stepLabelCompleted]}>
                      {step.label}
                    </Text>
                    {step.required && !step.completed && (
                      <Text style={styles.requiredBadge}>مطلوب</Text>
                    )}
                  </View>
                </View>

                {!step.completed && <Ionicons name="chevron-forward" size={18} color="#666" />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
};

// ============================================================================
// HELPER: Get Step Icon
// ============================================================================

function getStepIcon(stepId: string): keyof typeof Ionicons.glyphMap {
  switch (stepId) {
    case 'avatar':
      return 'person-circle-outline';
    case 'country':
      return 'globe-outline';
    case 'club':
      return 'football-outline';
    case 'bio':
      return 'document-text-outline';
    case 'position':
      return 'location-outline';
    case 'cardData':
      return 'card-outline';
    case 'brand':
      return 'shirt-outline';
    case 'socialLinks':
      return 'link-outline';
    default:
      return 'checkmark-circle-outline';
  }
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#999',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentage: {
    fontSize: 18,
    fontWeight: '800',
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#f97316',
    flex: 1,
  },
  stepsContainer: {
    overflow: 'hidden',
  },
  stepsList: {
    paddingTop: 8,
  },
  stepItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stepItemCompleted: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  stepLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepIconContainerCompleted: {
    backgroundColor: '#22c55e',
  },
  stepTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepLabel: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  stepLabelCompleted: {
    color: '#22c55e',
  },
  requiredBadge: {
    fontSize: 10,
    color: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '600',
  },
});

export default ProfileCompletionCard;
