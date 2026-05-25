import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../../src/i18n';

interface QuizLanguagePopupProps {
  onSelectLanguage: (lang: 'ar' | 'en') => void;
}

const { width } = Dimensions.get('window');

export const QuizLanguagePopup: React.FC<QuizLanguagePopupProps> = ({ onSelectLanguage }) => {
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const checkPopup = async () => {
      try {
        const shown = await AsyncStorage.getItem('quiz_lang_popup_shown');
        if (!shown) {
          setVisible(true);
        }
      } catch {
        // ignore
      }
    };
    checkPopup();
  }, []);

  const handleSelect = async (lang: 'ar' | 'en') => {
    try {
      await AsyncStorage.setItem('quiz_lang_popup_shown', 'true');
      await AsyncStorage.setItem('quiz_language', lang);
    } catch {
      // ignore
    }
    setVisible(false);
    onSelectLanguage(lang);
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.container}>
        <View style={styles.popup}>
          <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
            style={styles.gradient}
          >
            <Text style={styles.title}>{t.quiz.chooseLangTitle}</Text>
            <Text style={styles.subtitle}>{t.quiz.chooseLangSubtitle}</Text>

            <TouchableOpacity style={styles.button} onPress={() => handleSelect('ar')} activeOpacity={0.8}>
              <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.buttonGradient}>
                <Text style={styles.buttonText}>{t.quiz.langArabic}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={() => handleSelect('en')} activeOpacity={0.8}>
              <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.buttonGradient}>
                <Text style={styles.buttonText}>{t.quiz.langEnglish}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  popup: {
    width: width * 0.85,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  gradient: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    width: '100%',
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
