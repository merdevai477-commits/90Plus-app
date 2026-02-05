/**
 * Terms of Service Modal
 * Apple Compliance - Guideline 1.2
 * 
 * Shows terms of service that user must accept before creating account
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../reels/constants';
import { getApiUrl } from '../../config/api.config';
import { logger } from '../../utils/logger';

const { width, height } = Dimensions.get('window');

interface TermsOfServiceModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({
  visible,
  onAccept,
  onDecline,
}) => {
  const [termsContent, setTermsContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      fetchTerms();
    }
  }, [visible]);

  const fetchTerms = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiUrl()}/terms/latest`);
      const data = await response.json();

      if (data.status === 'SUCCESS') {
        setTermsContent(data.data.content);
      } else {
        throw new Error('Failed to load terms');
      }
    } catch (error) {
      logger.error('Error fetching terms:', error);
      setTermsContent('Failed to load terms of service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isCloseToBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = () => {
    if (accepted && hasScrolledToBottom) {
      onAccept();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onDecline}
    >
      <LinearGradient
        colors={[COLORS.background, COLORS.cardBackground]}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Terms of Service</Text>
          <Text style={styles.subtitle}>Please read and accept to continue</Text>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading terms...</Text>
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.content}>{termsContent}</Text>
            </ScrollView>

            {/* Scroll Indicator */}
            {!hasScrolledToBottom && (
              <View style={styles.scrollIndicator}>
                <Ionicons name="arrow-down" size={20} color={COLORS.primary} />
                <Text style={styles.scrollIndicatorText}>
                  Scroll to read all terms
                </Text>
              </View>
            )}

            {/* Checkbox */}
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAccepted(!accepted)}
              disabled={!hasScrolledToBottom}
            >
              <View
                style={[
                  styles.checkbox,
                  accepted && styles.checkboxChecked,
                  !hasScrolledToBottom && styles.checkboxDisabled,
                ]}
              >
                {accepted && (
                  <Ionicons name="checkmark" size={18} color={COLORS.white} />
                )}
              </View>
              <Text
                style={[
                  styles.checkboxText,
                  !hasScrolledToBottom && styles.checkboxTextDisabled,
                ]}
              >
                I have read and agree to the Terms of Service
              </Text>
            </TouchableOpacity>

            {/* Buttons */}
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={onDecline}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  (!accepted || !hasScrolledToBottom) && styles.acceptButtonDisabled,
                ]}
                onPress={handleAccept}
                disabled={!accepted || !hasScrolledToBottom}
              >
                <LinearGradient
                  colors={
                    accepted && hasScrolledToBottom
                      ? [COLORS.primary, COLORS.secondary]
                      : [COLORS.gray, COLORS.gray]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.acceptButtonGradient}
                >
                  <Text style={styles.acceptButtonText}>Accept & Continue</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        )}
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
    marginTop: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  content: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.text,
  },
  scrollIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  scrollIndicatorText: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.cardBackground,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxDisabled: {
    opacity: 0.5,
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  checkboxTextDisabled: {
    opacity: 0.5,
  },
  buttonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
    gap: 12,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  acceptButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptButtonDisabled: {
    opacity: 0.5,
  },
  acceptButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});
