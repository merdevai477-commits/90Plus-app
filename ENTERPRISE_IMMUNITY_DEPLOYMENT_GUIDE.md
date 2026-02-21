# 🚀 Enterprise Immunity Deployment Guide

**Quick Start Guide for Deploying Enterprise Immunity Features**

---

## STEP 1: Database Migrations

Run the new migrations to add tamper-proof audit fields and revoked tokens table:

```bash
cd Backend
npx prisma migrate deploy
```

**Expected Output:**
```
✅ Migration 20260220000001_add_tamper_proof_audit applied
✅ Migration 20260220000002_add_revoked_tokens applied
```

**Verify:**
```bash
npx prisma studio
```
Check that:
- `AuditLog` table has `hash`, `previousHash`, `severity` fields
- `RevokedToken` table exists with `token`, `userId`, `reason`, `expiresAt` fields

---

## STEP 2: Test Locally

Start the backend server:

```bash
cd Backend
npm run dev
```

**Expected Console Output:**
```
✅ Database connected successfully
✅ Database keep-alive started
✅ Enterprise Immunity services started
   - Token Revocation System: Active
   - Abuse Detection Engine: Active
   - Tamper-Proof Audit: Active
```

---

## STEP 3: Test Health Endpoint

```bash
curl http://localhost:3000/api/health
```

**Expected Response:**
```json
{
  "status": "OK",
  "message": "90Plus API is running",
  "database": "Connected",
  "uptime": {
    "seconds": 120,
    "formatted": "0h 2m 0s"
  },
  "memory": {
    "heapUsed": "50MB",
    "heapTotal": "100MB",
    "rss": "150MB",
    "external": "5MB"
  },
  "security": {
    "revokedTokens": 0,
    "trackedUsers": 0,
    "trackedIPs": 0,
    "blockedUsers": 0,
    "blockedIPs": 0
  }
}
```

---

## STEP 4: Test Token Revocation

### Test 1: Revoke a Token

```typescript
// In your logout endpoint or admin panel
import { TokenRevocationService } from './services/token-revocation.service';

await TokenRevocationService.revokeToken({
  token: userToken,
  userId: user.id,
  reason: 'User requested logout',
});
```

### Test 2: Verify Token is Blocked

Try to use the revoked token:

```bash
curl -H "Authorization: Bearer <revoked-token>" \
  http://localhost:3000/api/users/me
```

**Expected Response:**
```json
{
  "status": "ERROR",
  "message": "Unauthorized - Token has been revoked",
  "code": "TOKEN_REVOKED"
}
```

---

## STEP 5: Test Abuse Detection

### Test 1: Request Flooding

Send 150 requests in 1 minute from the same user:

```bash
for i in {1..150}; do
  curl -H "Authorization: Bearer <token>" \
    http://localhost:3000/api/users/me &
done
wait
```

**Expected Response (after threshold):**
```json
{
  "status": "ERROR",
  "message": "Too many requests - Please slow down",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

**Expected Console Log:**
```
🚨 User blocked for abuse {
  userId: 'user_xxx',
  reason: 'Request flooding',
  duration: '900s',
  tracker: { count: 150, failedAuthCount: 0, deleteCount: 0 }
}
```

### Test 2: Failed Auth Spike

Send 15 requests with invalid tokens:

```bash
for i in {1..15}; do
  curl -H "Authorization: Bearer invalid-token" \
    http://localhost:3000/api/users/me
done
```

**Expected Console Log:**
```
🚨 IP blocked for abuse {
  ip: '127.0.0.1',
  reason: 'Failed authorization spike',
  duration: '900s'
}
```

---

## STEP 6: Test Tamper-Proof Audit

### Test 1: Create Audit Logs

```typescript
import { TamperProofAuditService } from './services/tamper-proof-audit.service';

// Log a DELETE operation
await TamperProofAuditService.logDelete({
  actorId: req.auth.userId,
  targetId: reelId,
  targetType: AuditTargetType.REEL,
  resource: 'REEL',
  reason: 'User requested deletion',
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});
```

### Test 2: Verify Chain Integrity

```typescript
const result = await TamperProofAuditService.verifyChainIntegrity();

console.log(result);
// {
//   valid: true,
//   totalChecked: 10
// }
```

### Test 3: Simulate Tampering (DO NOT DO IN PRODUCTION)

```sql
-- Manually modify a log in database
UPDATE audit_logs SET reason = 'TAMPERED' WHERE id = 'some-id';
```

Then verify:

```typescript
const result = await TamperProofAuditService.verifyChainIntegrity();

