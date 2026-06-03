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
import { WebView } from 'react-native-webview';
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
      // Use /terms directly (not /api/terms)
      const termsUrl = `${getApiUrl()}/terms`;
      setTermsContent(termsUrl);
      setLoading(false);
    } catch (error) {
      logger.error('Error loading terms:', error);
      setTermsContent('');
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
        colors={[COLORS.background, COLORS.backgroundCard]}
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
        ) : termsContent ? (
          <>
            <WebView
              source={{ uri: termsContent }}
              style={styles.webView}
              onScroll={(event) => {
                const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
                const paddingToBottom = 20;
                const isCloseToBottom =
                  layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

                if (isCloseToBottom && !hasScrolledToBottom) {
                  setHasScrolledToBottom(true);
                }
              }}
              onLoadEnd={() => setLoading(false)}
              onError={(error) => {
                logger.error('WebView error:', error);
                setTermsContent('');
              }}
            />

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
                I have read and agree to the Terms of Service, and I expressly
                acknowledge that I am at least 13 years of age.
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
                      : [COLORS.darkGray, COLORS.mediumGray]
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
        ) : (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Failed to load terms. Please try again.</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={fetchTerms}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
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
    borderBottomColor: COLORS.glassBorder,
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
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
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
    color: COLORS.textPrimary,
  },
  webView: {
    flex: 1,
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  scrollIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: COLORS.backgroundCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.glassBorder,
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
    backgroundColor: COLORS.backgroundCard,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.glassBorder,
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
    color: COLORS.textPrimary,
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
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
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
