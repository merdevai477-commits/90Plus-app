import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../src/i18n';

interface QuizScorePopupProps {
  visible: boolean;
  score: number;
  total: number;
  xpEarned: number;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export const QuizScorePopup: React.FC<QuizScorePopupProps> = ({ visible, score, total, xpEarned, onClose }) => {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <Modal transparent animationType="slide" visible={visible}>
      <BlurView intensity={80} tint="dark" style={styles.container}>
        <View style={styles.popup}>
          <LinearGradient
            colors={['rgba(20, 10, 40, 0.95)', 'rgba(10, 5, 20, 0.98)']}
            style={styles.gradient}
          >
            <View style={styles.iconContainer}>
              <Ionicons name="trophy" size={48} color="#FFD700" />
            </View>
            <Text style={styles.title}>{t.quiz?.quizCompleted || 'Quiz Completed!'}</Text>
            
            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Score</Text>
                <Text style={styles.statValue}>{score} / {total}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>XP Earned</Text>
                <Text style={[styles.statValue, { color: '#4ADE80' }]}>+{xpEarned}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.8}>
              <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.buttonGradient}>
                <Text style={styles.buttonText}>Continue</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  popup: {
    width: width * 0.9,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  gradient: {
    padding: 32,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 8,
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  button: {
    width: '100%',
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
