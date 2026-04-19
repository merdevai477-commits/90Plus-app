/**
 * ReportButton Component
 * Reusable report button for any content type
 * 
 * Usage:
 * <ReportButton contentType="reel" contentId={reel.id} />
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ReportSystem } from './ReportSystem';
import { useReportSystem } from '../../hooks/useReportSystem';

interface ReportButtonProps {
  contentType: 'reel' | 'comment' | 'user';
  contentId: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
  onReportSuccess?: () => void;
}

export const ReportButton: React.FC<ReportButtonProps> = ({
  contentType,
  contentId,
  size = 24,
  color = '#FF3B30',
  style,
  onReportSuccess,
}) => {
  const { isVisible, reportConfig, openReport, closeReport, handleSuccess, getToken } =
    useReportSystem({
      onSuccess: onReportSuccess,
    });

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openReport({ contentType, contentId });
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.button, style]}
        onPress={handlePress}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="flag-outline" size={size} color={color} />
      </TouchableOpacity>

      {reportConfig && (
        <ReportSystem
          visible={isVisible}
          onClose={closeReport}
          contentType={reportConfig.contentType}
          contentId={reportConfig.contentId}
          getToken={getToken}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
