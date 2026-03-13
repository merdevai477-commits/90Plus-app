/**
 * Profile Tasks Modal Component
 * Shows profile completion tasks in a popup modal
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ProfileTaskStep {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  weight: number;
  icon: keyof typeof Ionicons.glyphMap;
}

interface ProfileTasksModalProps {
  visible: boolean;
  onClose: () => void;
  percentage: number;
  completedSteps: number;
  totalSteps: number;
  steps: ProfileTaskStep[];
  canUploadVideo: boolean;
  onStepPress: (stepId: string) => void;
}

export const ProfileTasksModal: React.FC<ProfileTasksModalProps> = ({
  visible,
  onClose,
  percentage,
  completedSteps,
  totalSteps,
  steps,
  canUploadVideo,
  onStepPress,
}) => {
  // Get color based on percentage
  const getProgressColor = () => {
    if (percentage >= 80) return ['#22c55e', '#16a34a']; // Green
    if (percentage >= 50) return ['#eab308', '#ca8a04']; // Yellow
    if (percentage >= 30) return ['#f97316', '#ea580c']; // Orange
    return ['#ef4444', '#dc2626']; // Red
  };

  const progressColors = getProgressColor();

  const handleStepPress = (stepId: string, completed: boolean) => {
    if (!completed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onStepPress(stepId);
      onClose();
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconContainer, { backgroundColor: `${progressColors[0]}20` }]}>
                <Ionicons name="checkmark-done" size={24} color={progressColors[0]} />
              </View>
              <View>
                <Text style={styles.title}>مهام البروفايل</Text>
                <Text style={styles.subtitle}>
                  {completedSteps} من {totalSteps} مكتملة
                </Text>
              </View>
            </View>
            
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
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
            <Text style={[styles.percentageText, { color: progressColors[0] }]}>
              {percentage}%
            </Text>
          </View>

          {/* Upload Video Warning */}
          {!canUploadVideo && (
            <View style={styles.warningContainer}>
              <Ionicons name="warning" size={18} color="#f97316" />
              <Text style={styles.warningText}>
                أكمل 3 خطوات على الأقل لرفع الفيديوهات
              </Text>
            </View>
          )}

          {/* Tasks List */}
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.tasksList}>
              {steps.map((step) => (
                <TouchableOpacity
                  key={step.id}
                  style={[
                    styles.taskItem,
                    step.completed && styles.taskItemCompleted,
                  ]}
                  onPress={() => handleStepPress(step.id, step.completed)}
                  activeOpacity={step.completed ? 1 : 0.7}
                  disabled={step.completed}
                >
                  <View style={styles.taskLeft}>
                    <View
                      style={[
                        styles.taskIconContainer,
                        step.completed && styles.taskIconContainerCompleted,
                      ]}
                    >
                      {step.completed ? (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      ) : (
                        <Ionicons name={step.icon} size={18} color="#666" />
                      )}
                    </View>
                    <View style={styles.taskTextContainer}>
                      <Text
                        style={[
                          styles.taskLabel,
                          step.completed && styles.taskLabelCompleted,
                        ]}
                      >
                        {step.label}
                      </Text>
                      <View style={styles.taskMeta}>
                        {step.required && !step.completed && (
                          <View style={styles.requiredBadge}>
                            <Text style={styles.requiredText}>مطلوب</Text>
                          </View>
                        )}
                        <Text style={styles.weightText}>+{step.weight}%</Text>
                      </View>
                    </View>
                  </View>

                  {!step.completed && (
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Footer Tip */}
          <View style={styles.footer}>
            <Ionicons name="bulb-outline" size={16} color="#eab308" />
            <Text style={styles.footerText}>
              أكمل بروفايلك للحصول على تجربة أفضل
            </Text>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.9,
    maxHeight: SCREEN_HEIGHT * 0.75,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#999',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  progressBarContainer: {
    flex: 1,
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  percentageText: {
    fontSize: 20,
    fontWeight: '800',
    minWidth: 50,
    textAlign: 'right',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 10,
    gap: 10,
  },
  warningText: {
    fontSize: 13,
    color: '#f97316',
    flex: 1,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  tasksList: {
    padding: 20,
    paddingTop: 8,
  },
  taskItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  taskItemCompleted: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  taskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  taskIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  taskIconContainerCompleted: {
    backgroundColor: '#22c55e',
  },
  taskTextContainer: {
    flex: 1,
  },
  taskLabel: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  taskLabelCompleted: {
    color: '#22c55e',
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requiredBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  requiredText: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '700',
  },
  weightText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#eab308',
    flex: 1,
  },
});
