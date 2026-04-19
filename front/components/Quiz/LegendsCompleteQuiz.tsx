/**
 * Legends Complete Quiz Component
 * مكون الكويز الكامل للأساطير
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useLegendsCompleteQuiz, CompleteQuizQuestion } from '../../services/legendsCompleteQuiz';

interface LegendsCompleteQuizProps {
  onQuizComplete?: (score: number, totalQuestions: number) => void;
  questionCount?: number;
}

interface QuizState {
  questions: CompleteQuizQuestion[];
  currentQuestionIndex: number;
  userAnswers: Record<string, string>;
  showResult: boolean;
  score: number;
  isLoading: boolean;
  error: string | null;
}

export const LegendsCompleteQuiz: React.FC<LegendsCompleteQuizProps> = ({
  onQuizComplete,
  questionCount = 20,
}) => {
  const { getQuestions, getAnswers } = useLegendsCompleteQuiz();
  
  const [quizState, setQuizState] = useState<QuizState>({
    questions: [],
    currentQuestionIndex: 0,
    userAnswers: {},
    showResult: false,
    score: 0,
    isLoading: true,
    error: null,
  });

  // تحميل الأسئلة عند بدء المكون
  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      setQuizState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const questions = await getQuestions(questionCount);
      
      setQuizState(prev => ({
        ...prev,
        questions,
        isLoading: false,
      }));
    } catch (error: any) {
      console.error('[LegendsCompleteQuiz] Error loading questions:', error);
      setQuizState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'فشل في تحميل الأسئلة',
      }));
    }
  };

  const handleAnswerSelect = (answerIndex: string) => {
    const currentQuestion = quizState.questions[quizState.currentQuestionIndex];
    
    setQuizState(prev => ({
      ...prev,
      userAnswers: {
        ...prev.userAnswers,
        [currentQuestion.id]: answerIndex,
      },
    }));
  };

  const handleNextQuestion = () => {
    const nextIndex = quizState.currentQuestionIndex + 1;
    
    if (nextIndex >= quizState.questions.length) {
      // انتهى الكويز - احسب النتيجة
      calculateScore();
    } else {
      setQuizState(prev => ({
        ...prev,
        currentQuestionIndex: nextIndex,
      }));
    }
  };

  const calculateScore = async () => {
    try {
      setQuizState(prev => ({ ...prev, isLoading: true }));
      
      const questionIds = quizState.questions.map(q => q.id);
      const correctAnswers = await getAnswers(questionIds);
      
      let score = 0;
      quizState.questions.forEach(question => {
        const userAnswer = quizState.userAnswers[question.id];
        const correctAnswer = correctAnswers[question.id];
        
        if (userAnswer === correctAnswer) {
          score += question.points;
        }
      });
      
      setQuizState(prev => ({
        ...prev,
        score,
        showResult: true,
        isLoading: false,
      }));
      
      // استدعاء callback إذا كان موجود
      if (onQuizComplete) {
        onQuizComplete(score, quizState.questions.length);
      }
    } catch (error: any) {
      console.error('[LegendsCompleteQuiz] Error calculating score:', error);
      Alert.alert('خطأ', 'فشل في حساب النتيجة');
      setQuizState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const resetQuiz = () => {
    setQuizState({
      questions: [],
      currentQuestionIndex: 0,
      userAnswers: {},
      showResult: false,
      score: 0,
      isLoading: true,
      error: null,
    });
    loadQuestions();
  };

  // عرض حالة التحميل
  if (quizState.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 10, fontSize: 16, color: '#666' }}>
          جاري تحميل الأسئلة...
        </Text>
      </View>
    );
  }

  // عرض حالة الخطأ
  if (quizState.error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, color: '#FF3B30', textAlign: 'center', marginBottom: 20 }}>
          {quizState.error}
        </Text>
        <TouchableOpacity
          onPress={loadQuestions}
          style={{
            backgroundColor: '#007AFF',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: 'white', fontSize: 16 }}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // عرض النتيجة النهائية
  if (quizState.showResult) {
    const totalPossibleScore = quizState.questions.reduce((sum, q) => sum + q.points, 0);
    const percentage = Math.round((quizState.score / totalPossibleScore) * 100);
    
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 10 }}>
          انتهى الكويز! 🎉
        </Text>
        <Text style={{ fontSize: 20, marginBottom: 5 }}>
          النتيجة: {quizState.score} من {totalPossibleScore}
        </Text>
        <Text style={{ fontSize: 18, marginBottom: 20, color: '#666' }}>
          النسبة: {percentage}%
        </Text>
        <TouchableOpacity
          onPress={resetQuiz}
          style={{
            backgroundColor: '#007AFF',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: 'white', fontSize: 16 }}>كويز جديد</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // عرض السؤال الحالي
  const currentQuestion = quizState.questions[quizState.currentQuestionIndex];
  const currentAnswer = quizState.userAnswers[currentQuestion?.id];
  
  if (!currentQuestion) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>لا توجد أسئلة متاحة</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20 }}>
      {/* شريط التقدم */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 16, marginBottom: 5 }}>
          السؤال {quizState.currentQuestionIndex + 1} من {quizState.questions.length}
        </Text>
        <View style={{ height: 4, backgroundColor: '#E5E5E5', borderRadius: 2 }}>
          <View
            style={{
              height: 4,
              backgroundColor: '#007AFF',
              borderRadius: 2,
              width: `${((quizState.currentQuestionIndex + 1) / quizState.questions.length) * 100}%`,
            }}
          />
        </View>
      </View>

      {/* الصورة (إذا كانت موجودة وتظهر قبل السؤال) */}
      {currentQuestion.imageUrl && currentQuestion.displayMode === 'BEFORE_QUESTION' && (
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Image
            source={{ uri: currentQuestion.imageUrl }}
            style={{ width: 150, height: 150, borderRadius: 8 }}
            resizeMode="cover"
          />
        </View>
      )}

      {/* السؤال */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
          {currentQuestion.question}
        </Text>
        {currentQuestion.hint && (
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginTop: 5 }}>
            💡 {currentQuestion.hint}
          </Text>
        )}
      </View>

      {/* الصورة (إذا كانت تظهر مع السؤال) */}
      {currentQuestion.imageUrl && currentQuestion.displayMode === 'IN_QUESTION' && (
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Image
            source={{ uri: currentQuestion.imageUrl }}
            style={{ width: 150, height: 150, borderRadius: 8 }}
            resizeMode="cover"
          />
        </View>
      )}

      {/* الخيارات */}
      <View style={{ flex: 1 }}>
        {currentQuestion.options.map((option, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleAnswerSelect(index.toString())}
            style={{
              backgroundColor: currentAnswer === index.toString() ? '#007AFF' : '#F2F2F2',
              padding: 15,
              marginBottom: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: currentAnswer === index.toString() ? '#007AFF' : '#E5E5E5',
            }}
          >
            <Text
              style={{
                fontSize: 16,
                color: currentAnswer === index.toString() ? 'white' : '#333',
                textAlign: 'center',
              }}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* زر التالي */}
      {currentAnswer && (
        <TouchableOpacity
          onPress={handleNextQuestion}
          style={{
            backgroundColor: '#34C759',
            padding: 15,
            borderRadius: 8,
            marginTop: 20,
          }}
        >
          <Text style={{ color: 'white', fontSize: 16, textAlign: 'center', fontWeight: 'bold' }}>
            {quizState.currentQuestionIndex + 1 >= quizState.questions.length ? 'إنهاء الكويز' : 'السؤال التالي'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default LegendsCompleteQuiz;