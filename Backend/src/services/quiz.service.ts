/**
 * Quiz Service
 * خدمة الكويزات - إدارة الأسئلة والمحاولات والمكافآت
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { Difficulty } from '@prisma/client';

interface QuizAnswer {
  questionId: string;
  userAnswer: string; // index as string (0, 1, 2, 3)
  timeTaken: number; // seconds
}

interface SubmitQuizData {
  userId: string;
  categoryId: string;
  answers: QuizAnswer[];
  totalTime: number; // total time in seconds
}

interface QuizRewards {
  coins: number;
  xp: number;
}

/**
 * جلب أسئلة عشوائية لفئة معينة
 */
export async function getRandomQuestions(
  categoryId: string,
  count: number = 10
): Promise<any[]> {
  try {
    const questions = await prisma.quizQuestion.findMany({
      where: { categoryId },
      take: 1000, // fetch more to shuffle
    });

    if (questions.length === 0) {
      return [];
    }

    // Shuffle array using Fisher-Yates algorithm
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Return only the requested count
    return shuffled.slice(0, Math.min(count, shuffled.length)).map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      difficulty: q.difficulty,
      points: q.points,
      imageUrl: q.imageUrl,
      imageType: q.imageType,
      hint: q.hint,
      timeLimit: q.timeLimit,
      // Don't send correctAnswer to frontend
    }));
  } catch (error: any) {
    logger.error('Error getting random questions:', error);
    throw error;
  }
}

/**
 * فحص إذا كان المستخدم يمكنه بدء كويز جديد (cooldown check)
 */
