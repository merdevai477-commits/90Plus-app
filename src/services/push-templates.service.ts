/**
 * Push notification template service.
 *
 * Source of truth for localized push notification copy on the backend.
 * Mirrors the keys exposed by the frontend at
 * `front/locales/*.ts → pushTemplates.*`. When a user has set a
 * preferred language (`User.settings.language`), the dispatcher reads
 * that value and resolves the title/body through this module.
 *
 * Adding a new template:
 *   1. Add the entry under both `en` and `ar` blocks below.
 *   2. Add the matching key to `front/locales/en.ts` and `ar.ts`
 *      under `pushTemplates` so the in-app inbox stays in sync.
 *   3. Use `renderPushTemplate(key, language, vars)` from the
 *      caller — never pass a hard-coded string from a controller.
 *
 * Variables use `{name}` placeholders for both `{name}` and `{{name}}`
 * to stay tolerant of either syntax inside the locale files.
 *
 * Languages: 'ar' | 'en'. Anything else falls back to 'en'.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export type SupportedLanguage = 'ar' | 'en';

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export type PushTemplateKey =
    | 'matchStartTitle'
    | 'matchStartBody'
    | 'matchSoonTitle'
    | 'matchSoonBody'
    | 'goalTitle'
    | 'goalBody'
    | 'goalScoreBody'
    | 'goalCancelledTitle'
    | 'goalCancelledBody'
    | 'halftimeTitle'
    | 'halftimeBody'
    | 'matchSecondHalfTitle'
    | 'matchSecondHalfBody'
    | 'fulltimeTitle'
    | 'fulltimeBody'
    | 'predictionWinTitle'
    | 'predictionWinBody'
    | 'predictionLossTitle'
    | 'predictionLossBody'
    | 'predictionReminderTitle'
    | 'predictionReminderBody'
    | 'quizReminderTitle'
    | 'quizReminderBody'
    | 'newFollowerTitle'
    | 'newFollowerBody'
    | 'likeTitle'
    | 'likeBody'
    | 'commentTitle'
    | 'commentBody'
    | 'mentionTitle'
    | 'mentionBody'
    | 'rewardTitle'
    | 'rewardBody'
    | 'luckyWheelTitle'
    | 'luckyWheelBody'
    | 'rankUpTitle'
    | 'rankUpBody'
    | 'moderationStrikeTitle'
    | 'moderationStrikeBody'
    | 'moderationRemovedTitle'
    | 'moderationRemovedBody'
    // Renewal / cooldown / video lifecycle (backend-only for now)
    | 'predictionTicketRenewalTitle'
    | 'predictionTicketRenewalBody'
    | 'dailyQuizReadyTitle'
    | 'dailyQuizReadyBody'
    | 'dailyQuizTimeTitle'
    | 'dailyQuizTimeBody'
    | 'dailyQuizChallengeTitle'
    | 'dailyQuizChallengeBody'
    | 'cooldownAvatarTitle'
    | 'cooldownAvatarBody'
    | 'cooldownCoverTitle'
    | 'cooldownCoverBody'
    | 'cooldownReelTitle'
    | 'cooldownReelBody'
    | 'cooldownUsernameTitle'
    | 'cooldownUsernameBody'
    | 'videoReadyTitle'
    | 'videoReadyBody'
    | 'videoFailedTitle'
    | 'videoFailedBody'
    // Upload outcome (in-app notifications dispatched right after a
    // successful or rate-limited upload).
    | 'avatarUpdatedTitle'
    | 'avatarUpdatedBody'
    | 'coverUpdatedTitle'
    | 'coverUpdatedBody'
    | 'avatarChangeBlockedTitle'
    | 'avatarChangeBlockedBody'
    | 'coverChangeBlockedTitle'
    | 'coverChangeBlockedBody'
    | 'mentionInVideoTitle'
    | 'mentionInVideoBody'
    // Reel social interactions (likes / comments / replies / shares /
    // mentions in comments / comment-likes). Used by reels.routes.ts.
    | 'reelLikeTitle'
    | 'reelLikeTitleMany'
    | 'reelLikeBody'
    | 'reelLikeBodyMany'
    | 'reelCommentTitle'
    | 'reelCommentBody'
    | 'reelReplyTitle'
    | 'reelReplyBody'
    | 'reelMentionTitle'
    | 'reelMentionBody'
    | 'reelCommentLikeTitle'
    | 'reelCommentLikeBody'
    | 'reelShareTitle'
    | 'reelShareBody'
    // Ranking achievements (top-3 medal + team-of-month diamond streak)
    | 'medalGoldName'
    | 'medalSilverName'
    | 'medalBronzeName'
    | 'medalAwardedTitle'
    | 'medalAwardedBody'
    | 'diamondAwardedTitle'
    | 'diamondAwardedBody'
    | 'diamondCoinTransactionDescription'
    | 'teamOfMonthMedalTitle'
    | 'teamOfMonthMedalBody'
    // Moderation actions targeted at the user
    | 'moderationReelDeletedTitle'
    | 'moderationReelDeletedBody'
    | 'moderationCommentDeletedTitle'
    | 'moderationCommentDeletedBody'
    | 'accountSuspendedTitle'
    | 'accountSuspendedBody'
    | 'accountSuspendedReason'
    // Leaderboard achievements
    | 'leaderboardTop10Title'
    | 'leaderboardTop10Body'
    // Live match events
    | 'matchYellowCardTitle'
    | 'matchRedCardTitle'
    | 'matchCardBody'
    | 'matchCardPlayerFallback'
    | 'leagueMatchSoonTitle'
    | 'leagueMatchSoonBody'
    | 'leagueMatchStartedTitle'
    | 'leagueMatchStartedBody'
    // Follower milestone
    | 'followerMilestoneTitle'
    | 'followerMilestoneBody'
    // Mux webhook: new video from followed user
    | 'newVideoFromFollowTitle'
    | 'newVideoFromFollowBody'
    // Level up (XP service)
    | 'levelUpTitle'
    | 'levelUpBody'
    // Leaderboard top-3 (elite, sits above top-10)
    | 'leaderboardTop3Title'
    | 'leaderboardTop3Body'
    // Report lifecycle confirmations
    | 'reportSubmittedTitle'
    | 'reportSubmittedBody'
    | 'reportCommentSubmittedTitle'
    | 'reportCommentSubmittedBody'
    | 'reportResolvedTitle'
    | 'reportResolvedBody'
    | 'reelReportWarningTitle'
    | 'reelReportWarningBody'
    // Avatar upload completion
    | 'avatarUploadCompleteTitle'
    | 'avatarUploadCompleteBody'
    | 'avatarUploadFailedTitle'
    | 'avatarUploadFailedBody'
    // Daily quiz / lucky wheel renewal (inbox parity with push-only cron)
    | 'dailyQuizRenewedTitle'
    | 'dailyQuizRenewedBody'
    | 'luckyWheelRenewedTitle'
    | 'luckyWheelRenewedBody'
    // Cooldown ready (already covered by cooldown* family, generic key
    // for the unified notify helper)
    | 'cooldownReadyTitle'
    | 'cooldownReadyBody'
    // AI coach 12-hour check-in
    | 'aiCheckinTitle'
    | 'aiCheckinBody'
    | 'aiCheckinFallbackBody'
    // Extended live match events (subs / VAR / penalty / lineup)
    | 'matchSubstitutionTitle'
    | 'matchSubstitutionBody'
    | 'matchVarTitle'
    | 'matchVarBody'
    | 'matchPenaltyTitle'
    | 'matchPenaltyBody'
    | 'matchLineupTitle'
    | 'matchLineupBody'
    | 'matchFavoriteTitle'
    | 'matchFavoriteBody';

type TemplateMap = Record<PushTemplateKey, string>;

const en: TemplateMap = {
    matchStartTitle: '⚽ Match started',
    matchStartBody: '{home} vs {away} — the match has started',
    matchSoonTitle: '⏰ Match in {minutes} minutes',
    matchSoonBody: '{home} vs {away} kicks off soon',
    goalTitle: '⚽ Goal!',
    goalBody: "{player} scores for {team} ({minute}')",
    goalScoreBody: '{scorer} — {home} {homeScore}-{awayScore} {away}',
    goalCancelledTitle: '🚫 Goal cancelled',
    goalCancelledBody: '{team} — {home} {homeScore}-{awayScore} {away}',
    halftimeTitle: 'Half time',
    halftimeBody: '{home} {homeScore} - {awayScore} {away}',
    matchSecondHalfTitle: 'Second half',
    matchSecondHalfBody: '{home} vs {away} — the second half has started',
    fulltimeTitle: 'Full time',
    fulltimeBody: '{home} {homeScore} - {awayScore} {away}',
    predictionWinTitle: '🎉 Correct prediction!',
    predictionWinBody: 'You earned {coins} coins on {match}',
    predictionLossTitle: '😔 Wrong prediction',
    predictionLossBody: 'Your prediction on {match} did not land',
    predictionReminderTitle: "⏰ Don't miss your prediction",
    predictionReminderBody: '{match} kicks off soon — lock in your call',
    quizReminderTitle: '🎯 Daily quiz is ready',
    quizReminderBody: 'Test your football IQ and earn coins',
    newFollowerTitle: 'New follower',
    newFollowerBody: '{user} started following you',
    likeTitle: 'Someone liked your reel',
    likeBody: '{user} liked your video',
    commentTitle: 'New comment',
    commentBody: '{user} commented on your reel',
    mentionTitle: 'You were mentioned',
    mentionBody: '{user} mentioned you in a comment',
    rewardTitle: '🎁 Reward unlocked',
    rewardBody: 'You earned {amount} coins',
    luckyWheelTitle: '🎡 Lucky wheel ready',
    luckyWheelBody: 'Tap to spin and win free coins',
    rankUpTitle: '📈 Rank up!',
    rankUpBody: 'You climbed to #{rank} on the leaderboard',
    moderationStrikeTitle: '⚠️ Strike on your account',
    moderationStrikeBody: 'A moderator action was applied. Tap for details.',
    moderationRemovedTitle: 'Content removed',
    moderationRemovedBody: 'Your reel was removed for policy violation',
    // Backend-only renewals + cooldowns
    predictionTicketRenewalTitle: '🎟️ Tickets renewed!',
    predictionTicketRenewalBody:
        'You have {count} fresh prediction tickets. Predict match results and earn coins ⚽',
    dailyQuizReadyTitle: '🧠 New quiz is live!',
    dailyQuizReadyBody: "Today's quiz is waiting — show off your football knowledge and earn XP!",
    dailyQuizTimeTitle: '⚽ Quiz time!',
    dailyQuizTimeBody: 'Fresh questions every day — try your luck and check your level!',
    dailyQuizChallengeTitle: "🏆 Today's challenge!",
    dailyQuizChallengeBody: 'A new quiz just dropped. Answer correctly and earn coins and XP!',
    cooldownAvatarTitle: '📸 Update your photo!',
    cooldownAvatarBody: "The cooldown is over — you can change your profile picture now!",
    cooldownCoverTitle: '🖼️ Refresh your cover!',
    cooldownCoverBody: 'You can change your cover image now. Pick a fresh shot!',
    cooldownReelTitle: '🎬 Drop a new reel!',
    cooldownReelBody: 'You can upload a new reel now. Share your skill with the crowd!',
    cooldownUsernameTitle: '✏️ Change your username!',
    cooldownUsernameBody: 'You can update your username now.',
    videoReadyTitle: '✅ Your reel is ready!',
    videoReadyBody: 'Your video has been processed and is live for everyone to watch.',
    videoFailedTitle: '❌ Reel upload failed',
    videoFailedBody: 'Something went wrong while processing your reel. Try again from your profile.',
    avatarUpdatedTitle: '🖼️ Profile picture',
    avatarUpdatedBody: 'Your profile picture has been updated.',
    coverUpdatedTitle: '🎨 Cover image',
    coverUpdatedBody: 'Your cover image has been updated.',
    avatarChangeBlockedTitle: 'Profile picture change',
    avatarChangeBlockedBody: 'You cannot change your profile picture right now.',
    coverChangeBlockedTitle: 'Cover image change',
    coverChangeBlockedBody: 'You cannot change your cover image right now.',
    mentionInVideoTitle: 'You were mentioned',
    mentionInVideoBody: 'Someone mentioned you in a video.',
    // Reel social interactions
    reelLikeTitle: '❤️ Someone liked your reel',
    reelLikeTitleMany: '❤️ {count} likes on your reel',
    reelLikeBody: '{user} liked your reel',
    reelLikeBodyMany: '{user} and {others} others liked your reel',
    reelCommentTitle: 'New comment',
    reelCommentBody: '{user}: {content}',
    reelReplyTitle: 'New reply',
    reelReplyBody: '{user}: {content}',
    reelMentionTitle: 'You were mentioned in a comment',
    reelMentionBody: '{user} mentioned you in a comment',
    reelCommentLikeTitle: '❤️ Someone liked your comment',
    reelCommentLikeBody: '{user} liked your comment',
    reelShareTitle: '🔗 Your reel was shared',
    reelShareBody: '{user} shared your reel on {platform}',
    // Ranking achievements
    medalGoldName: 'Gold 🥇',
    medalSilverName: 'Silver 🥈',
    medalBronzeName: 'Bronze 🥉',
    medalAwardedTitle: 'Congratulations! You earned a medal',
    medalAwardedBody: 'You won a {medal} medal in the {category} ranking',
    diamondAwardedTitle: '💎 Congratulations! You earned the Diamond medal!',
    diamondAwardedBody: "You're a champion! You appeared in the team of the month 3 months in a row. You earned 1000 coins as a gift!",
    diamondCoinTransactionDescription: 'Diamond medal gift — 3 consecutive months in the team of the month',
    teamOfMonthMedalTitle: 'Congratulations! You made the team of the month',
    teamOfMonthMedalBody: 'You won a {medal} medal in the team of the month',
    // Moderation actions targeted at the user
    moderationReelDeletedTitle: 'Notice: your reel was removed',
    moderationReelDeletedBody:
        'Your reel was removed because it received multiple reports ({reason}). Warning: continued violations will permanently ban your account!',
    moderationCommentDeletedTitle: 'Notice: your comment was removed',
    moderationCommentDeletedBody:
        'Your comment was removed because it received multiple reports ({reason}). Please follow community guidelines to avoid a permanent ban.',
    accountSuspendedTitle: 'Your account has been suspended',
    accountSuspendedBody: 'Your account is suspended until {until}. Reason: {reason}',
    accountSuspendedReason: 'Reached {count} strikes',
    // Leaderboard achievement (top-10 predictor)
    leaderboardTop10Title: '🏆 Prediction champion!',
    leaderboardTop10Body: 'Congrats! You made it into the top 10 predictors 🔥',
    // Live match events (cards / kickoff / reminders)
    matchYellowCardTitle: '🟨 Yellow card!',
    matchRedCardTitle: '🟥 Red card!',
    matchCardBody: "{player} ({team}) - {minute}'",
    matchCardPlayerFallback: 'A player',
    leagueMatchSoonTitle: '⏰ Match starting soon!',
    leagueMatchSoonBody: '{home} vs {away} - in {minutes} minutes',
    leagueMatchStartedTitle: '🚀 Kick off!',
    leagueMatchStartedBody: '{home} vs {away}\n{league}\nThe match has started',
    // Follower milestone (every {count} followers)
    followerMilestoneTitle: '🎉 New milestone!',
    followerMilestoneBody: 'You reached {count} followers!',
    // Mux webhook: new video from followed user
    newVideoFromFollowTitle: '🎬 New video!',
    newVideoFromFollowBody: '{user} posted a new video — check it out!',
    // Level up
    levelUpTitle: '🎉 Level up!',
    levelUpBody: 'You reached level {level} — keep going!',
    // Leaderboard top-3
    leaderboardTop3Title: '🥇 Elite predictor!',
    leaderboardTop3Body: 'You broke into the top 3 — only the best stay there 🔥',
    // Report lifecycle
    reportSubmittedTitle: '🚩 Report received',
    reportSubmittedBody: 'Thanks for the report. Our team is reviewing it.',
    reportCommentSubmittedTitle: '🚩 Report received',
    reportCommentSubmittedBody: 'Thanks for reporting the comment. We are looking into it.',
    reportResolvedTitle: '✅ Report resolved',
    reportResolvedBody: 'We reviewed your report and took action where needed.',
    reelReportWarningTitle: 'Your video may be removed',
    reelReportWarningBody:
        'Your reel received 5 reports and is at risk of being deleted. Please review your content.',
    // Avatar upload
    avatarUploadCompleteTitle: '✅ Avatar updated',
    avatarUploadCompleteBody: 'Your new profile picture is live.',
    avatarUploadFailedTitle: '❌ Avatar upload failed',
    avatarUploadFailedBody: 'Something went wrong while uploading your avatar. Try again.',
    // Daily quiz / lucky wheel renewal
    dailyQuizRenewedTitle: '🧠 New daily quiz!',
    dailyQuizRenewedBody: 'Your daily quiz is ready — play now and earn XP.',
    luckyWheelRenewedTitle: '🎡 Wheel of fortune is back!',
    luckyWheelRenewedBody: 'You can spin again — claim today\'s prize.',
    // Generic cooldown
    cooldownReadyTitle: '✨ Ready again',
    cooldownReadyBody: 'You can {resource} now. Tap to continue.',
    // AI coach
    aiCheckinTitle: '🏆 Coach check-in',
    aiCheckinBody: '{name}, did you train today? Let\'s keep going so you can level up.',
    aiCheckinFallbackBody: '{name}, ready for another round? Tap to keep your streak alive.',
    // Extended live match events
    matchSubstitutionTitle: '🔁 Substitution',
    matchSubstitutionBody: "{playerIn} on for {playerOut} ({team}) — {minute}'",
    matchVarTitle: '📺 VAR review',
    matchVarBody: "{team} — {detail} ({minute}')",
    matchPenaltyTitle: '🎯 Penalty!',
    matchPenaltyBody: "{team} awarded a penalty ({minute}')",
    matchLineupTitle: '📋 Lineup announced',
    matchLineupBody: '{home} vs {away} — lineups are out',
    matchFavoriteTitle: '🔔 Match followed',
    matchFavoriteBody: '{home} vs {away} — you will get goals and key events',
};


const ar: TemplateMap = {
    matchStartTitle: '⚽ بدأت المباراة',
    matchStartBody: '{home} ضد {away} — المباراة بدأت الآن',
    matchSoonTitle: '⏰ المباراة بعد {minutes} دقيقة',
    matchSoonBody: '{home} ضد {away} — تذكير قبل البداية',
    goalTitle: '⚽ هدف!',
    goalBody: '{player} يسجل لـ{team} في الدقيقة {minute}',
    goalScoreBody: '{scorer} — {home} {homeScore}-{awayScore} {away}',
    goalCancelledTitle: '🚫 تم إلغاء الهدف',
    goalCancelledBody: '{team} — {home} {homeScore}-{awayScore} {away}',
    halftimeTitle: 'استراحة بين الشوطين',
    halftimeBody: '{home} {homeScore} - {awayScore} {away}',
    matchSecondHalfTitle: 'الشوط الثاني',
    matchSecondHalfBody: '{home} ضد {away} — بدأ الشوط الثاني',
    fulltimeTitle: 'انتهت المباراة',
    fulltimeBody: '{home} {homeScore} - {awayScore} {away}',
    predictionWinTitle: '🎉 توقع صحيح!',
    predictionWinBody: 'كسبت {coins} كوينز في {match}',
    predictionLossTitle: '😔 توقع خاطئ',
    predictionLossBody: 'توقعك في {match} لم يتحقق',
    predictionReminderTitle: '⏰ مباراة قادمة',
    predictionReminderBody: '{match} تبدأ قريبًا — حدّد توقعك',
    quizReminderTitle: '🎯 الكويز اليومي جاهز',
    quizReminderBody: 'اختبر معلوماتك الكروية واكسب عملات',
    newFollowerTitle: 'متابع جديد',
    newFollowerBody: '{user} بدأ متابعتك',
    likeTitle: 'إعجاب جديد',
    likeBody: '{user} أعجب بفيديوك',
    commentTitle: 'تعليق جديد',
    commentBody: '{user} علّق على ريلك',
    mentionTitle: 'تم ذكرك',
    mentionBody: '{user} ذكرك في تعليق',
    rewardTitle: '🎁 جائزة جديدة',
    rewardBody: 'حصلت على {amount} عملة',
    luckyWheelTitle: '🎡 عجلة الحظ جاهزة',
    luckyWheelBody: 'اضغط للف واربح عملات مجانية',
    rankUpTitle: '📈 ارتقيت في الترتيب!',
    rankUpBody: 'وصلت للمركز #{rank} على لوحة الصدارة',
    moderationStrikeTitle: '⚠️ تحذير على حسابك',
    moderationStrikeBody: 'تم تطبيق إجراء إشرافي. اضغط لمعرفة التفاصيل.',
    moderationRemovedTitle: 'تم حذف المحتوى',
    moderationRemovedBody: 'تم حذف ريلك بسبب مخالفة السياسات',
    // قوالب الواجهة الخلفية فقط
    predictionTicketRenewalTitle: '🎟️ تذاكرك اتجددت!',
    predictionTicketRenewalBody:
        'عندك {count} تذاكر توقع جديدة. توقع نتيجة المباريات واكسب عملات! ⚽',
    dailyQuizReadyTitle: '🧠 اختبار جديد جاهز!',
    dailyQuizReadyBody: 'اختبار اليوم في انتظارك. اثبت معرفتك بالكرة واكسب XP!',
    dailyQuizTimeTitle: '⚽ وقت الكويز!',
    dailyQuizTimeBody: 'أسئلة جديدة كل يوم — جرب حظك وشوف مستواك!',
    dailyQuizChallengeTitle: '🏆 تحدي اليوم!',
    dailyQuizChallengeBody: 'اختبار جديد نزل دلوقتي. جاوب صح واكسب عملات وXP!',
    cooldownAvatarTitle: '📸 غيّر صورتك!',
    cooldownAvatarBody: 'الكولداون خلص — تقدر تغير صورة بروفايلك دلوقتي!',
    cooldownCoverTitle: '🖼️ غيّر الغلاف!',
    cooldownCoverBody: 'تقدر تغير صورة الغلاف دلوقتي. اختار صورة جديدة!',
    cooldownReelTitle: '🎬 ارفع فيديو جديد!',
    cooldownReelBody: 'تقدر ترفع فيديو جديد دلوقتي. شارك موهبتك مع الجمهور!',
    cooldownUsernameTitle: '✏️ غيّر اسمك!',
    cooldownUsernameBody: 'تقدر تغير اسم المستخدم دلوقتي.',
    videoReadyTitle: '✅ فيديوك جاهز!',
    videoReadyBody: 'تمت معالجة فيديوك بنجاح وهو متاح الآن للمشاهدة.',
    videoFailedTitle: '❌ فشل رفع الفيديو',
    videoFailedBody: 'حدث خطأ أثناء معالجة فيديوك. حاول مرة أخرى من الملف الشخصي.',
    avatarUpdatedTitle: '🖼️ صورة البروفايل',
    avatarUpdatedBody: 'تم تحديث صورة البروفايل بنجاح.',
    coverUpdatedTitle: '🎨 صورة الغلاف',
    coverUpdatedBody: 'تم تحديث صورة الغلاف بنجاح.',
    avatarChangeBlockedTitle: 'تغيير صورة البروفايل',
    avatarChangeBlockedBody: 'لا يمكنك تغيير صورة البروفايل الآن.',
    coverChangeBlockedTitle: 'تغيير صورة الغلاف',
    coverChangeBlockedBody: 'لا يمكنك تغيير صورة الغلاف الآن.',
    mentionInVideoTitle: 'تم الإشارة إليك',
    mentionInVideoBody: 'قام شخص بالإشارة إليك في فيديو.',
    // تفاعلات الريلز
    reelLikeTitle: '❤️ أعجب بمقطعك',
    reelLikeTitleMany: '❤️ {count} إعجاب على مقطعك',
    reelLikeBody: '{user} أعجب بمقطعك',
    reelLikeBodyMany: '{user} و{others} آخرين أعجبوا بمقطعك',
    reelCommentTitle: 'تعليق جديد',
    reelCommentBody: '{user}: {content}',
    reelReplyTitle: 'رد جديد',
    reelReplyBody: '{user}: {content}',
    reelMentionTitle: 'تم الإشارة إليك في تعليق',
    reelMentionBody: 'قام {user} بالإشارة إليك في تعليق',
    reelCommentLikeTitle: '❤️ إعجاب على تعليقك',
    reelCommentLikeBody: 'أعجب {user} بتعليقك',
    reelShareTitle: '🔗 شاركوا مقطعك!',
    reelShareBody: '{user} شارك مقطعك على {platform}',
    // إنجازات الترتيب
    medalGoldName: 'ذهبية 🥇',
    medalSilverName: 'فضية 🥈',
    medalBronzeName: 'برونزية 🥉',
    medalAwardedTitle: 'مبروك! حصلت على ميدالية',
    medalAwardedBody: 'حصلت على ميدالية {medal} في تصنيف {category}',
    diamondAwardedTitle: '💎 مبروك! حصلت على ميدالية الدايموند!',
    diamondAwardedBody: 'أنت بطل! ظهرت في تشكيلة الشهر 3 شهور متتالية. حصلت على 1000 كوين هدية!',
    diamondCoinTransactionDescription: 'هدية ميدالية الدايموند - 3 شهور متتالية في تشكيلة الشهر',
    teamOfMonthMedalTitle: 'مبروك! أنت في تشكيلة الشهر',
    teamOfMonthMedalBody: 'حصلت على ميدالية {medal} في تشكيلة الشهر',
    // إجراءات الإشراف على المستخدم
    moderationReelDeletedTitle: 'تنبيه: تم حذف فيديوك',
    moderationReelDeletedBody:
        'تم حذف مقطعك لتلقيه بلاغات متعددة ({reason}). تحذير: استمرار المخالفات سيؤدي إلى حظر حسابك نهائياً!',
    moderationCommentDeletedTitle: 'تنبيه: تم حذف تعليقك',
    moderationCommentDeletedBody:
        'تم حذف تعليقك لتلقيه بلاغات متعددة ({reason}). تحذير: يرجى الالتزام بالقواعد لكي لا يتم حظر حسابك بصفة دائمة.',
    accountSuspendedTitle: 'تم تعليق حسابك',
    accountSuspendedBody: 'تم تعليق حسابك حتى {until}. السبب: {reason}',
    accountSuspendedReason: 'وصلت إلى {count} تحذيرات',
    // إنجاز لوحة الصدارة
    leaderboardTop10Title: '🏆 بطل التوقعات!',
    leaderboardTop10Body: 'تهانينا! لقد دخلت قائمة أفضل 10 متوقعين 🔥',
    // أحداث المباراة (بطاقات / تذكير / بدء)
    matchYellowCardTitle: '🟨 بطاقة صفراء!',
    matchRedCardTitle: '🟥 بطاقة حمراء!',
    matchCardBody: '{player} ({team}) - الدقيقة {minute}',
    matchCardPlayerFallback: 'لاعب',
    leagueMatchSoonTitle: '⏰ مباراة قريبًا!',
    leagueMatchSoonBody: '{home} ضد {away} - بعد {minutes} دقيقة',
    leagueMatchStartedTitle: '🚀 بدأت المباراة!',
    leagueMatchStartedBody: '{home} ضد {away}\n{league}\nالمباراة بدأت الآن',
    // إنجاز عدد المتابعين
    followerMilestoneTitle: '🎉 إنجاز جديد!',
    followerMilestoneBody: 'وصلت لـ {count} متابع!',
    // Mux webhook: فيديو جديد من متابَع
    newVideoFromFollowTitle: '🎬 فيديو جديد!',
    newVideoFromFollowBody: '{user} نشر فيديو جديد — شوفه دلوقتي!',
    // ترقي المستوى
    levelUpTitle: '🎉 ترقيت لمستوى جديد!',
    levelUpBody: 'وصلت للمستوى {level} — كمّل وارتقي!',
    // أفضل 3 على لوحة الصدارة
    leaderboardTop3Title: '🥇 من أبطال التوقعات!',
    leaderboardTop3Body: 'دخلت قائمة أفضل 3 متوقعين — في النخبة 🔥',
    // دورة حياة البلاغ
    reportSubmittedTitle: '🚩 تم استلام بلاغك',
    reportSubmittedBody: 'شكراً على البلاغ. فريقنا بيراجعه.',
    reportCommentSubmittedTitle: '🚩 تم استلام بلاغك',
    reportCommentSubmittedBody: 'شكراً على إبلاغك عن التعليق. بنراجعه دلوقتي.',
    reportResolvedTitle: '✅ تم حل البلاغ',
    reportResolvedBody: 'راجعنا بلاغك واتخذنا الإجراء المناسب.',
    reelReportWarningTitle: 'فيديوك مهدد بالحذف',
    reelReportWarningBody:
        'فيديوك تلقى 5 بلاغات وهو مهدد بالحذف. راجع المحتوى وتأكد إنه يلتزم بإرشادات المجتمع.',
    // رفع الأفاتار
    avatarUploadCompleteTitle: '✅ تم تحديث الأفاتار',
    avatarUploadCompleteBody: 'صورة بروفايلك الجديدة ظهرت دلوقتي.',
    avatarUploadFailedTitle: '❌ فشل رفع الأفاتار',
    avatarUploadFailedBody: 'حصلت مشكلة وأنت بترفع الأفاتار. حاول تاني.',
    // الكويز اليومي / عجلة الحظ
    dailyQuizRenewedTitle: '🧠 كويز اليوم جاهز!',
    dailyQuizRenewedBody: 'كويز اليوم جاهز — العب دلوقتي واكسب XP.',
    luckyWheelRenewedTitle: '🎡 عجلة الحظ رجعت!',
    luckyWheelRenewedBody: 'تقدر تلف دلوقتي — اكسب جائزة اليوم.',
    // كولداون عام
    cooldownReadyTitle: '✨ تقدر تعمل دي تاني',
    cooldownReadyBody: 'تقدر {resource} دلوقتي. اضغط للمتابعة.',
    // AI كوتش
    aiCheckinTitle: '🏆 وقت المراجعة مع المدرب',
    aiCheckinBody: '{name}، عملت تمارينك النهاردة؟ يلا نتابع ونشوف عشان تتطور لأحسن.',
    aiCheckinFallbackBody: '{name}، جاهز لجولة تانية؟ ادخل وكمّل ستريكك.',
    // أحداث المباراة الموسعة
    matchSubstitutionTitle: '🔁 تبديل',
    matchSubstitutionBody: '{playerIn} بدل {playerOut} ({team}) — الدقيقة {minute}',
    matchVarTitle: '📺 مراجعة الفار',
    matchVarBody: '{team} — {detail} (الدقيقة {minute})',
    matchPenaltyTitle: '🎯 ضربة جزاء!',
    matchPenaltyBody: 'احتسبت ضربة جزاء لـ{team} (الدقيقة {minute})',
    matchLineupTitle: '📋 تم إعلان التشكيلات',
    matchLineupBody: '{home} ضد {away} — ظهرت التشكيلات',
    matchFavoriteTitle: '🔔 تم تمييز المباراة',
    matchFavoriteBody: '{home} ضد {away} — سنخبرك بالأهداف والأحداث المهمة',
};

const TEMPLATES: Record<SupportedLanguage, TemplateMap> = { en, ar };

/** Common API-Football / 365 VAR detail strings → Arabic for push copy. */
const VAR_DETAIL_AR: Record<string, string> = {
    'goal cancelled': 'إلغاء هدف',
    'goal canceled': 'إلغاء هدف',
    'goal disallowed': 'هدف غير محتسب',
    'goal disallowed - offside': 'هدف غير محتسب — تسلل',
    'goal disallowed - foul': 'هدف غير محتسب — خطأ',
    'goal disallowed - handball': 'هدف غير محتسب — لمسة يد',
    'goal disallowed - encroachment': 'هدف غير محتسب — دخول مبكر',
    'goal confirmed': 'تأكيد الهدف',
    'penalty confirmed': 'تأكيد ركلة الجزاء',
    'penalty cancelled': 'إلغاء ركلة الجزاء',
    'penalty canceled': 'إلغاء ركلة الجزاء',
    'card upgrade': 'ترقية البطاقة',
};

