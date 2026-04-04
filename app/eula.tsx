/**
 * EULA Screen
 * Apple Compliance - Guideline 1.2
 * 
 * Shows Terms of Use before accessing UGC content
 * User must scroll to bottom and accept before continuing
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getApiUrl } from '../config/api.config';
import { logger } from '../utils/logger';

const COLORS = {
  background: '#0A0E27',
  backgroundCard: '#1A1F3A',
  primary: '#00D9FF',
  error: '#FF3B30',
  white: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
};

const EULA_VERSION = '1.0';

export default function EULAScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isAtBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleAccept = async () => {
    try {
      setIsAccepting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const token = await getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Call backend to accept EULA
      const response = await fetch(`${getApiUrl()}/eula/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ version: EULA_VERSION }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to accept EULA');
      }

      // Store acceptance in AsyncStorage
      await AsyncStorage.setItem('eula_accepted', 'true');
      await AsyncStorage.setItem('eula_version', EULA_VERSION);
      await AsyncStorage.setItem('eula_accepted_at', new Date().toISOString());

      logger.info('EULA accepted successfully');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to main app
      router.replace('/(tabs)/Home');
    } catch (error: any) {
      logger.error('Failed to accept EULA:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to accept Terms of Use. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Terms Required',
      'You must accept the Terms of Use to use 90Plus. Would you like to exit?',
      [
        { text: 'Review Again', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: () => {
            // User declined - logout
            router.replace('/auth');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[COLORS.background, COLORS.backgroundCard]}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={48} color={COLORS.primary} />
          <Text style={styles.title}>Terms of Use</Text>
          <Text style={styles.subtitle}>Please read and accept to continue</Text>
        </View>

        {/* EULA Content */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>90Plus - Terms of Use (EULA)</Text>
            <Text style={styles.version}>Version {EULA_VERSION}</Text>
            <Text style={styles.date}>Effective Date: April 4, 2026</Text>

            <Text style={styles.sectionTitle}>1. Zero Tolerance Policy</Text>
            <Text style={styles.paragraph}>
              90Plus has ZERO TOLERANCE for objectionable content or abusive behavior. We are
              committed to maintaining a safe and respectful community for all users.
            </Text>

            <Text style={styles.sectionTitle}>2. Prohibited Content</Text>
            <Text style={styles.paragraph}>
              You may NOT post, upload, or share content that contains:
            </Text>
            <Text style={styles.bulletPoint}>• Nudity or sexual content</Text>
            <Text style={styles.bulletPoint}>• Violence, gore, or graphic content</Text>
            <Text style={styles.bulletPoint}>• Hate speech or discrimination</Text>
            <Text style={styles.bulletPoint}>• Harassment, bullying, or threats</Text>
            <Text style={styles.bulletPoint}>• Spam or misleading information</Text>
            <Text style={styles.bulletPoint}>• Copyright violations</Text>
            <Text style={styles.bulletPoint}>• Illegal activities or content</Text>

            <Text style={styles.sectionTitle}>3. Content Removal Rights</Text>
            <Text style={styles.paragraph}>
              We reserve the RIGHT to remove ANY content without notice or explanation. We reserve
              the RIGHT to suspend or ban user accounts without notice for violations of these
              terms.
            </Text>

            <Text style={styles.sectionTitle}>4. User Responsibilities</Text>
            <Text style={styles.paragraph}>By using 90Plus, you agree to:</Text>
            <Text style={styles.bulletPoint}>• NOT post objectionable content</Text>
            <Text style={styles.bulletPoint}>• NOT engage in abusive behavior</Text>
            <Text style={styles.bulletPoint}>• REPORT violations immediately</Text>
            <Text style={styles.bulletPoint}>• RESPECT other users and community guidelines</Text>
            <Text style={styles.bulletPoint}>
              • ACCEPT that violations may result in immediate account suspension
            </Text>

            <Text style={styles.sectionTitle}>5. Reporting Mechanism</Text>
            <Text style={styles.paragraph}>
              You can report inappropriate content or users by:
            </Text>
            <Text style={styles.bulletPoint}>• Long-pressing on any content</Text>
            <Text style={styles.bulletPoint}>• Tapping the report button on user profiles</Text>
            <Text style={styles.bulletPoint}>• Using the in-app report system</Text>
            <Text style={styles.paragraph}>
              All reports are reviewed within 24 hours. We take action swiftly to protect our
              community.
            </Text>

            <Text style={styles.sectionTitle}>6. Blocking Users</Text>
            <Text style={styles.paragraph}>
              You can block any user to prevent them from:
            </Text>
            <Text style={styles.bulletPoint}>• Viewing your profile or content</Text>
            <Text style={styles.bulletPoint}>• Contacting or interacting with you</Text>
            <Text style={styles.bulletPoint}>• Appearing in your feed</Text>
            <Text style={styles.paragraph}>
              Blocked users are immediately removed from your experience.
            </Text>

            <Text style={styles.sectionTitle}>7. Consequences of Violations</Text>
            <Text style={styles.paragraph}>Violations may result in:</Text>
            <Text style={styles.bulletPoint}>• Immediate content removal</Text>
            <Text style={styles.bulletPoint}>• Account warnings or strikes</Text>
            <Text style={styles.bulletPoint}>• Temporary account suspension (7-30 days)</Text>
            <Text style={styles.bulletPoint}>• Permanent account ban</Text>
            <Text style={styles.bulletPoint}>• No refunds for banned accounts</Text>

            <Text style={styles.sectionTitle}>8. Moderation & Review</Text>
            <Text style={styles.paragraph}>
              Our moderation team reviews all reports and takes appropriate action. We use both
              automated systems and human review to ensure community safety. Decisions are final
              and may not be appealed.
            </Text>

            <Text style={styles.sectionTitle}>9. Your Agreement</Text>
            <Text style={styles.paragraph}>
              By accepting these Terms of Use, you acknowledge that you have read, understood, and
              agree to be bound by these terms. You understand that violations will result in
              immediate action, including potential account termination without notice or refund.
            </Text>

            <Text style={styles.sectionTitle}>10. Contact</Text>
            <Text style={styles.paragraph}>
              For questions or concerns, contact us at:
            </Text>
            <Text style={styles.bulletPoint}>• Email: support@90plus.app</Text>
            <Text style={styles.bulletPoint}>• Safety: safety@90plus.app</Text>

            <View style={styles.bottomSpacer} />
          </View>
        </ScrollView>

        {/* Scroll Indicator */}
        {!hasScrolledToBottom && (
          <View style={styles.scrollIndicator}>
            <Ionicons name="arrow-down" size={20} color={COLORS.primary} />
            <Text style={styles.scrollText}>Scroll to bottom to continue</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={handleDecline}
            disabled={isAccepting}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.acceptButton,
              (!hasScrolledToBottom || isAccepting) && styles.acceptButtonDisabled,
            ]}
            onPress={handleAccept}
            disabled={!hasScrolledToBottom || isAccepting}
          >
            <LinearGradient
              colors={
                hasScrolledToBottom && !isAccepting
                  ? [COLORS.primary, '#00B8D4']
                  : ['#4A4A4A', '#3A3A3A']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.acceptButtonGradient}
            >
              {isAccepting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Text style={styles.acceptButtonText}>Accept & Continue</Text>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradient: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glassBorder,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  content: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: 20,
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  date: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginLeft: 12,
    marginBottom: 6,
  },
  bottomSpacer: {
    height: 40,
  },
  scrollIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: `${COLORS.primary}15`,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary,
    gap: 8,
  },
  scrollText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 30,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.glassBorder,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.error,
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.error,
  },
  acceptButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  acceptButtonDisabled: {
    opacity: 0.5,
  },
  acceptButtonGradient: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});