export async function checkAttemptCooldown(
  userId: string,
  categoryId: string
): Promise<{ canStart: boolean; canRetryAt?: Date; hoursRemaining?: number }> {
  try {
    const lastAttempt = await prisma.quizAttempt.findFirst({
      where: {
        userId,
        categoryId,
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    if (!lastAttempt) {
      return { canStart: true };
    }

    const now = new Date();
    if (now >= lastAttempt.canRetryAt) {
      return { canStart: true };
    }

    const hoursRemaining = Math.ceil(
      (lastAttempt.canRetryAt.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    return {
      canStart: false,
      canRetryAt: lastAttempt.canRetryAt,
      hoursRemaining,
    };
  } catch (error: any) {
    logger.error('Error checking attempt cooldown:', error);
    throw error;
  }
}

/**
 * حساب المكافآت بناءً على النتيجة والـ streak
 */
export function calculateRewards(
  score: number,
  totalQuestions: number,
  correctAnswers: number,
  bestStreak: number,
  difficulty: Difficulty
): QuizRewards {
  let coins = 0;
  let xp = 0;

  // Base reward per correct answer
  coins += correctAnswers * 5;
  xp += correctAnswers * 10;

  // Streak bonuses
  if (bestStreak >= 5) {
    coins += 5; // +5 bonus for 5+ streak
    xp += 10;
  } else if (bestStreak >= 3) {
    coins += 2; // +2 bonus for 3+ streak
    xp += 5;
  }

  // Completion bonus
  coins += 10;
  xp += 25;

  // Perfect score bonus (100%)
  if (correctAnswers === totalQuestions && totalQuestions > 0) {
    coins += 50;
    xp += 100;
  }

  // Difficulty multiplier
  const difficultyMultiplier = {
    EASY: 1.0,
    MEDIUM: 1.2,
    HARD: 1.5,
  };

  coins = Math.round(coins * difficultyMultiplier[difficulty]);
  xp = Math.round(xp * difficultyMultiplier[difficulty]);

  return { coins, xp };
}

/**
 * حفظ محاولة كويز جديدة
 */
export async function submitQuizAttempt(data: SubmitQuizData): Promise<any> {
  try {
    const { userId, categoryId, answers, totalTime } = data;

    // Get questions to verify answers
    const questionIds = answers.map((a) => a.questionId);
    const questions = await prisma.quizQuestion.findMany({
      where: {
        id: { in: questionIds },
        categoryId,
      },
    });

    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Calculate score and stats
    let correctAnswers = 0;
    let totalScore = 0;
    let currentStreak = 0;
    let bestStreak = 0;

    // Process answers in order to calculate streaks
    const processedAnswers = answers.map((answer) => {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        throw new Error(`Question not found: ${answer.questionId}`);
      }

      const isCorrect = answer.userAnswer === question.correctAnswer;
      if (isCorrect) {
        correctAnswers++;
        totalScore += question.points;
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }

      return {
        questionId: answer.questionId,
        userAnswer: answer.userAnswer,
        isCorrect,
        timeTaken: answer.timeTaken,
      };
    });

    // Get category difficulty (use average or most common)
    const difficulties = questions.map((q) => q.difficulty);
    const avgDifficulty =
      difficulties.filter((d) => d === 'HARD').length > difficulties.length / 2
        ? Difficulty.HARD
        : difficulties.filter((d) => d === 'MEDIUM').length >
            difficulties.length / 2
          ? Difficulty.MEDIUM
          : Difficulty.EASY;

    // Calculate rewards
    const rewards = calculateRewards(
      totalScore,
      answers.length,
      correctAnswers,
      bestStreak,
      avgDifficulty
    );

    // Set canRetryAt to 24 hours from now
    const canRetryAt = new Date();
    canRetryAt.setHours(canRetryAt.getHours() + 24);

    // Create attempt and answers in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create attempt
      const attempt = await tx.quizAttempt.create({
        data: {
          userId,
          categoryId,
          score: totalScore,
          totalQuestions: answers.length,
          correctAnswers,
          coinsEarned: rewards.coins,
          xpEarned: rewards.xp,
          streak: currentStreak,
          bestStreak,
          timeTaken: totalTime,
          canRetryAt,
        },
      });

      // Create user answers
      await tx.userQuizAnswer.createMany({
        data: processedAnswers.map((answer) => ({
          userId,
          questionId: answer.questionId,
          attemptId: attempt.id,
          userAnswer: answer.userAnswer,
          isCorrect: answer.isCorrect,
          timeTaken: answer.timeTaken,
        })),
      });

      // Update user coins and XP
      await tx.user.update({
        where: { id: userId },
        data: {
          coins: { increment: rewards.coins },
          xp: { increment: rewards.xp },
        },
      });

      // Create coin transaction
      await tx.coinTransaction.create({
        data: {
          userId,
          amount: rewards.coins,
          type: 'QUIZ_REWARD',
          description: `Quiz reward: ${rewards.coins} coins`,
        },
      });

      return attempt;
    });

    return {
      attemptId: result.id,
      score: totalScore,
      correctAnswers,
      totalQuestions: answers.length,
      bestStreak,
      rewards,
      canRetryAt,
    };
  } catch (error: any) {
    logger.error('Error submitting quiz attempt:', error);
    throw error;
  }
}

/**
 * جلب إحصائيات المستخدم في الكويزات
 */
export async function getUserQuizStats(userId: string): Promise<any> {
  try {
    const stats = await prisma.quizAttempt.groupBy({
      by: ['categoryId'],
      where: { userId },
      _count: { id: true },
      _sum: {
        score: true,
        coinsEarned: true,
        xpEarned: true,
        correctAnswers: true,
        totalQuestions: true,
      },
      _max: {
        score: true,
        bestStreak: true,
      },
    });

    const totalStats = await prisma.quizAttempt.aggregate({
      where: { userId },
      _count: { id: true },
      _sum: {
        score: true,
        coinsEarned: true,
        xpEarned: true,
        correctAnswers: true,
        totalQuestions: true,
      },
      _max: {
        score: true,
        bestStreak: true,
      },
    });

    return {
      totalAttempts: totalStats._count.id || 0,
      totalScore: totalStats._sum.score || 0,
      totalCoinsEarned: totalStats._sum.coinsEarned || 0,
      totalXpEarned: totalStats._sum.xpEarned || 0,
      totalCorrectAnswers: totalStats._sum.correctAnswers || 0,
      totalQuestions: totalStats._sum.totalQuestions || 0,
      bestScore: totalStats._max.score || 0,
      bestStreak: totalStats._max.bestStreak || 0,
      accuracy:
        (totalStats._sum.correctAnswers || 0) /
          (totalStats._sum.totalQuestions || 1) || 0,
      byCategory: stats.map((stat) => ({
        categoryId: stat.categoryId,
        attempts: stat._count.id,
        totalScore: stat._sum.score || 0,
        bestScore: stat._max.score || 0,
        bestStreak: stat._max.bestStreak || 0,
      })),
    };
  } catch (error: any) {
    logger.error('Error getting user quiz stats:', error);
    throw error;
  }
}

/**
 * جلب تاريخ محاولات المستخدم
 */
export async function getUserQuizHistory(
  userId: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
      orderBy: {
        completedAt: 'desc',
      },
      take: limit,
    });

    return attempts.map((attempt) => ({
      id: attempt.id,
      category: attempt.category,
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      correctAnswers: attempt.correctAnswers,
      coinsEarned: attempt.coinsEarned,
      xpEarned: attempt.xpEarned,
      bestStreak: attempt.bestStreak,
      completedAt: attempt.completedAt,
      canRetryAt: attempt.canRetryAt,
    }));
  } catch (error: any) {
    logger.error('Error getting user quiz history:', error);
    throw error;
  }
}

