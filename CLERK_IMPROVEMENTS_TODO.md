# 🔧 Clerk Improvements - TODO List

## الحالة: Clerk شغال كويس، بس يحتاج تحسينات بسيطة

---

## 🔴 عاجل (يجب إصلاحها قبل Production)

### 1. نقل المفاتيح السرية من `.env` لـ `.env.local`

**المشكلة:**
- المفاتيح السرية موجودة في `.env` (قد تُرفع على Git)

**الحل:**
```bash
# Backend
cd Backend
cp .env .env.local
# احذف المفاتيح من .env وخليها في .env.local فقط

# Frontend
cd front
cp .env .env.local
# احذف المفاتيح من .env وخليها في .env.local فقط
```

**تأكد من:**
```gitignore
# في .gitignore
.env.local
*.local
```

---

### 2. إضافة `CLERK_WEBHOOK_SECRET` في `.env`

**الحالة:** ⚠️ ناقص

**الخطوات:**
1. اذهب لـ [Clerk Dashboard](https://dashboard.clerk.com)
2. اختر Project
3. Webhooks → Create Endpoint
4. URL: `https://your-api.com/api/webhooks/clerk`
5. Events: `user.created`, `user.updated`, `user.deleted`
6. انسخ Signing Secret

**أضف في `.env.local`:**
```env
CLERK_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

---

### 3. إضافة Rate Limiting على Auth Endpoints

**الكود:**
```typescript
// Backend/src/middleware/auth-rate-limit.middleware.ts
import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictAuthRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts
  message: 'Too many failed attempts, account temporarily locked',
});
```

**استخدام:**
```typescript
// في routes
router.post('/auth/login', authRateLimiter, loginHandler);
router.post('/auth/signup', authRateLimiter, signupHandler);
router.post('/auth/forgot-password', strictAuthRateLimiter, forgotPasswordHandler);
```

---

## 🟠 مهم (الأسبوع القادم)

### 4. إكمال Account Deletion Service

**الحالة:** ⚠️ Partially Implemented

**ما ناقص:**
```typescript
// Backend/src/services/account-deletion.service.ts

export class AccountDeletionService {
  /**
   * Soft delete with 30-day grace period
   */
  static async initiateAccountDeletion(clerkUserId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { clerkUserId } });
    if (!user) throw new Error('User not found');

    // Mark for deletion
    await prisma.user.update({
      where: { id: user.id },
      data: {
        deletionScheduledAt: new Date(),
        deletionScheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Send notification
    await this.sendDeletionNotification(user.email);
  }

  /**
   * Cancel deletion (within grace period)
   */
  static async cancelAccountDeletion(clerkUserId: string): Promise<void> {
    await prisma.user.update({
      where: { clerkUserId },
      data: {
        deletionScheduledAt: null,
        deletionScheduledFor: null,
      },
    });
  }

  /**
   * Permanent deletion (after grace period)
   */
  static async permanentlyDeleteAccount(userId: string): Promise<void> {
    // Delete all user data
    await prisma.$transaction([
      // Delete reels
      prisma.reel.deleteMany({ where: { userId } }),
      // Delete comments
      prisma.comment.deleteMany({ where: { userId } }),
      // Delete likes
      prisma.like.deleteMany({ where: { userId } }),
      // Delete follows
      prisma.follow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
      // Delete notifications
      prisma.notification.deleteMany({ where: { userId } }),
      // Delete user
      prisma.user.delete({ where: { id: userId } }),
    ]);

    // Delete from Clerk
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.clerkUserId) {
      await this.deleteClerkUser(user.clerkUserId);
    }
  }

  /**
   * Cron job to delete expired accounts
   */
  static async processScheduledDeletions(): Promise<void> {
    const now = new Date();
    const usersToDelete = await prisma.user.findMany({
      where: {
        deletionScheduledFor: { lte: now },
      },
    });

    for (const user of usersToDelete) {
      await this.permanentlyDeleteAccount(user.id);
      logger.info(`Permanently deleted user ${user.id}`);
    }
  }
}
```

**إضافة Cron Job:**
```typescript
// في main.ts
import cron from 'node-cron';

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  logger.info('Running scheduled account deletions...');
  await AccountDeletionService.processScheduledDeletions();
});
```

**إضافة Fields في Schema:**
```prisma
model User {
  // ... existing fields
  deletionScheduledAt  DateTime?
  deletionScheduledFor DateTime?
}
```

---

### 5. إضافة Audit Logging

**الكود:**
```typescript
// Backend/src/services/audit.service.ts
export class AuditService {
  static async log(params: {
    userId: string;
    action: string;
    resource: string;
    details?: any;
    ip?: string;
  }): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        details: params.details,
        ip: params.ip,
        timestamp: new Date(),
      },
    });
  }
}
```

**استخدام:**
```typescript
// في Auth middleware
await AuditService.log({
  userId: req.auth.userId,
  action: 'LOGIN',
  resource: 'AUTH',
  ip: req.ip,
});

