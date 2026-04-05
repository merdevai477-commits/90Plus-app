/**
 * Blocked Screen (Under 13)
 * 
 * Shown to users under 13 years old
 * COPPA compliance - cannot allow access
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../src/i18n';
import * as Updates from 'expo-updates';

export default function BlockedScreen() {
  const { translate: t, language, isRTL } = useTranslation();

  const handleExit = async () => {
    // Close the app (iOS will minimize, Android will exit)
    if (Updates.isEnabled) {
      await Updates.reloadAsync();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="sad-outline" size={100} color="#ef4444" />
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {t('blocked.title') || 'Sorry!'}
        </Text>

        {/* Message */}
        <Text style={styles.message}>
          {t('blocked.message') || 'You must be at least 13 years old to use 90Plus'}
        </Text>

        {/* Legal Info */}
        <View style={styles.legalContainer}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#6b7280" />
          <Text style={styles.legalText}>
            {t('blocked.legal') || 'This is required by law (COPPA compliance)'}
          </Text>
        </View>

        {/* Exit Button */}
        <TouchableOpacity
          style={styles.exitButton}
          onPress={handleExit}
        >
          <Text style={styles.exitButtonText}>
            {t('blocked.exit') || 'Exit App'}
          </Text>
        </TouchableOpacity>

        {/* Support Link */}
        <TouchableOpacity
          style={styles.supportLink}
          onPress={() => {/* TODO: Open support */}}
        >
          <Text style={styles.supportLinkText}>
            {t('blocked.support') || 'Contact Support'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    lineHeight: 26,
  },
  legalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 48,
    maxWidth: 400,
  },
  legalText: {
    fontSize: 14,
    color: '#9ca3af',
    marginLeft: 12,
    flex: 1,
    textAlign: 'center',
  },
  exitButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    marginBottom: 16,
  },
  exitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  supportLink: {
    marginTop: 16,
  },
  supportLinkText: {
    fontSize: 14,
    color: '#22c55e',
    textDecorationLine: 'underline',
  },
});
