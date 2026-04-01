# 🛡️ Security Quick Reference Guide

Quick reference for developers working with the 90Plus backend security features.

---

## 🔐 Authentication

### Protect a Route

```typescript
import { requireAuth } from '../middleware/clerk.middleware';

router.get('/profile', requireAuth, getProfile);
```

### Optional Authentication

```typescript
import { optionalAuth } from '../middleware/clerk.middleware';

router.get('/reels', optionalAuth, getReels);
```

### Admin Only

```typescript
import { requireAuth } from '../middleware/clerk.middleware';
import { requireRole } from '../middleware/rbac.middleware';

router.delete('/users/:id', requireAuth, requireRole(['ADMIN']), deleteUser);
```

---

## ✅ Input Validation

### Using Zod (Recommended)

```typescript
import { validateZod, CommonSchemas } from '../middleware/zod-validation.middleware';
import { z } from 'zod';

const schema = {
  body: z.object({
    username: CommonSchemas.username,
    email: CommonSchemas.email,
    bio: CommonSchemas.bio,
  }),
};

router.post('/register', validateZod(schema), register);
```

### Common Schemas

```typescript
CommonSchemas.uuid          // UUID validation
CommonSchemas.email         // Email validation
CommonSchemas.username      // Username (3-20 chars)
CommonSchemas.bio           // Bio (max 500 chars)
CommonSchemas.caption       // Caption (max 2000 chars)
CommonSchemas.hashtags      // Hashtags array (max 10)
CommonSchemas.reportReason  // Report reason (10-500 chars)
CommonSchemas.pagination    // { page, limit }
```

---

## 🛡️ CSRF Protection

### Add CSRF Protection

```typescript
import { csrfProtection } from '../middleware/csrf.middleware';

router.post('/reels', requireAuth, csrfProtection, createReel);
```

### Frontend Usage

```typescript
// 1. Get token
const { csrfToken } = await fetch('/api/csrf-token').then(r => r.json());

// 2. Send with request
await fetch('/api/reels', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify(data),
});
```

---

## 🔒 Ownership Verification

### Verify User Owns Resource

```typescript
import { verifyOwnership } from '../middleware/zero-trust.middleware';

// Only owner can delete their reel
router.delete('/reels/:id', requireAuth, verifyOwnership('reel'), deleteReel);

// Only owner can delete their comment
router.delete('/comments/:id', requireAuth, verifyOwnership('comment'), deleteComment);
```

---

## 📊 Rate Limiting

### IP-Based

```typescript
import { createRateLimiter } from '../middleware/rateLimit.middleware';

const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests
});

router.use('/api', limiter);
```

### User-Based

```typescript
import { userRateLimit } from '../middleware/zero-trust.middleware';

// 60 requests per minute per user
router.use(userRateLimit(60, 60 * 1000));
```

---

## 📝 Audit Logging

### Log Authentication

```typescript
import { AuditService, AuditAction } from '../services/audit.service';

await AuditService.logAuth({
  action: AuditAction.LOGIN,
  userId: user.id,
  req,
});
```

### Log Security Event

```typescript
await AuditService.logSecurity({
  action: AuditAction.UNAUTHORIZED_ACCESS,
  userId: user.id,
  req,
  reason: 'Attempted to access admin route',
});
```

### Log Content Deletion

```typescript
await AuditService.logContentDeleted(
  reelId,
  AuditTargetType.REEL,
  userId,
  'Violated community guidelines'
);
```

---

## 🚫 Token Revocation

### Revoke Single Token

```typescript
import { TokenRevocationService } from '../services/token-revocation.service';

await TokenRevocationService.revokeToken({
  token: userToken,
  userId: user.id,
  reason: 'User requested logout',
});
```

### Revoke All Tokens

```typescript
await TokenRevocationService.revokeAllUserTokens({
  userId: user.id,
  reason: 'Password changed',
});
```

---

## 🛡️ Abuse Detection

### Track User Request

```typescript
import { AbuseDetectionService } from '../services/abuse-detection.service';

const allowed = AbuseDetectionService.trackUserRequest(userId);
if (!allowed) {
  return res.status(429).json({ message: 'Too many requests' });
}
```

### Track Failed Auth

```typescript
AbuseDetectionService.trackFailedAuth(userId, req.ip);
```

### Track Delete Operation

```typescript
AbuseDetectionService.trackDelete(userId, req.ip);
```

---

## 🔍 Content Moderation

### Moderate Text