// في Account Deletion
await AuditService.log({
  userId: user.id,
  action: 'ACCOUNT_DELETION_INITIATED',
  resource: 'USER',
  details: { scheduledFor: deletionDate },
});
```

---

## 🟡 محسّنات (الشهر القادم)

### 6. تحسين Cache Strategy

**الحالة الحالية:**
- Cache TTL = 5 minutes
- In-memory cache (يضيع عند restart)

**التحسين:**
```typescript
// استخدام Redis للـ cache
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function getVerifiedUser(userId: string): Promise<boolean> {
  // Check Redis cache
  const cached = await redis.get(`user:${userId}`);
  if (cached) return true;

  // Verify with Clerk
  const user = await clerkClient.users.getUser(userId);
  if (user) {
    // Cache in Redis for 10 minutes
    await redis.setex(`user:${userId}`, 600, 'verified');
    return true;
  }
  return false;
}
```

---

### 7. إضافة Monitoring

**استخدام Sentry:**
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

// في Auth middleware
try {
  const verifiedToken = await clerkClient.verifyToken(token);
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'auth' },
    extra: { path: req.path },
  });
  throw error;
}
```

---

### 8. إضافة Tests

**Unit Tests:**
```typescript
// Backend/src/__tests__/clerk-middleware.test.ts
describe('Clerk Middleware', () => {
  it('should verify valid token', async () => {
    const token = 'valid_token';
    const result = await clerkClient.verifyToken(token);
    expect(result).toBeDefined();
    expect(result.sub).toBeDefined();
  });

  it('should reject invalid token', async () => {
    const token = 'invalid_token';
    await expect(clerkClient.verifyToken(token)).rejects.toThrow();
  });

  it('should cache verified users', async () => {
    const userId = 'user_123';
    await getVerifiedUser(userId);
    // Second call should be cached
    const start = Date.now();
    await getVerifiedUser(userId);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(10); // Should be instant
  });
});
```

**Integration Tests:**
```typescript
// Backend/src/__tests__/auth-flow.test.ts
describe('Auth Flow', () => {
  it('should authenticate user with valid token', async () => {
    const response = await request(app)
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${validToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('SUCCESS');
  });

  it('should reject request without token', async () => {
    const response = await request(app)
      .get('/api/user/profile');
    
    expect(response.status).toBe(401);
  });
});
```

---

## 📊 Progress Tracker

- [x] JWT Verification Fix
- [ ] نقل المفاتيح السرية
- [ ] إضافة Webhook Secret
- [ ] Rate Limiting
- [ ] Account Deletion Service
- [ ] Audit Logging
- [ ] Redis Cache
- [ ] Monitoring
- [ ] Tests

---

## 🎯 الأولويات

### هذا الأسبوع:
1. ✅ JWT Verification (مكتمل)
2. 🔄 نقل المفاتيح السرية
3. 🔄 Webhook Secret

### الأسبوع القادم:
1. Rate Limiting
2. Account Deletion
3. Audit Logging

### الشهر القادم:
1. Redis Cache
2. Monitoring
3. Tests

---

## 📝 ملاحظات

- Clerk شغال كويس جداً الآن ✅
- الأمان محسّن بشكل كبير ✅
- التحسينات المتبقية مهمة بس مش عاجلة
- يمكن إطلاق التطبيق بالحالة الحالية (بعد نقل المفاتيح)
