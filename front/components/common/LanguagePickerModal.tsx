/**
 * Language Picker Modal Component
 * 
 * Displays all 8 supported languages with flags and native names.
 * Allows users to select their preferred language with visual feedback.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { SUPPORTED_LANGUAGES, Language, LanguageInfo } from '../../src/i18n/types';
import { useTranslation } from '../../src/i18n/useTranslation';

interface LanguagePickerModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Optional callback after language is changed */
  onLanguageChange?: (language: Language) => void;
}

/**
 * LanguagePickerModal Component
 * 
 * Requirements:
 * - 7.1: Display all 8 supported languages
 * - 7.2: Show each language name in its native script
 * - 7.3: Show a flag for each language
 * - 7.4: Visually indicate the current selection
 */
export default function LanguagePickerModal({
  visible,
  onClose,
  onLanguageChange,
}: LanguagePickerModalProps) {
  const { language: currentLanguage, setLanguage, t, isRTL } = useTranslation();
  const [isChanging, setIsChanging] = useState(false);
  const [changingLanguage, setChangingLanguage] = useState<Language | null>(null);

  /**
   * Handle language selection
   * Shows loading state while changing language
   */
  const handleSelectLanguage = useCallback(async (langInfo: LanguageInfo) => {
    if (langInfo.code === currentLanguage) {
      onClose();
      return;
    }

    setIsChanging(true);
    setChangingLanguage(langInfo.code);

    try {
      await setLanguage(langInfo.code);
      onLanguageChange?.(langInfo.code);
      onClose();
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setIsChanging(false);
      setChangingLanguage(null);
    }
  }, [currentLanguage, setLanguage, onLanguageChange, onClose]);

  /**
   * Render a single language item
   * Requirements: 7.2, 7.3, 7.4
   */
  const renderLanguageItem = useCallback(({ item }: { item: LanguageInfo }) => {
    const isSelected = item.code === currentLanguage;
    const isLoading = changingLanguage === item.code;

    return (
      <TouchableOpacity
        style={[
          styles.item,
          isSelected && styles.selectedItem,
        ]}
        onPress={() => handleSelectLanguage(item)}
        disabled={isChanging}
        activeOpacity={0.7}
      >
        {/* Flag emoji - Requirements: 7.3 */}
        <Text style={styles.flag}>{item.flag}</Text>
        
        {/* Language names container */}
        <View style={styles.nameContainer}>
          {/* Native name - Requirements: 7.2 */}
          <Text style={[styles.nativeName, isSelected && styles.selectedText]}>
            {item.nativeName}
          </Text>
          {/* English name for reference */}
          <Text style={styles.englishName}>{item.name}</Text>
        </View>

        {/* Selection indicator - Requirements: 7.4 */}
        {isLoading ? (
          <ActivityIndicator size="small" color="#22c55e" />
        ) : isSelected ? (
          <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
        ) : null}
      </TouchableOpacity>
    );
  }, [currentLanguage, changingLanguage, isChanging, handleSelectLanguage]);

  const keyExtractor = useCallback((item: LanguageInfo) => item.code, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

        <View style={[styles.content, isRTL && styles.contentRTL]}>
          {/* Header */}
          <View style={[styles.header, isRTL && styles.headerRTL]}>
            <Text style={styles.title}>
              {t?.settings?.language || 'Language'}
            </Text>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              disabled={isChanging}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Language list - Requirements: 7.1 */}
          <FlatList
            data={SUPPORTED_LANGUAGES as unknown as LanguageInfo[]}
            keyExtractor={keyExtractor}
            renderItem={renderLanguageItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  content: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  contentRTL: {
    // RTL-specific styles if needed
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    flex: 1,
  },
  closeButton: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  selectedItem: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 12,
    borderBottomWidth: 0,
    marginVertical: 2,
  },
  flag: {
    fontSize: 32,
    marginRight: 16,
  },
  nameContainer: {
    flex: 1,
  },
  nativeName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  englishName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  selectedText: {
    color: '#22c55e',
  },
});
