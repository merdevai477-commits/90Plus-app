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
  ScrollView,
  Modal,
  Vibration,
  ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QUIZ_QUESTIONS, Question } from '@/constants/quizData';
import {
  Lightbulb,
  Heart,
  Zap,
  Trophy,
  RotateCcw,
  Star,
  Award,
  Target,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTranslation } from '../../src/i18n';
import { useCoins } from '../../contexts/CoinsContext';
import { CoinsBadge } from '../../components/common/CoinsBadge';
import { DailyQuizCategories } from '../../components/Quiz/DailyQuizCategories';
import { useAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { markQuizCompleted, getCurrentQuizState, getCurrentQuestions } from '../../services/quizLocalState';
import { getQuestionsByIds, getQuestionsByCategoryId, getQuestionsByCategoryIdWithDifficulty, QuizQuestion, DisplayMode } from '../../data/quizQuestions/index';
import { getQuizAnswers } from '../../services/quizApi';
import { prefetchQuizImages, extractImageUrlsFromQuestions } from '../../services/imageCache';
import { startDailyQuizSync, stopDailyQuizSync } from '../../services/dailyQuizSync';
import { 
  startQuizSession, 
  endQuizSession, 
  recordQuizLoadTime, 
  recordQuizAnswer, 
  recordQuizImageLoad,
  recordQuizError 
} from '../../services/quizPerformanceMonitor';

const { width, height } = Dimensions.get('window');

// ثوابت التحسينات
const STREAK_MULTIPLIER = 1.5;
const HINT_COST = 10;
const MAX_QUESTIONS = 20; // حد أقصى 20 سؤال

export default function QuizScreen() {
  const { t } = useTranslation();
  const { coins, addCoins, subtractCoins } = useCoins();
  const { isSignedIn, isLoaded, userId, getToken } = useAuth();

  // Prevent guest access - redirect to auth
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/auth');
    }
  }, [isLoaded, isSignedIn]);

  // بدء خدمة المزامنة والمراقبة عند تحميل الكومبوننت
  useEffect(() => {
    const initializeServices = async () => {
      if (isSignedIn && getToken) {
        // بدء خدمة المزامنة
        startDailyQuizSync(getToken);
        
        // بدء جلسة مراقبة الأداء
        const newSessionId = await startQuizSession();
        setSessionId(newSessionId);
      }
    };

    initializeServices();

    // تنظيف عند unmount
    return () => {
      stopDailyQuizSync();
      if (sessionId) {
        endQuizSession();
      }
    };
  }, [isSignedIn, getToken]);

  // States الأساسية - moved to top to avoid hoisting issues
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({}); // { questionId: correctAnswer }
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);

  // States التحسينات
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(5);
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
  const [blurIntensity, setBlurIntensity] = useState(20); // للصورة المشوشة في legends
  const [showQuestionText, setShowQuestionText] = useState(true); // للتحكم في عرض السؤال في flash mode
  const [imageLoading, setImageLoading] = useState(false); // حالة تحميل الصورة
  const [imageError, setImageError] = useState(false); // حالة خطأ في تحميل الصورة
  const [sessionId, setSessionId] = useState<string | null>(null); // معرف الجلسة
  const [answerStartTime, setAnswerStartTime] = useState<number>(0); // وقت بداية الإجابة

  // Derived state - calculated from other state
  const finalQuestions = quizQuestions;
  const currentQuestion = finalQuestions[currentQuestionIndex];
  const progress = finalQuestions.length > 0 ? ((currentQuestionIndex + 1) / finalQuestions.length) * 100 : 0;

  // تسجيل وقت بداية الإجابة عند عرض سؤال جديد
  useEffect(() => {
    if (currentQuestion && !isAnswered) {
      setAnswerStartTime(Date.now());
    }
  }, [currentQuestionIndex, currentQuestion, isAnswered]);

  // Safety check for translations
  if (!t || !t.quiz) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <Text style={{ color: '#fff' }}>Loading...</Text>
      </View>
    );
  }

  // Show loading while checking auth
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <Text style={{ color: '#fff' }}>Loading...</Text>
      </View>
    );
  }

  // Don't render quiz if not signed in (will redirect)
  if (!isSignedIn) {
    return null;
  }

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
  const blurAnim = useRef(new Animated.Value(20)).current; // animation للصورة المشوشة
  const questionTextAnim = useRef(new Animated.Value(0)).current; // animation للسؤال في flash mode

  // استخدام useRef لتخزين getToken وتجنب re-renders
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  // جلب الكويز اليومي (الأساطير) من الباك إند مع Cache احترافي
  useEffect(() => {
    let isMounted = true; // لتجنب state updates بعد unmount
    
    const loadDailyQuiz = async () => {
      if (!selectedMode || selectedMode !== 'legends') {
        if (isMounted) {
          setLoadingQuestions(false);
          setQuizQuestions([]);
        }
        return;
      }

      try {
        if (isMounted) {
          setLoadingQuestions(true);
        }
        
        const currentGetToken = getTokenRef.current;
        
        if (currentGetToken) {
          try {
            const loadStartTime = Date.now();
            
            // استيراد Daily Quiz API
            const { getDailyQuiz } = await import('../../services/quizApi');
            
            // جلب الكويز اليومي (أسئلة + إجابات + صور)
            const dailyQuizResult = await getDailyQuiz(currentGetToken);
            
            const loadTime = Date.now() - loadStartTime;
            
            if (isMounted) {
              setQuizQuestions(dailyQuizResult.questions);
              setQuizAnswers(dailyQuizResult.answers);
              
              // تسجيل وقت التحميل في مراقب الأداء
              recordQuizLoadTime(loadTime, dailyQuizResult.fromCache);
              
              console.log(`✅ Daily Quiz loaded successfully`, {
                questionCount: dailyQuizResult.questions.length,
                answersCount: Object.keys(dailyQuizResult.answers).length,
                fromCache: dailyQuizResult.fromCache,
                loadTime: `${loadTime}ms`,
                expiresAt: dailyQuizResult.expiresAt.toISOString(),
              });
              
              // إذا لم تكن من Cache، عرض رسالة نجاح
              if (!dailyQuizResult.fromCache) {
                console.log('🎉 Fresh daily quiz loaded and cached for 24 hours!');
              }
            }
          } catch (error: any) {
            console.error('Error loading daily quiz:', error);
            recordQuizError('api', error.message);
            
            // Fallback: استخدام الأسئلة المحلية إذا فشل جلب من الباك إند
            if (isMounted) {
              console.log('Falling back to local questions...');
              const categoryQuestions = getQuestionsByCategoryIdWithDifficulty(selectedMode);
              
              if (categoryQuestions.length > 0) {
                setQuizQuestions(categoryQuestions);
                
                // تحميل الصور في الخلفية
                const imageUrls = extractImageUrlsFromQuestions(categoryQuestions);
                if (imageUrls.length > 0) {
                  prefetchQuizImages(imageUrls).catch((error) => {
                    console.warn('Failed to prefetch quiz images:', error);
                    recordQuizError('image', error.message);
                  });
                }
                
                // جلب الإجابات من الباك إند
                const questionIds = categoryQuestions.map(q => q.id);
                try {
                  const answers = await getQuizAnswers(questionIds, currentGetToken);
                  if (isMounted) {
                    setQuizAnswers(answers);
                  }
                } catch (answerError: any) {
                  console.error('Error loading answers for local questions:', answerError);
                  recordQuizError('api', answerError.message);
                  if (isMounted) {
                    setQuizAnswers({});
                  }
                }
              } else {
                setQuizQuestions([]);
              }
            }
          }
        }
      } catch (error: any) {
        console.error('Error loading daily quiz:', error);
        recordQuizError('network', error.message);
        if (isMounted) {
          setQuizQuestions([]);
        }
      } finally {
        if (isMounted) {
          setLoadingQuestions(false);
        }
      }
    };

    loadDailyQuiz();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [selectedMode]); // إزالة userId و getToken من dependencies

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
    setImageLoading(false); // إعادة تعيين حالة التحميل
    setImageError(false); // إعادة تعيين حالة الخطأ
    
    // تحديد طريقة عرض الصورة حسب displayMode
    const displayMode: DisplayMode = currentQuestion?.displayMode || 'never';
    
    switch (displayMode) {
      case 'after-answer':
        // الصورة تظهر بعد الإجابة فقط
        setShowImage(false);
        imageFadeAnim.setValue(0);
        setShowQuestionText(true);
        questionTextAnim.setValue(1);
        break;
        
      case 'before-question':
        // الصورة تظهر أولاً، السؤال يظهر بعد ثانية
        if (currentQuestion?.imageUrl) {
          setShowImage(true);
          imageFadeAnim.setValue(1);
          imageScaleAnim.setValue(1);
          setShowQuestionText(false);
          questionTextAnim.setValue(0);
          // السؤال يظهر بعد ثانية واحدة
          setTimeout(() => {
            setShowQuestionText(true);
            Animated.timing(questionTextAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }).start();
          }, 1000);
        }
        break;
        
      case 'in-question':
        // الصورة في السؤال بدون hint
        if (currentQuestion?.imageUrl) {
          setShowImage(true);
          imageFadeAnim.setValue(1);
          imageScaleAnim.setValue(1);
        } else {
          setShowImage(false);
        }
        setShowQuestionText(true);
        questionTextAnim.setValue(1);
        break;
        
      case 'after-wrong':
        // الصورة تظهر فقط بعد الإجابة الخاطئة
        setShowImage(false);
        imageFadeAnim.setValue(0);
        setShowQuestionText(true);
        questionTextAnim.setValue(1);
        break;
        
      case 'blur-reveal':
        // الصورة تظهر مشوشة في البداية
        if (currentQuestion?.imageUrl) {
          setShowImage(true);
          imageFadeAnim.setValue(1);
          imageScaleAnim.setValue(1);
          setBlurIntensity(20);
          blurAnim.setValue(20);
        } else {
          setShowImage(false);
        }
        setShowQuestionText(true);
        questionTextAnim.setValue(1);
        break;
        
      case 'never':
      default:
        // لا صورة قبل الإجابة
        setShowImage(false);
        imageFadeAnim.setValue(0);
        setShowQuestionText(true);
        questionTextAnim.setValue(1);
        break;
    }
  }, [currentQuestionIndex, currentQuestion]);

  const animateQuestionEntry = () => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.85);
    imageScaleAnim.setValue(0.9);
    optionAnims.forEach(anim => anim.setValue(0));

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    optionAnims.forEach((anim, index) => {
      Animated.sequence([
        Animated.delay(index * 80 + 200),
        Animated.spring(anim, {
          toValue: 1,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const animateImageReveal = () => {
    setShowImage(true);
    // تهيئة القيم قبل البدء بالأنيميشن
    imageScaleAnim.setValue(0.9);
    imageFadeAnim.setValue(0);
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
    if (isAnswered || eliminatedOptions.includes(answerIndex) || !currentQuestion) return;

    // حساب وقت الإجابة
    const answerTime = Date.now() - answerStartTime;

    // Haptic feedback محسن
    if (soundEnabled && Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Animation للزر المضغوط
    if (optionAnims[answerIndex]) {
      Animated.sequence([
        Animated.timing(optionAnims[answerIndex], {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(optionAnims[answerIndex], {
          toValue: 1,
          friction: 3,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }

    setSelectedAnswer(answerIndex);
    setIsAnswered(true);
    setTotalQuestions(prev => prev + 1);

    // جلب الإجابة الصحيحة من quizAnswers
    const correctAnswer = quizAnswers[currentQuestion.id] || '0';
    const correctAnswerIndex = parseInt(correctAnswer, 10);
    const isCorrect = answerIndex === correctAnswerIndex;

    // تسجيل الإجابة في مراقب الأداء
    recordQuizAnswer(isCorrect, answerTime);

    // تحديد طريقة عرض الصورة حسب displayMode بعد الإجابة
    const displayMode: DisplayMode = currentQuestion.displayMode || 'never';
    
    switch (displayMode) {
      case 'after-answer':
        // الصورة تظهر بعد الإجابة (صحيحة أو خاطئة)
        if (currentQuestion.imageUrl) {
          animateImageReveal();
        }
        break;
        
      case 'after-wrong':
        // الصورة تظهر فقط بعد الإجابة الخاطئة
        if (!isCorrect && currentQuestion.imageUrl) {
          animateImageReveal();
        }
        break;
        
      case 'blur-reveal':
        // الصورة تتضح عند الإجابة (سواء صح أو خطأ)
        if (currentQuestion.imageUrl) {
          Animated.timing(blurAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }).start(() => {
            setBlurIntensity(0);
          });
        }
        break;
        
      case 'before-question':
        // الصورة موجودة بالفعل، لا حاجة لتغيير
        break;
        
      case 'in-question':
        // إزالة التعتيم عن الصورة عند الإجابة
        if (currentQuestion.imageUrl) {
          Animated.timing(blurAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }).start(() => {
            setBlurIntensity(0);
          });
        }
        break;
        
      default:
        // إظهار الصورة بعد الإجابة (إذا كانت موجودة ولم تكن ظاهرة)
        if (currentQuestion.imageUrl && !showImage) {
          animateImageReveal();
        }
        break;
    }

    if (isCorrect) {
      // كل إجابة صحيحة = 5 نقاط ثابتة
      const pointsPerCorrectAnswer = 5;

      setScore(prev => prev + pointsPerCorrectAnswer);
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

      // إضافة 5 كوينات للإجابة الصحيحة
      await addCoins(5);
      setCoinsEarned(prev => prev + 5);

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
      if (currentQuestionIndex < finalQuestions.length - 1 && lives > 0) {
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



  const handleHint = async () => {
    if (coins >= HINT_COST && !hintUsed && currentQuestion) {
      const success = await subtractCoins(HINT_COST);
      if (success) {
        setHintUsed(true);

        const correctAnswer = quizAnswers[currentQuestion.id] || '0';
        const correctAnswerIndex = parseInt(correctAnswer, 10);
        const wrongOptions = currentQuestion.options
          .map((_, index) => index)
          .filter(index => index !== correctAnswerIndex);

        const optionsToEliminate = wrongOptions
          .sort(() => Math.random() - 0.5)
          .slice(0, 2);

        setEliminatedOptions(optionsToEliminate);

        if (soundEnabled && Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
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
    setLives(5);
    setCoinsEarned(0);
    setStreak(0);
    setBestStreak(0);
    setShowImage(false);
  };

  const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  // حفظ النتائج في quizLocalState عند الانتهاء
  useEffect(() => {
    if (showResult && totalQuestions > 0) {
      // حساب الوقت المستغرق (تقريبي - يمكن تحسينه لاحقاً)
      const timeTaken = totalQuestions * 15; // افتراض 15 ثانية لكل سؤال
      
      markQuizCompleted({
        score,
        correctAnswers,
        totalQuestions,
        timeTaken,
      }).catch((error) => {
        console.error('Error saving quiz results:', error);
      });
    }
  }, [showResult, score, correctAnswers, totalQuestions]);

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
              <Text style={styles.resultTitle}>{t.quiz.congratulations}</Text>
              <Text style={styles.resultSubtitle}>{t.quiz.quizCompleted}</Text>
            </Animated.View>

            <View style={styles.resultScoreCard}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.05)']}
                style={styles.scoreGradient}
              >
                <Text style={styles.resultScore}>{score}</Text>
                <Text style={styles.resultLabel}>{t.quiz.points}</Text>
              </LinearGradient>
            </View>

            <View style={styles.resultStatsGrid}>
              <View style={styles.resultStatCard}>
                <View style={styles.statIconWrapper}>
                  <Target size={24} color="#10b981" />
                </View>
                <Text style={styles.resultStatValue}>{accuracy}%</Text>
                <Text style={styles.resultStatLabel}>{t.quiz.accuracy}</Text>
              </View>

              <View style={styles.resultStatCard}>
                <View style={styles.statIconWrapper}>
                  <Award size={24} color="#fbbf24" />
                </View>
                <Text style={styles.resultStatValue}>{correctAnswers}</Text>
                <Text style={styles.resultStatLabel}>{t.quiz.correct}</Text>
              </View>

              <View style={styles.resultStatCard}>
                <View style={styles.statIconWrapper}>
                  <Zap size={24} color="#f97316" />
                </View>
                <Text style={styles.resultStatValue}>{bestStreak}</Text>
                <Text style={styles.resultStatLabel}>{t.quiz.bestStreak}</Text>
              </View>
            </View>

            <View style={styles.resultCoinsCard}>
              <LinearGradient
                colors={['rgba(251, 191, 36, 0.15)', 'rgba(251, 191, 36, 0.05)']}
                style={styles.coinsGradientCard}
              >
                <Text style={styles.resultCoinsText}>💰 +{coinsEarned} {t.quiz.goldCoins}</Text>
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const handleCategorySelect = (mode: string) => {
    setSelectedMode(mode);
    handleRestart();
  };

  const handleBackToCategories = () => {
    setSelectedMode(null);
    handleRestart();
  };

  // Safety check: Don't render quiz if no questions or currentQuestion is undefined
  if (selectedMode && (loadingQuestions || !currentQuestion || finalQuestions.length === 0)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={['#0a0a0a', '#1a1a1a']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={handleBackToCategories} style={{ marginRight: 12 }}>
                <RotateCcw size={24} color="#fff" />
              </TouchableOpacity>
              <CoinsBadge />
            </View>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 16 }}>
            {loadingQuestions ? 'Loading questions...' : 'No questions available'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedMode) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={['#0a0a0a', '#1a1a1a']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <CoinsBadge />
            </View>
          </View>
        </View>
        <DailyQuizCategories onSelectCategory={handleCategorySelect} />
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
            <TouchableOpacity onPress={handleBackToCategories} style={{ marginRight: 12 }}>
              <RotateCcw size={24} color="#fff" />
            </TouchableOpacity>
            {/* Unified Coins Badge */}
            <CoinsBadge />

            <View style={styles.livesBadge}>
              {[...Array(5)].map((_, i) => (
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
            {/* Hint Button في مكان الكأس */}
            <TouchableOpacity
              style={[
                styles.headerHintButton,
                !hintUsed && coins >= HINT_COST && styles.headerHintButtonActive,
                (hintUsed || coins < HINT_COST) && styles.headerHintButtonDisabled
              ]}
              onPress={handleHint}
              disabled={hintUsed || coins < HINT_COST}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={
                  hintUsed || coins < HINT_COST
                    ? ['rgba(42, 42, 42, 0.6)', 'rgba(26, 26, 26, 0.6)']
                    : ['#fbbf24', '#f59e0b']
                }
                style={styles.headerHintGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Lightbulb size={18} color="#fff" strokeWidth={2.5} />
                {!hintUsed && (
                  <Text style={styles.headerHintCost}>{HINT_COST}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
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
                {
                  translateY: streakAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0],
                  })
                },
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

          {/* محتوى السؤال */}
          <View style={styles.textOnlyQuestionContainer}>
            {/* Question Number Badge و Result Badge في الأعلى */}
            <View style={styles.topBadgesContainer}>
              {/* Question Number Badge - في اليسار */}
              <View style={styles.questionNumberBadgeTop}>
                <LinearGradient
                  colors={['rgba(16, 185, 129, 0.2)', 'rgba(16, 185, 129, 0.1)']}
                  style={styles.questionNumberGradient}
                >
                  <Text style={styles.questionNumberTextTop}>
                    {currentQuestionIndex + 1} / {finalQuestions.length}
                  </Text>
                </LinearGradient>
              </View>

              {/* Result Badge - في اليمين (مقابل عدد الأسئلة) */}
              {isAnswered && (
                <Animated.View
                  style={[
                    styles.resultBadge,
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
                  <LinearGradient
                    colors={
                      selectedAnswer === parseInt(quizAnswers[currentQuestion?.id || ''] || '0', 10)
                        ? ['rgba(16, 185, 129, 0.9)', 'rgba(5, 150, 105, 0.9)']
                        : ['rgba(239, 68, 68, 0.9)', 'rgba(220, 38, 38, 0.9)']
                    }
                    style={styles.resultBadgeGradient}
                  >
                    <Text style={styles.resultBadgeEmoji}>
                      {selectedAnswer === parseInt(quizAnswers[currentQuestion?.id || ''] || '0', 10) ? '✓' : '✗'}
                    </Text>
                    <Text style={styles.resultBadgeText}>
                      {selectedAnswer === parseInt(quizAnswers[currentQuestion?.id || ''] || '0', 10) ? t.quiz.excellent : '😔'}
                    </Text>
                  </LinearGradient>
                </Animated.View>
              )}
            </View>

            {/* Question Text و/أو Image */}
            <View style={styles.questionContentWrapper}>
              {/* عرض الصورة حسب displayMode - في الأعلى */}
              {currentQuestion?.imageUrl && showImage && (
                <Animated.View
                  style={[
                    styles.questionImageContainer,
                    {
                      opacity: imageFadeAnim,
                      transform: [{ scale: imageScaleAnim }],
                    },
                  ]}
                >
                  {(currentQuestion.displayMode === 'blur-reveal' || 
                    (currentQuestion.displayMode === 'in-question' && !isAnswered)) ? (
                    // الصورة المشوشة
                    <View style={styles.blurImageWrapper}>
                      <Image
                        source={{ uri: currentQuestion.imageUrl }}
                        style={[
                          styles.questionImage,
                          currentQuestion.imageType === 'club' && styles.clubImage,
                        ]}
                        contentFit={currentQuestion.imageType === 'club' ? 'contain' : 'cover'}
                        transition={300}
                        onLoadStart={() => setImageLoading(true)}
                        onLoadEnd={() => setImageLoading(false)}
                        onError={(error) => {
                          console.error('[Quiz] Image load error:', error);
                          setImageError(true);
                          setImageLoading(false);
                        }}
                      />
                      {!isAnswered && !imageError && (
                        <Animated.View
                          style={[
                            styles.blurOverlay,
                            {
                              opacity: currentQuestion.displayMode === 'blur-reveal' 
                                ? blurAnim.interpolate({
                                    inputRange: [0, 20],
                                    outputRange: [0, 1],
                                  })
                                : 1,
                            },
                          ]}
                        >
                          <BlurView
                            intensity={currentQuestion.displayMode === 'blur-reveal' ? blurIntensity : 20}
                            style={StyleSheet.absoluteFillObject}
                            tint="dark"
                          />
                        </Animated.View>
                      )}
                      {imageLoading && (
                        <View style={styles.imageLoadingOverlay}>
                          <Text style={styles.imageLoadingText}>⏳</Text>
                        </View>
                      )}
                      {imageError && (
                        <View style={styles.imageErrorOverlay}>
                          <Text style={styles.imageErrorText}>🖼️</Text>
                          <Text style={styles.imageErrorSubtext}>Image unavailable</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    // الصورة العادية
                    <View style={styles.blurImageWrapper}>
                      <Image
                        source={{ uri: currentQuestion.imageUrl }}
                        style={[
                          styles.questionImage,
                          currentQuestion.imageType === 'club' && styles.clubImage,
                        ]}
                        contentFit={currentQuestion.imageType === 'club' ? 'contain' : 'cover'}
                        transition={300}
                        onLoadStart={() => setImageLoading(true)}
                        onLoadEnd={() => setImageLoading(false)}
                        onError={(error) => {
                          console.error('[Quiz] Image load error:', error);
                          setImageError(true);
                          setImageLoading(false);
                        }}
                      />
                      {imageLoading && (
                        <View style={styles.imageLoadingOverlay}>
                          <Text style={styles.imageLoadingText}>⏳</Text>
                        </View>
                      )}
                      {imageError && (
                        <View style={styles.imageErrorOverlay}>
                          <Text style={styles.imageErrorText}>🖼️</Text>
                          <Text style={styles.imageErrorSubtext}>Image unavailable</Text>
                        </View>
                      )}
                    </View>
                  )}
                  
                  {/* Overlay للصورة - يظهر فقط في in-question mode */}
                  {!isAnswered && 
                   !imageError &&
                   currentQuestion.displayMode === 'in-question' && 
                   currentQuestion?.imageUrl && (
                    <View style={styles.imageOverlay}>
                      <Text style={styles.imageQuizLabel}>Image Quiz</Text>
                    </View>
                  )}
                </Animated.View>
              )}

              {/* نص السؤال - يظهر تحت الصورة */}
              {currentQuestion?.question && showQuestionText && (
                <Animated.View
                  style={[
                    styles.questionTextWrapper,
                    currentQuestion?.imageUrl && showImage && styles.questionTextWithImage,
                    !currentQuestion?.imageUrl && { marginTop: 0 },
                    {
                      opacity: questionTextAnim,
                      transform: [
                        {
                          translateY: questionTextAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-20, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.questionTextOnly}>{currentQuestion.question}</Text>
                </Animated.View>
              )}
            </View>
          </View>

        </Animated.View>

        {/* Options Grid محسن */}
        <View style={styles.optionsGrid}>
          {currentQuestion?.options?.map((option, index) => {
            const correctAnswer = quizAnswers[currentQuestion?.id || ''] || '0';
            const correctAnswerIndex = parseInt(correctAnswer, 10);
            const isCorrect = index === correctAnswerIndex;
            const isSelected = index === selectedAnswer;
            // إظهار الإجابة الصحيحة باللون الأخضر دائماً بعد الإجابة
            const shouldShowCorrect = isAnswered && isCorrect;
            const shouldShowWrong = isAnswered && isSelected && !isCorrect;
            const isEliminated = eliminatedOptions.includes(index);
            
            // Debug logging
            if (isAnswered && index === 0 && currentQuestion?.id) {
              console.log(`[Quiz] Question ${currentQuestion.id}:`, {
                correctAnswer,
                correctAnswerIndex,
                isAnswered,
                isCorrect: index === correctAnswerIndex,
                shouldShowCorrect,
                quizAnswersCount: Object.keys(quizAnswers).length
              });
            }

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
  // Header Hint Button (في مكان الكأس)
  headerHintButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  headerHintButtonActive: {
    shadowOpacity: 0.5,
  },
  headerHintButtonDisabled: {
    opacity: 0.5,
  },
  headerHintGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  headerHintCost: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
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
    paddingBottom: 20,
  },
  questionCard: {
    marginTop: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Quiz Type Image Container (نوع الاختبار - صور)
  quizTypeImageContainer: {
    width: '100%',
    height: 200,
    overflow: 'hidden',
  },
  quizTypeImageBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  quizTypeImage: {
    borderRadius: 0,
  },
  quizTypeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 16,
  },
  quizTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  quizTypeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textOnlyQuestionContainer: {
    padding: 24,
    alignItems: 'center',
    minHeight: 180,
    justifyContent: 'flex-start',
  },
  // Top Badges Container
  topBadgesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  // Question Number Badge - في اليسار
  questionNumberBadgeTop: {
    alignSelf: 'flex-start',
  },
  questionNumberGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  questionNumberTextTop: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Result Badge - في اليمين (مقابل عدد الأسئلة)
  resultBadge: {
    alignSelf: 'flex-end',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  resultBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  resultBadgeEmoji: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  questionContentWrapper: {
    width: '100%',
    marginTop: 8,
    alignItems: 'center',
  },
  // Question Image Container
  questionImageContainer: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
    height: height * 0.25, // ربع الشاشة تقريباً
  },
  questionImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageQuizLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  questionTextWrapper: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 16,
  },
  questionTextWithImage: {
    marginTop: 16,
  },
  questionTextOnly: {
    fontSize: Platform.OS === 'ios' ? 22 : 20,
    color: '#fff',
    textAlign: 'center',
    lineHeight: Platform.OS === 'ios' ? 34 : 32,
    fontWeight: '600',
    letterSpacing: 0.3,
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
  clubImage: {
    height: '100%',
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
  blurImageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLoadingText: {
    fontSize: 48,
    color: '#fff',
  },
  imageErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  imageErrorText: {
    fontSize: 48,
    marginBottom: 8,
  },
  imageErrorSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
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
    paddingVertical: Platform.OS === 'ios' ? 18 : 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Platform.OS === 'ios' ? 64 : 60,
    borderRadius: 18,
  },
  optionText: {
    color: '#fff',
    fontSize: Platform.OS === 'ios' ? 16 : 15,
    textAlign: 'center',
    fontWeight: '600',
    flex: 1,
    letterSpacing: 0.2,
    lineHeight: Platform.OS === 'ios' ? 24 : 22,
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
});