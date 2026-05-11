import rateLimit from 'express-rate-limit';
import { CONSTANTS } from '../config/constants.js';

export const globalRateLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMIT.GLOBAL_WINDOW_MS,
  max: CONSTANTS.RATE_LIMIT.GLOBAL_MAX_REQUESTS,
  message: {
    error: 'عذراً، لقد تجاوزت الحد المسموح به من الطلبات. يرجى المحاولة بعد قليل.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const chatRateLimiter = rateLimit({
  windowMs: CONSTANTS.RATE_LIMIT.CHAT_WINDOW_MS,
  max: CONSTANTS.RATE_LIMIT.CHAT_MAX_REQUESTS,
  message: {
    error: 'عذراً، أنت ترسل رسائل بسرعة كبيرة. يرجى الانتظار دقيقة واحدة.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
