import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
  Image,
  ScrollView,
  Modal,
  Vibration,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QUIZ_QUESTIONS, Question } from '@/constants/quizData';
import { 
  Pause, 
  Play,
  SkipForward, 
  Lightbulb, 
  Heart,
  Zap,
  Trophy,
  Volume2,
  VolumeX,
  RotateCcw,
  Star,
  Award,
  Target,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

// ثوابت التحسينات
const STREAK_MULTIPLIER = 1.5;
const HINT_COST = 10;
const MAX_QUESTIONS = 20; // حد أقصى 20 سؤال

export default function QuizScreen() {
  // تحديد 20 سؤال فقط
  const gameQuestions = QUIZ_QUESTIONS.slice(0, MAX_QUESTIONS);
  
  // States الأساسية
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showResult, setShowResult] = useState(false);

  // States التحسينات
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [coins, setCoins] = useState(50);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [powerUps, setPowerUps] = useState({
    doublePoints: false,
    freezeTime: false,
    fiftyFifty: false,
  });
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [bestStreak, setBestStreak] = useState(0);
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);
  const [showImage, setShowImage] = useState(false); // للتحكم في إظهار الصورة

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const optionAnims = useRef(
    Array(4).fill(0).map(() => new Animated.Value(0))
  ).current;
  const streakAnim = useRef(new Animated.Value(0)).current;
  const heartAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const imageScaleAnim = useRef(new Animated.Value(0.9)).current;
  const imageFadeAnim = useRef(new Animated.Value(0)).current; // أنيميشن ظهور الصورة

  const currentQuestion = gameQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / gameQuestions.length) * 100;

  // Progress Animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    animateQuestionEntry();
    setHintUsed(false);
    setEliminatedOptions([]);
    setShowImage(false); // إخفاء الصورة عند السؤال الجديد
    imageFadeAnim.setValue(0);
  }, [currentQuestionIndex]);

  const animateQuestionEntry = () => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
    imageScaleAnim.setValue(0.9);
    optionAnims.forEach(anim => anim.setValue(0));

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    optionAnims.forEach((anim, index) => {
      Animated.sequence([
        Animated.delay(index * 100),
        Animated.spring(anim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const animateImageReveal = () => {
    setShowImage(true);
    Animated.parallel([
      Animated.timing(imageFadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(imageScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 35,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const shakeAnimation = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleAnswerSelect = async (answerIndex: number) => {
    if (isAnswered || eliminatedOptions.includes(answerIndex)) return;

    if (soundEnabled && Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setSelectedAnswer(answerIndex);
    setIsAnswered(true);
    setTotalQuestions(prev => prev + 1);

    // إظهار الصورة بعد الإجابة (إذا كانت موجودة)
    if (currentQuestion.image) {
      animateImageReveal();
    }

    const isCorrect = answerIndex === currentQuestion.correctAnswer;
    
    if (isCorrect) {
      const basePoints = currentQuestion.points;
      const streakBonus = streak > 0 ? Math.floor(basePoints * 0.2 * streak) : 0;
      const doubleBonus = powerUps.doublePoints ? basePoints : 0;
      const totalPoints = basePoints + streakBonus + doubleBonus;
      
      setScore(prev => prev + totalPoints);
      setCorrectAnswers(prev => prev + 1);
      setStreak(prev => {
        const newStreak = prev + 1;
        if (newStreak > bestStreak) {
          setBestStreak(newStreak);
        }
        if (newStreak >= 3) {
          animateStreak();
        }
        return newStreak;
      });
      setCoins(prev => prev + 5);
      
      if (soundEnabled && Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      setStreak(0);
      setLives(prev => Math.max(0, prev - 1));
      
      if (soundEnabled && Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Vibration.vibrate(500);
      }
      
      shakeAnimation();
    }

    animateResult(isCorrect);
    
    if (lives <= 1 && !isCorrect) {
      setTimeout(() => setShowResult(true), 2000);
    }
  };

  const animateStreak = () => {
    setShowStreakAnimation(true);
    Animated.sequence([
      Animated.spring(streakAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.delay(1000),
      Animated.timing(streakAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setShowStreakAnimation(false));
  };

  const animateResult = (isCorrect: boolean) => {
    resultAnim.setValue(0);
    Animated.sequence([
      Animated.spring(resultAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(resultAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (currentQuestionIndex < gameQuestions.length - 1 && lives > 0) {
        handleNextQuestion();
      } else {
        setShowResult(true);
      }
    });
  };

  const handleNextQuestion = () => {
    setSelectedAnswer(null);
    setIsAnswered(false);
    setCurrentQuestionIndex(prev => prev + 1);
    setPowerUps({
      doublePoints: false,
      freezeTime: false,
      fiftyFifty: false,
    });
  };

  const handleSkip = () => {
    if (coins >= 20 && currentQuestionIndex < gameQuestions.length - 1) {
      setCoins(prev => prev - 20);
      setSelectedAnswer(null);
      setIsAnswered(false);
      setTotalQuestions(prev => prev + 1);
      setCurrentQuestionIndex(prev => prev + 1);
      setStreak(0);
    }
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
  };

  const handleHint = () => {
    if (coins >= HINT_COST && !hintUsed) {
      setCoins(prev => prev - HINT_COST);
      setHintUsed(true);
      
      const wrongOptions = currentQuestion.options
        .map((_, index) => index)
        .filter(index => index !== currentQuestion.correctAnswer);
      
      const optionsToEliminate = wrongOptions
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);
      
      setEliminatedOptions(optionsToEliminate);
      
      if (soundEnabled && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setTotalQuestions(0);
    setCorrectAnswers(0);
    setShowResult(false);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setLives(3);
    setCoins(50);
    setStreak(0);
    setBestStreak(0);
    setShowImage(false);
  };

  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  if (showResult) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={['#0a0a0a', '#1a1a1a', '#0a0a0a']}
          style={styles.resultGradient}
        >
          <View style={styles.resultContainer}>
            <Animated.View style={styles.resultHeader}>
              <View style={styles.trophyContainer}>
                <LinearGradient
                  colors={['#fbbf24', '#f59e0b', '#fbbf24']}
                  style={styles.trophyGradient}
                >
                  <Trophy size={60} color="#fff" strokeWidth={2} />
                </LinearGradient>
              </View>
              <Text style={styles.resultTitle}>مبروك!</Text>
              <Text style={styles.resultSubtitle}>لقد أكملت الاختبار بنجاح</Text>
            </Animated.View>
            
            <View style={styles.resultScoreCard}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.05)']}
                style={styles.scoreGradient}
              >
                <Text style={styles.resultScore}>{score}</Text>
                <Text style={styles.resultLabel}>نقطة</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.resultStatsGrid}>
              <View style={styles.resultStatCard}>
                <View style={styles.statIconWrapper}>
                  <Target size={24} color="#10b981" />
                </View>
                <Text style={styles.resultStatValue}>{accuracy}%</Text>
                <Text style={styles.resultStatLabel}>دقة</Text>
              </View>
              
              <View style={styles.resultStatCard}>
                <View style={styles.statIconWrapper}>
                  <Award size={24} color="#fbbf24" />
                </View>
                <Text style={styles.resultStatValue}>{correctAnswers}</Text>
                <Text style={styles.resultStatLabel}>صحيحة</Text>
              </View>
              
              <View style={styles.resultStatCard}>
                <View style={styles.statIconWrapper}>
                  <Zap size={24} color="#f97316" />
                </View>
                <Text style={styles.resultStatValue}>{bestStreak}</Text>
                <Text style={styles.resultStatLabel}>أفضل سلسلة</Text>
              </View>
            </View>

            <View style={styles.resultCoinsCard}>
              <LinearGradient
                colors={['rgba(251, 191, 36, 0.15)', 'rgba(251, 191, 36, 0.05)']}
                style={styles.coinsGradientCard}
              >
                <Text style={styles.resultCoinsText}>💰 +{coins - 50} عملة ذهبية</Text>
              </LinearGradient>
            </View>
            
            <TouchableOpacity
              style={styles.restartButton}
              onPress={handleRestart}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.restartButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <RotateCcw size={22} color="#fff" strokeWidth={2.5} />
                <Text style={styles.restartButtonText}>لعب مرة أخرى</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      {/* خلفية ديناميكية */}
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a']}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <Animated.View 
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        >
          <LinearGradient
            colors={['#10b981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
      </View>

      {/* Header محسن */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.coinBadge} activeOpacity={0.8}>
              <LinearGradient
                colors={['rgba(251, 191, 36, 0.2)', 'rgba(251, 191, 36, 0.1)']}
                style={styles.coinGradient}
              >
                <Text style={styles.coinIcon}>💰</Text>
                <Text style={styles.coinValue}>{coins}</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <View style={styles.livesBadge}>
              {[...Array(3)].map((_, i) => (
                <Animated.View key={i} style={styles.heartWrapper}>
                  <Heart 
                    size={22} 
                    color={i < lives ? "#ef4444" : "#4a4a4a"} 
                    fill={i < lives ? "#ef4444" : "transparent"}
                  />
                </Animated.View>
              ))}
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.scoreContainer}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.1)']}
                style={styles.scoreGradientBadge}
              >
                <Trophy size={16} color="#10b981" />
                <Text style={styles.scoreValue}>{score}</Text>
              </LinearGradient>
            </View>
          </View>
        </View>
      </View>

      {/* Streak Animation */}
      {showStreakAnimation && (
        <Animated.View 
          style={[
            styles.streakBanner,
            {
              opacity: streakAnim,
              transform: [
                { scale: streakAnim },
                { translateY: streakAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 0],
                })},
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['#fbbf24', '#f59e0b']}
            style={styles.streakGradient}
          >
            <Text style={styles.streakText}>🔥 {streak} إجابات متتالية!</Text>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Main Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Question Card محسن */}
        <Animated.View
          style={[
            styles.questionCard,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateX: shakeAnim },
              ],
            },
          ]}
        >
          {/* عرض السؤال دائماً بنفس التنسيق */}
          <View style={styles.textOnlyQuestionContainer}>
            <View style={styles.categoryWrapper}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.1)']}
                style={styles.categoryGradient}
              >
                <Text style={styles.categoryText}>{currentQuestion.category}</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.questionTextWrapper}>
              <Text style={styles.questionTextOnly}>{currentQuestion.question}</Text>
            </View>
            
            <View style={styles.questionNumberBadge}>
              <Text style={styles.questionNumberText}>
                {currentQuestionIndex + 1} / {gameQuestions.length}
              </Text>
            </View>

            {/* عرض الصورة بعد الإجابة فقط */}
            {showImage && currentQuestion.image && (
              <Animated.View 
                style={[
                  styles.revealedImageContainer,
                  {
                    opacity: imageFadeAnim,
                    transform: [{ scale: imageScaleAnim }],
                  },
                ]}
              >
                <Image
                  source={{ uri: currentQuestion.image }}
                  style={[
                    styles.revealedImage,
                    currentQuestion.imageType === 'club' && styles.clubImage,
                  ]}
                  resizeMode={currentQuestion.imageType === 'club' ? 'contain' : 'cover'}
                />
              </Animated.View>
            )}
          </View>

          {/* Result Overlay */}
          {isAnswered && (
            <Animated.View
              style={[
                styles.resultOverlay,
                {
                  opacity: resultAnim,
                  transform: [
                    {
                      scale: resultAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <BlurView intensity={80} style={styles.blurOverlay}>
                <LinearGradient
                  colors={
                    selectedAnswer === currentQuestion.correctAnswer
                      ? ['rgba(16, 185, 129, 0.9)', 'rgba(5, 150, 105, 0.9)']
                      : ['rgba(239, 68, 68, 0.9)', 'rgba(220, 38, 38, 0.9)']
                  }
                  style={styles.resultGradientOverlay}
                >
                  <Text style={styles.resultEmoji}>
                    {selectedAnswer === currentQuestion.correctAnswer ? '🎉' : '😔'}
                  </Text>
                  <Text style={styles.resultMainText}>
                    {selectedAnswer === currentQuestion.correctAnswer ? 'ممتاز!' : 'خطأ!'}
                  </Text>
                  {selectedAnswer === currentQuestion.correctAnswer && (
                    <Text style={styles.resultPointsText}>+{currentQuestion.points} نقطة</Text>
                  )}
                </LinearGradient>
              </BlurView>
            </Animated.View>
          )}
        </Animated.View>

        {/* Options Grid محسن */}
        <View style={styles.optionsGrid}>
          {currentQuestion.options.map((option, index) => {
            const isCorrect = index === currentQuestion.correctAnswer;
            const isSelected = index === selectedAnswer;
            const shouldShowCorrect = isAnswered && isCorrect;
            const shouldShowWrong = isAnswered && isSelected && !isCorrect;
            const isEliminated = eliminatedOptions.includes(index);

            return (
              <Animated.View
                key={index}
                style={[
                  styles.optionWrapper,
                  {
                    opacity: isEliminated ? 0.4 : optionAnims[index],
                    transform: [
                      {
                        translateY: optionAnims[index].interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0],
                        }),
                      },
                      {
                        scale: isEliminated ? 0.95 : 1,
                      },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  style={[styles.optionTouchable]}
                  onPress={() => handleAnswerSelect(index)}
                  disabled={isAnswered || isEliminated}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      shouldShowCorrect
                        ? ['#10b981', '#059669']
                        : shouldShowWrong
                        ? ['#ef4444', '#dc2626']
                        : isEliminated
                        ? ['#3a3a3a', '#2a2a2a']
                        : isAnswered
                        ? ['#2a2a2a', '#1a1a1a']
                        : ['#1e293b', '#0f172a']
                    }
                    style={styles.optionGradient}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        shouldShowCorrect && styles.optionTextCorrect,
                        shouldShowWrong && styles.optionTextWrong,
                        isEliminated && styles.optionTextEliminated,
                      ]}
                    >
                      {option}
                    </Text>
                    {shouldShowCorrect && (
                      <View style={styles.optionIcon}>
                        <Text style={styles.checkIcon}>✓</Text>
                      </View>
                    )}
                    {shouldShowWrong && (
                      <View style={styles.optionIcon}>
                        <Text style={styles.crossIcon}>✗</Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Bar محسن */}
      <View style={styles.bottomBar}>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.bottomGradient}
        >
          <View style={styles.powerUpsRow}>
            <TouchableOpacity 
              style={[styles.powerUpButton, !hintUsed && coins >= HINT_COST && styles.powerUpActive]} 
              onPress={handleHint}
              disabled={hintUsed || coins < HINT_COST}
            >
              <LinearGradient
                colors={hintUsed || coins < HINT_COST ? ['#2a2a2a', '#1a1a1a'] : ['#fbbf24', '#f59e0b']}
                style={styles.powerUpGradient}
              >
                <Lightbulb size={20} color="#fff" />
                <Text style={styles.powerUpText}>{HINT_COST}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.pauseButton} onPress={handlePause}>
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                style={styles.pauseGradient}
              >
                {isPaused ? <Play size={24} color="#fff" /> : <Pause size={24} color="#fff" />}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.powerUpButton, coins >= 20 && styles.powerUpActive]} 
              onPress={handleSkip}
              disabled={coins < 20}
            >
              <LinearGradient
                colors={coins < 20 ? ['#2a2a2a', '#1a1a1a'] : ['#10b981', '#059669']}
                style={styles.powerUpGradient}
              >
                <SkipForward size={20} color="#fff" />
                <Text style={styles.powerUpText}>20</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* Pause Modal */}
      <Modal
        visible={isPaused}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPaused(false)}
      >
        <BlurView intensity={100} style={styles.pauseOverlay}>
          <View style={styles.pauseModal}>
            <LinearGradient
              colors={['#1e293b', '#0f172a']}
              style={styles.pauseModalGradient}
            >
              <View style={styles.pauseIconWrapper}>
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  style={styles.pauseIconGradient}
                >
                  <Pause size={40} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.pauseTitle}>اللعبة متوقفة</Text>
              <Text style={styles.pauseSubtitle}>اضغط للمتابعة</Text>
              <TouchableOpacity
                style={styles.resumeButton}
                onPress={() => setIsPaused(false)}
              >
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  style={styles.resumeGradient}
                >
                  <Play size={22} color="#fff" />
                  <Text style={styles.resumeText}>استمرار</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coinBadge: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  coinGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  coinIcon: {
    fontSize: 16,
  },
  coinValue: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: 'bold',
  },
  livesBadge: {
    flexDirection: 'row',
    gap: 6,
  },
  heartWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreContainer: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  scoreGradientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  scoreValue: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: 'bold',
  },
  streakBanner: {
    position: 'absolute',
    top: 140,
    alignSelf: 'center',
    borderRadius: 30,
    overflow: 'hidden',
    zIndex: 100,
  },
  streakGradient: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  streakText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  questionCard: {
    marginTop: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textOnlyQuestionContainer: {
    padding: 24,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
  },
  categoryWrapper: {
    marginBottom: 20,
    borderRadius: 25,
    overflow: 'hidden',
  },
  categoryGradient: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  categoryText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  questionTextWrapper: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  questionTextOnly: {
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 30,
    fontWeight: '600',
  },
  questionNumberBadge: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  questionNumberText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  revealedImageContainer: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
  },
  revealedImage: {
    width: width - 112,
    height: 180,
    borderRadius: 12,
  },
  clubImage: {
    width: 100,
    height: 100,
    backgroundColor: 'transparent',
  },
  resultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultGradientOverlay: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    minWidth: 250,
  },
  resultEmoji: {
    fontSize: 72,
    marginBottom: 12,
  },
  resultMainText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  resultPointsText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  optionsGrid: {
    marginTop: 20,
    gap: 12,
  },
  optionWrapper: {
    width: '100%',
    marginBottom: 8,
  },
  optionTouchable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  optionGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  optionText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
    flex: 1,
  },
  optionTextCorrect: {
    fontWeight: 'bold',
  },
  optionTextWrong: {
    fontWeight: 'bold',
  },
  optionTextEliminated: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  optionIcon: {
    marginLeft: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  crossIcon: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomGradient: {
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 20,
  },
  powerUpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  powerUpButton: {
    borderRadius: 30,
    overflow: 'hidden',
    opacity: 0.6,
  },
  powerUpActive: {
    opacity: 1,
  },
  powerUpGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 6,
  },
  powerUpText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  pauseButton: {
    borderRadius: 35,
    overflow: 'hidden',
  },
  pauseGradient: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseModal: {
    borderRadius: 32,
    overflow: 'hidden',
    width: width * 0.85,
  },
  pauseModalGradient: {
    padding: 40,
    alignItems: 'center',
  },
  pauseIconWrapper: {
    marginBottom: 24,
    borderRadius: 40,
    overflow: 'hidden',
  },
  pauseIconGradient: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  pauseSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 32,
  },
  resumeButton: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  resumeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    gap: 8,
  },
  resumeText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  resultGradient: {
    flex: 1,
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  trophyContainer: {
    marginBottom: 20,
    borderRadius: 50,
    overflow: 'hidden',
  },
  trophyGradient: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  resultScoreCard: {
    marginBottom: 32,
    borderRadius: 24,
    overflow: 'hidden',
  },
  scoreGradient: {
    paddingHorizontal: 48,
    paddingVertical: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 24,
  },
  resultScore: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 4,
  },
  resultLabel: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
  },
  resultStatsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
  },
  resultStatCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    minWidth: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statIconWrapper: {
    marginBottom: 12,
  },
  resultStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  resultStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  resultCoinsCard: {
    marginBottom: 32,
    borderRadius: 20,
    overflow: 'hidden',
  },
  coinsGradientCard: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 20,
  },
  resultCoinsText: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: 'bold',
  },
  restartButton: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  restartButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 16,
    gap: 10,
  },
  restartButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});