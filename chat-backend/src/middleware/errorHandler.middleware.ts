import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger.service.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error(`❌ Unhandled Exception on ${req.method} ${req.url}`, err);

  const statusCode = err.statusCode || 500;
  const message = err.isOperational 
    ? err.message 
    : 'عذراً، حدث خطأ غير متوقع في الخادم. نحن نعمل على إصلاحه.';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