console.log(result);
// {
//   valid: false,
//   totalChecked: 5,
//   firstTamperedIndex: 4,
//   tamperedLogId: 'some-id'
// }
```

**Expected Console Log:**
```
❌ Audit chain integrity violation: hash mismatch {
  logId: 'some-id',
  index: 4
}
```

---

## STEP 7: Deploy to Production

### 7.1 Build Backend

```bash
cd Backend
npm run build
```

### 7.2 Deploy

**Railway:**
```bash
railway up
```

**Manual:**
```bash
npm start
```

### 7.3 Run Migrations on Production

```bash
# SSH into production server or use Railway CLI
npx prisma migrate deploy
```

### 7.4 Verify Production Health

```bash
curl https://api.90plus.app/api/health
```

---

## STEP 8: Monitor Production

### Daily Monitoring

**1. Check Health Endpoint:**
```bash
curl https://api.90plus.app/api/health | jq
```

**2. Check Abuse Statistics:**
```bash
curl https://api.90plus.app/api/health | jq '.security'
```

**3. Review Logs for Blocked Users:**
```bash
# In your logging system (Railway logs, CloudWatch, etc.)
grep "User blocked for abuse" logs.txt
```

### Weekly Monitoring

**1. Verify Audit Chain Integrity:**

Create an admin endpoint:

```typescript
// Backend/src/routes/admin.routes.ts
router.get('/audit/verify',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const result = await TamperProofAuditService.verifyChainIntegrity(1000);
    res.json(result);
  }
);
```

**2. Review High-Severity Logs:**

```typescript
router.get('/audit/high-severity',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const logs = await TamperProofAuditService.getHighSeverityLogs({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      limit: 100,
    });
    res.json(logs);
  }
);
```

---

## STEP 9: Optional Enhancements

### 9.1 Add Forced Logout Endpoint

```typescript
// Backend/src/routes/auth.routes.ts
router.post('/logout/all',
  requireAuth,
  async (req, res) => {
    try {
      await TokenRevocationService.revokeAllUserTokens({
        userId: req.auth.userId,
        reason: 'User requested logout from all devices',
      });

      res.json({
        status: 'SUCCESS',
        message: 'Logged out from all devices',
      });
    } catch (error) {
      logger.error('Error revoking all tokens:', error);
      res.status(500).json({
        status: 'ERROR',
        message: 'Failed to logout from all devices',
      });
    }
  }
);
```

### 9.2 Add Admin Abuse Statistics Endpoint

```typescript
// Backend/src/routes/admin.routes.ts
router.get('/abuse/stats',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const stats = AbuseDetectionService.getStats();
    res.json(stats);
  }
);
```

### 9.3 Add Slow Query Logging

```typescript
// Backend/src/lib/prisma.ts
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  const duration = after - before;
  
  if (duration > 1000) { // 1 second threshold
    logger.warn('Slow query detected', {
      model: params.model,
      action: params.action,
      duration: `${duration}ms`,
      args: params.args,
    });
  }
  
  return result;
});
```

---

## TROUBLESHOOTING

### Issue: Migrations Fail

**Error:** `Migration failed to apply`

**Solution:**
```bash
# Reset database (DEVELOPMENT ONLY)
npx prisma migrate reset

# Or manually apply migrations
npx prisma db push
```

### Issue: Token Revocation Not Working

**Symptom:** Revoked tokens still work

**Check:**
1. Verify token revocation service is initialized in `main.ts`
2. Check console logs for "Enterprise Immunity services started"
3. Verify `TokenRevocationService.isTokenRevoked()` is called in `requireAuth`

**Debug:**
```typescript
// Add logging in clerk.middleware.ts
console.log('Checking token revocation:', token.substring(0, 20) + '...');
const isRevoked = TokenRevocationService.isTokenRevoked(token);
console.log('Token revoked:', isRevoked);
```

### Issue: Abuse Detection Too Aggressive

**Symptom:** Legitimate users getting blocked

**Solution:** Adjust thresholds in `abuse-detection.service.ts`:

```typescript
const THRESHOLDS = {
  MAX_REQUESTS_PER_MINUTE_USER: 200,  // Increase from 120
  MAX_REQUESTS_PER_MINUTE_IP: 500,    // Increase from 300
  MAX_FAILED_AUTH_PER_MINUTE: 15,     // Increase from 10
  MAX_DELETES_PER_MINUTE: 30,         // Increase from 20
  BLOCK_DURATION_MS: 10 * 60 * 1000,  // Reduce from 15 min to 10 min
};
```

### Issue: Memory Usage High

**Symptom:** Memory usage increasing over time

**Check:**
1. Verify cleanup intervals are running
2. Check abuse detection stats: `AbuseDetectionService.getStats()`
3. Check revoked token stats: `TokenRevocationService.getStats()`

**Solution:**
```typescript
// Reduce cleanup interval (more frequent cleanup)
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes instead of 5
```

---

## SUCCESS CRITERIA

✅ **Deployment Successful If:**

1. Health endpoint returns security metrics
2. Revoked tokens are blocked immediately
3. Abuse detection blocks flooding attacks
4. Audit chain integrity verification passes
5. No TypeScript compilation errors
6. No runtime errors in logs
7. Memory usage stable over 24 hours

---

## ROLLBACK PLAN

If issues occur in production:

### Quick Rollback

**1. Disable Enterprise Immunity Services:**

```typescript
// In Backend/src/main.ts
// Comment out these lines:
// await TokenRevocationService.loadFromDatabase();
// TokenRevocationService.startCleanup();
// AbuseDetectionService.startCleanup();
```

**2. Redeploy:**
```bash
npm run build
npm start
```

### Full Rollback

**1. Revert Code Changes:**
```bash
git revert <commit-hash>
git push
```

**2. Rollback Migrations (if needed):**
```bash
# This will lose audit log data!
npx prisma migrate resolve --rolled-back 20260220000001_add_tamper_proof_audit
npx prisma migrate resolve --rolled-back 20260220000002_add_revoked_tokens
```

---

## SUPPORT

For issues or questions:
1. Check `ENTERPRISE_IMMUNITY_COMPLETE.md` for detailed documentation
2. Review console logs for error messages
3. Check health endpoint for system status
4. Review audit logs for security events

**Emergency Contact:** [Your team's contact info]

---

**Last Updated:** 2026-02-20  
**Version:** 1.0.0  
**Status:** Production Ready