/**
 * Localize VAR event detail text for push bodies.
 * Unknown English details are returned as-is for EN, and lightly cleaned for AR.
 */
export function localizeMatchVarDetail(
    detail: string,
    language: SupportedLanguage | string | null | undefined,
): string {
    const raw = (detail || '').trim();
    if (!raw) return raw;
    const lang = language === 'ar' ? 'ar' : 'en';
    if (lang !== 'ar') return raw;

    const key = raw.toLowerCase();
    if (VAR_DETAIL_AR[key]) return VAR_DETAIL_AR[key];

    for (const [en, ar] of Object.entries(VAR_DETAIL_AR)) {
        if (key.includes(en)) return ar;
    }

    return raw
        .replace(/Goal cancelled/gi, 'إلغاء هدف')
        .replace(/Goal canceled/gi, 'إلغاء هدف')
        .replace(/Goal Disallowed/gi, 'هدف غير محتسب')
        .replace(/Goal confirmed/gi, 'تأكيد الهدف')
        .replace(/Penalty cancelled/gi, 'إلغاء ركلة الجزاء')
        .replace(/Penalty canceled/gi, 'إلغاء ركلة الجزاء')
        .replace(/Penalty confirmed/gi, 'تأكيد ركلة الجزاء')
        .replace(/Card upgrade/gi, 'ترقية البطاقة')
        .replace(/offside/gi, 'تسلل')
        .replace(/handball/gi, 'لمسة يد')
        .replace(/foul/gi, 'خطأ');
}

