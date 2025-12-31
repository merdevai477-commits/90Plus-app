/**
 * Quiz Sync Service
 * إرسال نتائج الكويز للباك إند في الخلفية
 * - فحص النتائج المعلقة
 * - إرسالها للباك إند عند الاتصال
 * - معالجة الأخطاء وإعادة المحاولة
 */

import { getPendingSubmissions, markSubmissionSent, QuizLocalState } from './quizLocalState';
import { submitQuizResults } from './quizApi';
import { GetTokenFunction } from './quizApi';

const SYNC_INTERVAL = 30 * 1000; // 30 ثانية
let syncIntervalId: NodeJS.Timeout | null = null;

/**
 * بدء خدمة المزامنة
 */
export function startQuizSync(getToken: GetTokenFunction, userId: string | null = null): void {
  // إيقاف المزامنة السابقة إن وجدت
  stopQuizSync();

  // مزامنة فورية
  syncPendingSubmissions(getToken, userId);

  // مزامنة دورية
  syncIntervalId = setInterval(() => {
    syncPendingSubmissions(getToken, userId);
  }, SYNC_INTERVAL);

  console.log(`[QuizSyncService] Started quiz sync service for user ${userId || 'guest'}`);
}

/**
 * إيقاف خدمة المزامنة
 */
export function stopQuizSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[QuizSyncService] Stopped quiz sync service');
  }
}

/**
 * مزامنة النتائج المعلقة
 */
async function syncPendingSubmissions(getToken: GetTokenFunction, userId: string | null = null): Promise<void> {
  try {
    const pendingSubmissions = await getPendingSubmissions(userId);

    if (pendingSubmissions.length === 0) {
      return; // لا توجد نتائج معلقة
    }

    console.log(`[QuizSyncService] Found ${pendingSubmissions.length} pending submission(s) for user ${userId || 'guest'}`);

    for (const submission of pendingSubmissions) {
      if (!submission.results || !submission.currentCategoryId) {
        console.warn('[QuizSyncService] Invalid submission, skipping');
        continue;
      }

      try {
        // إرسال النتائج للباك إند
        await submitQuizResults(
          submission.currentCategoryId,
          {
            questionIds: submission.currentQuestionIds,
            answers: {}, // سيتم حساب الإجابات من النتائج
            score: submission.results.score,
            correctAnswers: submission.results.correctAnswers,
            totalQuestions: submission.results.totalQuestions,
            timeTaken: submission.results.timeTaken,
          },
          getToken
        );

        // تحديث حالة الإرسال
        await markSubmissionSent(userId);

        console.log(`[QuizSyncService] Successfully synced quiz results for user ${userId || 'guest'}`);
      } catch (error: any) {
        console.error('[QuizSyncService] Error syncing quiz results:', error);
        // لا نوقف المزامنة، سنحاول مرة أخرى في الدورة القادمة
      }
    }
  } catch (error: any) {
    console.error('[QuizSyncService] Error getting pending submissions:', error);
  }
}

/**
 * مزامنة فورية (للاستدعاء اليدوي)
 */
export async function syncNow(getToken: GetTokenFunction, userId: string | null = null): Promise<void> {
  await syncPendingSubmissions(getToken, userId);
}