```typescript
import { TextModerationService } from '../services/text-moderation.service';

const result = TextModerationService.moderateText(userComment, 'en');

if (result.containsBannedWords) {
  return res.status(400).json({
    message: 'Content contains inappropriate language',
    detectedWords: result.detectedWords,
  });
}
```

### Validate Image

```typescript
import { validateImage, optimizeImage } from '../middleware/image-moderation.middleware';

router.post('/upload', requireAuth, validateImage, optimizeImage, uploadHandler);
```

---

## 🌐 Frontend API Client

### Basic Usage

```typescript
import { apiClient } from '../services/api.client';

// GET request
const response = await apiClient.get('/reels');

// POST request
const response = await apiClient.post('/reels', {
  caption: 'Hello',
  hashtags: ['football'],
});

// PUT request
const response = await apiClient.put('/profile', {
  displayName: 'John Doe',
});

// DELETE request
const response = await apiClient.delete('/reels/123');
```

### Queue Status

```typescript
const status = apiClient.getQueueStatus();
console.log('Queued requests:', status.size);
console.log('Is online:', status.isOnline);
```

### Clear Queue

```typescript
await apiClient.clearQueue();
```

---

## 🔧 Error Handling

### Standard Error Response

```typescript
res.status(400).json({
  error: 'E001', // Error code
  message: 'Validation failed',
  details: errors,
  timestamp: new Date().toISOString(),
  path: req.path,
});
```

### Error Codes

| Code | Category | Meaning |
|------|----------|---------|
| E001 | Validation | Input validation failed |
| E002 | Authentication | Authentication failed |
| E003 | Authorization | Insufficient permissions |
| E004 | Not Found | Resource not found |
| E005 | Conflict | Resource conflict |
| E006 | Rate Limit | Too many requests |
| E007 | File Upload | Invalid file |
| E008 | External Service | Third-party API failure |
| E009 | Database | Database error |
| E010 | Internal | Internal server error |

---

## 🧪 Testing

### Test Protected Route

```typescript
import request from 'supertest';
import app from '../main';

describe('Protected Route', () => {
  it('should return 401 without token', async () => {
    const response = await request(app)
      .get('/api/profile')
      .expect(401);
  });

  it('should return 200 with valid token', async () => {
    const response = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);
  });
});
```

### Test Validation

```typescript
it('should validate input', async () => {
  const response = await request(app)
    .post('/api/reels')
    .set('Authorization', `Bearer ${validToken}`)
    .send({ caption: '' }) // Invalid: empty caption
    .expect(400);

  expect(response.body.error).toBe('E001');
});
```

---

## 📚 Common Patterns

### Create Resource

```typescript
router.post('/reels',
  requireAuth,                    // 1. Authenticate
  validateZod(createReelSchema),  // 2. Validate input
  csrfProtection,                 // 3. CSRF protection
  createReel                      // 4. Handler
);
```

### Update Resource

```typescript
router.put('/reels/:id',
  requireAuth,                    // 1. Authenticate
  verifyOwnership('reel'),        // 2. Verify ownership
  validateZod(updateReelSchema),  // 3. Validate input
  csrfProtection,                 // 4. CSRF protection
  updateReel                      // 5. Handler
);
```

### Delete Resource

```typescript
router.delete('/reels/:id',
  requireAuth,                    // 1. Authenticate
  verifyOwnership('reel'),        // 2. Verify ownership
  csrfProtection,                 // 3. CSRF protection
  deleteReel                      // 4. Handler
);
```

### Admin Action

```typescript
router.post('/admin/ban-user',
  requireAuth,                    // 1. Authenticate
  requireRole(['ADMIN']),         // 2. Check admin role
  validateZod(banUserSchema),     // 3. Validate input
  csrfProtection,                 // 4. CSRF protection
  banUser                         // 5. Handler
);
```

---

## 🚀 Performance Tips

1. **Use Zod schemas** - Faster than class-validator
2. **Cache validation results** - For repeated validations
3. **Use indexes** - On frequently queried fields
4. **Batch operations** - Use Prisma transactions
5. **Rate limit aggressively** - On expensive operations

---

## 🔗 Quick Links

- [Full Security Documentation](./SECURITY.md)
- [OWASP Checklist](./OWASP_SECURITY_CHECKLIST.md)
- [Installation Guide](./INSTALL_SECURITY_DEPENDENCIES.md)
- [Arabic Report](../TASK_10_SECURITY_IMPLEMENTATION_AR.md)

---

**Last Updated**: April 1, 2026