export function normalizeSupportedLanguage(
    raw: string | null | undefined,
): SupportedLanguage {
    if (!raw) return DEFAULT_LANGUAGE;
    const lower = raw.trim().toLowerCase();
    if (lower === 'ar' || lower.startsWith('ar-') || lower.startsWith('ar_')) return 'ar';
    if (lower === 'en' || lower.startsWith('en-') || lower.startsWith('en_')) return 'en';
    return DEFAULT_LANGUAGE;
}

/**
 * Render a single push template key for the given language. Variable
 * interpolation supports both `{name}` and `{{name}}` to stay tolerant
 * of the syntax used by translators.
 */
export function renderPushTemplate(
    key: PushTemplateKey,
    language: SupportedLanguage | string | null | undefined,
    vars: Record<string, string | number> = {},
): string {
    const lang = normalizeSupportedLanguage(
        typeof language === 'string' ? language : language ?? undefined,
    );
    const fallback = TEMPLATES[DEFAULT_LANGUAGE][key];
    const template = TEMPLATES[lang]?.[key] ?? fallback ?? '';

    return Object.entries(vars).reduce((acc, [k, v]) => {
        const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return acc
            .replace(new RegExp(`\\{${escaped}\\}`, 'g'), String(v))
            .replace(new RegExp(`\\{\\{${escaped}\\}\\}`, 'g'), String(v));
    }, template);
}

