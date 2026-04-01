# 🛡️ Security Documentation

## Overview

This document outlines the security measures implemented in the 90Plus backend API to protect against common vulnerabilities and attacks.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Input Validation](#input-validation)
3. [Rate Limiting](#rate-limiting)
4. [CSRF Protection](#csrf-protection)
5. [XSS Protection](#xss-protection)
6. [SQL Injection Protection](#sql-injection-protection)
7. [Security Headers](#security-headers)
8. [Audit Logging](#audit-logging)
9. [Token Management](#token-management)
10. [Abuse Detection](#abuse-detection)
11. [Content Moderation](#content-moderation)
12. [GDPR Compliance](#gdpr-compliance)

---

## Authentication & Authorization

### Clerk Authentication

- **JWT-based authentication** using Clerk SDK
- **Token verification** on every protected route
- **Session management** with automatic expiration
- **Multi-device support** with device tracking

### Implementation

```typescript
// Middleware: Backend/src/middleware/clerk.middleware.ts
import { requireAuth, optionalAuth } from '../middleware/clerk.middleware';

// Protected route
router.get('/profile', requireAuth, getProfile);

// Public route with optional auth
router.get('/reels', optionalAuth, getReels);
```

### Role-Based Access Control (RBAC)

```typescript
// Middleware: Backend/src/middleware/rbac.middleware.ts
import { requireRole } from '../middleware/rbac.middleware';

// Admin-only route
router.delete('/users/:id', requireAuth, requireRole(['ADMIN']), deleteUser);
```

### Zero Trust Architecture

- **Ownership verification** for all resource access
- **No implicit trust** - verify every request
- **Principle of least privilege**

```typescript
// Middleware: Backend/src/middleware/zero-trust.middleware.ts
import { verifyOwnership } from '../middleware/zero-trust.middleware';

// Only owner can delete their reel
router.delete('/reels/:id', requireAuth, verifyOwnership('reel'), deleteReel);
```

---

## Input Validation

### Zod Validation (Recommended)

Type-safe validation with automatic TypeScript inference:

```typescript
// Middleware: Backend/src/middleware/zod-validation.middleware.ts
import { validateZod, CommonSchemas } from '../middleware/zod-validation.middleware';
import { z } from 'zod';

const createReelSchema = {
  body: z.object({
    caption: CommonSchemas.caption,
    hashtags: CommonSchemas.hashtags.optional(),
  }),
};

router.post('/reels', requireAuth, validateZod(createReelSchema), createReel);
```

### Legacy Validation

```typescript
// Middleware: Backend/src/middleware/validation.middleware.ts
import { validate } from '../middleware/validation.middleware';

const schema = {
  body: {
    username: { type: 'string', required: true, min: 3, max: 20 },
    email: { type: 'string', required: true, pattern: /^.+@.+\..+$/ },
  },
};

router.post('/register', validate(schema), register);
```

### XSS Protection

All string inputs are automatically sanitized:

```typescript
// Removes: <script>, javascript:, data:, event handlers, HTML entities
const sanitized = sanitizeString(userInput);
```

### Prototype Pollution Prevention

```typescript
// Middleware: Backend/src/middleware/zero-trust.middleware.ts
import { preventPrototypePollution } from '../middleware/zero-trust.middleware';

// Blocks: __proto__, constructor, prototype in request body
router.use(preventPrototypePollution);
```

---

## Rate Limiting

### IP-Based Rate Limiting

```typescript
// Middleware: Backend/src/middleware/rateLimit.middleware.ts
import { createRateLimiter } from '../middleware/rateLimit.middleware';

// 100 requests per 15 minutes
const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

router.use('/api', limiter);
```

### User-Based Rate Limiting

```typescript
// Middleware: Backend/src/middleware/zero-trust.middleware.ts
import { userRateLimit } from '../middleware/zero-trust.middleware';

// 60 requests per minute per user
router.use(userRateLimit(60, 60 * 1000));
```

### Endpoint-Specific Limits

```typescript
// Auth endpoints: 5 requests per 15 minutes
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts',
});

router.post('/auth/login', authLimiter, login);
```

---

## CSRF Protection

### Double Submit Cookie Pattern

```typescript
// Middleware: Backend/src/middleware/csrf.middleware.ts
import { csrfProtection, getCSRFTokenHandler } from '../middleware/csrf.middleware';

// Get CSRF token
router.get('/csrf-token', getCSRFTokenHandler);

// Protected route
router.post('/reels', requireAuth, csrfProtection, createReel);
```

### Frontend Usage

```typescript
// 1. Get CSRF token
const response = await fetch('/api/csrf-token');
const { csrfToken } = await response.json();

// 2. Include in requests
await fetch('/api/reels', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify(data),
});
```

---

## XSS Protection

### Content Security Policy (CSP)

```typescript
// Helmet middleware in main.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));
```

### Input Sanitization

All user inputs are sanitized before storage:

```typescript
import { sanitizeString, sanitizeObject } from '../middleware/validation.middleware';

// Sanitize single string
const clean = sanitizeString(userInput);

// Sanitize entire object
const cleanData = sanitizeObject(req.body);
```

### Output Encoding

- **JSON responses** are automatically encoded by Express
- **HTML responses** use template engines with auto-escaping
- **User-generated content** is sanitized before display

---

## SQL Injection Protection

### Prisma ORM

All database queries use Prisma's parameterized queries:

```typescript
// ✅ SAFE: Parameterized query
const user = await prisma.user.findUnique({
  where: { email: userEmail },
});

// ❌ NEVER DO THIS: Raw SQL with string concatenation
// const user = await prisma.$queryRaw`SELECT * FROM users WHERE email = '${userEmail}'`;
```

### Raw Queries (When Necessary)

```typescript
// ✅ SAFE: Use parameterized raw queries
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${userEmail}
`;
```

---

## Security Headers

### Helmet Configuration

```typescript
// main.ts
app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: true,
}));
```

### CORS Configuration

```typescript
// main.ts
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));
```

---

## Audit Logging

### Tamper-Proof Audit Trail

```typescript
// Service: Backend/src/services/audit.service.ts
import { AuditService, AuditAction } from '../services/audit.service';

// Log authentication
await AuditService.logAuth({
  action: AuditAction.LOGIN,
  userId: user.id,
  req,
});

// Log security event
await AuditService.logSecurity({
  action: AuditAction.UNAUTHORIZED_ACCESS,
  userId: user.id,
  req,
  reason: 'Attempted to access admin route',
});
```

### Audit Log Schema

```prisma
model AuditLog {
  id           String          @id @default(uuid())
  action       AuditAction
  actorId      String?
  targetId     String?
  targetType   AuditTargetType?
  resource     String
  reason       String?
  metadata     Json?
  ip           String?
  userAgent    String?
  hash         String?         // SHA-256 hash for tamper detection
  previousHash String?         // Chain verification
  severity     String?
  createdAt    DateTime        @default(now())
}
```

---

## Token Management

### Token Revocation

```typescript
// Service: Backend/src/services/token-revocation.service.ts
import { TokenRevocationService } from '../services/token-revocation.service';

// Revoke single token (forced logout)
await TokenRevocationService.revokeToken({
  token: userToken,
  userId: user.id,
  reason: 'User requested logout',
});

// Revoke all user tokens (logout from all devices)
await TokenRevocationService.revokeAllUserTokens({
  userId: user.id,
  reason: 'Password changed',
});
```

### Token Verification

```typescript
// Middleware: Backend/src/middleware/clerk.middleware.ts
// Automatically checks revoked tokens on every request
if (TokenRevocationService.isTokenRevoked(token)) {
  return res.status(401).json({ message: 'Token revoked' });
}
```

---

## Abuse Detection

### Enterprise Immunity System

```typescript
// Service: Backend/src/services/abuse-detection.service.ts
import { AbuseDetectionService } from '../services/abuse-detection.service';

// Track user request
const allowed = AbuseDetectionService.trackUserRequest(userId);
if (!allowed) {
  return res.status(429).json({ message: 'Too many requests' });
}

// Track failed authentication
AbuseDetectionService.trackFailedAuth(userId, req.ip);

// Track delete operations
AbuseDetectionService.trackDelete(userId, req.ip);
```

### Detection Thresholds

- **Request flooding**: 120 requests/minute per user, 300/minute per IP
- **Failed auth**: 10 failed attempts/minute
- **Delete spike**: 20 deletes/minute
- **Block duration**: 15 minutes

---

## Content Moderation

### Text Moderation

```typescript
// Service: Backend/src/services/text-moderation.service.ts
import { TextModerationService } from '../services/text-moderation.service';

// Check for banned words
const result = TextModerationService.moderateText(userComment, 'en');

if (result.containsBannedWords) {
  // Block or censor content
  return res.status(400).json({
    message: 'Content contains inappropriate language',
    detectedWords: result.detectedWords,
  });
}
```

### Image Moderation

```typescript
// Middleware: Backend/src/middleware/image-moderation.middleware.ts
import { validateImage, optimizeImage } from '../middleware/image-moderation.middleware';

router.post('/upload', requireAuth, validateImage, optimizeImage, uploadHandler);
```

### Auto-Moderation

```typescript
// Middleware: Backend/src/middleware/content-moderation.middleware.ts
import { autoModerateContent } from '../middleware/content-moderation.middleware';

router.post('/comments', requireAuth, autoModerateContent('comment'), createComment);
```

---

## GDPR Compliance

### Data Export

```typescript
// Controller: Backend/src/controllers/gdpr.controller.ts
router.post('/gdpr/export', requireAuth, requestDataExport);
```

### Account Deletion

```typescript
// 30-day grace period before permanent deletion
router.post('/gdpr/delete', requireAuth, requestAccountDeletion);
router.post('/gdpr/cancel-deletion', requireAuth, cancelAccountDeletion);
```

### Consent Management

```typescript
// Update user consent preferences
router.put('/gdpr/consent', requireAuth, updateConsent);
```

---

## Security Best Practices

### Environment Variables

```bash
# .env
DATABASE_URL="postgresql://..."
CLERK_SECRET_KEY="sk_..."
JWT_SECRET="random-256-bit-secret"
ALLOWED_ORIGINS="https://app.90plus.com"
```

### Secrets Management

- ✅ Use environment variables for all secrets
- ✅ Never commit `.env` files to git
- ✅ Use different secrets for dev/staging/production
- ✅ Rotate secrets regularly
- ✅ Use secret management services (AWS Secrets Manager, etc.)

### HTTPS Only

```typescript
// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

### Dependency Security

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

---

## Incident Response

### Security Incident Checklist

1. **Identify** the security incident
2. **Contain** the threat (revoke tokens, block IPs)
3. **Investigate** the root cause
4. **Remediate** the vulnerability
5. **Document** the incident in audit logs
6. **Notify** affected users (if required by GDPR)
7. **Review** and improve security measures

### Emergency Contacts

- **Security Team**: security@90plus.com
- **On-Call Engineer**: +1-XXX-XXX-XXXX
- **Incident Response**: incidents@90plus.com

---

## Security Monitoring

### Metrics to Monitor

- Failed authentication attempts
- Rate limit violations
- Suspicious activity patterns
- Token revocations
- Content moderation actions
- GDPR requests

### Alerting

```typescript
// Example: Alert on high failed auth rate
if (failedAuthCount > 100) {
  await sendAlert({
    severity: 'HIGH',
    message: 'High failed authentication rate detected',
    count: failedAuthCount,
  });
}
```

---

## Security Testing

### Automated Testing

```bash
# Run security tests
npm run test:security

# Run property-based tests
npm run test:adversarial
```

### Manual Testing

- Penetration testing (quarterly)
- Security code reviews (every release)
- Dependency audits (monthly)
- OWASP Top 10 compliance checks

---

## Compliance

### Standards

- ✅ OWASP Top 10 2021
- ✅ GDPR (General Data Protection Regulation)
- ✅ CCPA (California Consumer Privacy Act)
- ✅ Apple App Store Guidelines
- ✅ Google Play Store Guidelines

### Certifications

- [ ] SOC 2 Type II (planned)
- [ ] ISO 27001 (planned)
- [ ] PCI DSS (if handling payments)

---

## Contact

For security concerns or to report vulnerabilities:

- **Email**: security@90plus.com
- **Bug Bounty**: https://90plus.com/security/bug-bounty
- **PGP Key**: https://90plus.com/security/pgp-key.asc

---

**Last Updated**: April 1, 2026
**Version**: 1.0.0