/**
 * In-process cache of `userId → language`. Push notifications often
 * hit the same user repeatedly within seconds (goal flurry, match
 * end), and looking the language up in Postgres every time would be
 * wasteful. The cache is bounded and short-lived to stay correct
 * after a user changes their language.
 */
const LANGUAGE_CACHE = new Map<string, { lang: SupportedLanguage; expiresAt: number }>();
const LANGUAGE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function readCachedLanguage(userId: string): SupportedLanguage | null {
    const entry = LANGUAGE_CACHE.get(userId);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
        LANGUAGE_CACHE.delete(userId);
        return null;
    }
    return entry.lang;
}

function writeCachedLanguage(userId: string, lang: SupportedLanguage): void {
    // Hard cap to avoid unbounded growth in long-lived processes.
    if (LANGUAGE_CACHE.size > 5_000) LANGUAGE_CACHE.clear();
    LANGUAGE_CACHE.set(userId, { lang, expiresAt: Date.now() + LANGUAGE_CACHE_TTL_MS });
}

/** Public: invalidate after the language sync endpoint accepts a change. */
export function invalidateUserLanguageCache(userId: string): void {
    LANGUAGE_CACHE.delete(userId);
}

/**
 * Resolve the user's preferred language from `User.settings.language`.
 * Always returns a supported value, defaulting to English.
 */
export async function getUserLanguage(userId: string): Promise<SupportedLanguage> {
    if (!userId) return DEFAULT_LANGUAGE;
    const cached = readCachedLanguage(userId);
    if (cached) return cached;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { settings: true },
        });
        const settings = (user?.settings as Record<string, unknown> | null) ?? null;
        const raw =
            settings && typeof settings.language === 'string'
                ? settings.language
                : settings && typeof settings.locale === 'string'
                  ? settings.locale
                  : '';
        const lang = normalizeSupportedLanguage(raw);
        writeCachedLanguage(userId, lang);
        return lang;
    } catch (err) {
        logger.warn('[push-templates] getUserLanguage failed, falling back:', err);
        return DEFAULT_LANGUAGE;
    }
}

/**
 * Convenience: resolve language and render a template body in one call.
 * Used by controllers/services that already have a `userId` and need a
 * localized push payload.
 */
export async function renderPushForUser(
    userId: string,
    titleKey: PushTemplateKey,
    bodyKey: PushTemplateKey,
    vars: Record<string, string | number> = {},
): Promise<{ title: string; body: string; language: SupportedLanguage }> {
    const language = await getUserLanguage(userId);
    return {
        language,
        title: renderPushTemplate(titleKey, language, vars),
        body: renderPushTemplate(bodyKey, language, vars),
    };
}


/**
 * Read a user's language preference from a Prisma `User.settings` JSON
 * blob without making an extra DB query. Falls back to English when
 * the value is missing or unsupported, never throws.
 *
 * Use this in bulk notifiers that already select `settings` alongside
 * the push token, to avoid N+1 round-trips.
 */
export function readLanguageFromSettings(
    settings: unknown,
): SupportedLanguage {
    if (!settings || typeof settings !== 'object') return DEFAULT_LANGUAGE;
    const obj = settings as Record<string, unknown>;
    const raw =
        typeof obj.language === 'string'
            ? obj.language
            : typeof obj.locale === 'string'
              ? obj.locale
              : '';
    return normalizeSupportedLanguage(raw);
}
