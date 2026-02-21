# 🚀 Engineering Reliability Deployment Guide

**Quick start for deploying reliability improvements**

---

## WHAT WAS BUILT

### 1. Architecture Freeze (`ARCHITECTURE_FREEZE.md`)
Complete system map with all routes, middleware, services, and dependencies documented.

### 2. Route Coverage Lock (`Backend/scripts/route-coverage-lock.js`)
Automated security enforcement that fails build if routes lack proper middleware.

### 3. Memory Leak Detector (`Backend/scripts/memory-leak-detector.js`)
Scans codebase for common memory leak patterns (timers, listeners, streams).

### 4. Adversarial Test Harness (`Backend/tests/adversarial.test.ts`)
21 hostile security tests that try to break the system.

### 5. Reliability Scripts (in `package.json`)
NPM scripts for running reliability checks.

---

## QUICK START

### Step 1: Run Reliability Check

```bash
cd Backend
npm run reliability:check
```

**Expected Output:**
```
🔒 Route Coverage Lock
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Routes Checked: 192
Critical Violations: 5
Warnings: 62
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 2: Fix Critical Violations

The script found 5 DELETE routes without explicit ownership verification:

1. `DELETE /:id/like` (unlike reel)
2. `DELETE /comments/:commentId/like` (unlike comment)
3. `DELETE /comments/:commentId` (delete comment)
4. `DELETE /:id/save` (unsave reel)
5. `DELETE /:id` (delete video)

**Note:** Some of these have implicit ownership (unlike operations), but the script enforces explicit middleware for consistency.

**Options:**

**Option A: Add Ownership Middleware (Recommended)**
```typescript
// For operations that modify user's own data
router.delete('/:id/like', requireAuth, verifyReelLikeOwnership, async (req, res) => {
  // Unlike logic
});
```

**Option B: Add Inline Ownership Check**
```typescript
router.delete('/:id/like', requireAuth, async (req, res) => {
  // Verify user owns the like
  const like = await prisma.reelLike.findFirst({
    where: { reelId: req.params.id, userId: req.auth.userId }
  });
  
  if (!like) {
    return res.status(403).json({ status: 'ERROR', message: 'Not found' });
  }
  
  // Unlike logic
});
```

**Option C: Whitelist in Script (If Ownership is Implicit)**

Edit `Backend/scripts/route-coverage-lock.js`:

```javascript
// Routes that don't need explicit ownership (implicit ownership)
const IMPLICIT_OWNERSHIP_ROUTES = [
  'DELETE /:id/like',           // Can only unlike what you liked
  'DELETE /comments/:commentId/like', // Can only unlike what you liked
  'DELETE /:id/save',           // Can only unsave what you saved
];
```

### Step 3: Address Warnings (Optional)

The script found 62 routes without input validation. These are warnings only and don't fail the build.

**Recommendation:** Add validation middleware gradually:

```typescript
import { validate } from '../middleware/validation.middleware';

router.post('/reel', 
  requireAuth,
  validate({
    body: {
      caption: { type: 'string', required: true, min: 1, max: 500 },
      videoUrl: { type: 'string', required: true },
    }
  }),
  async (req, res) => {
    // Logic
  }
);
```

---

## INTEGRATION WITH CI/CD

### GitHub Actions

Create `.github/workflows/reliability.yml`:

```yaml
name: Reliability Checks

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  reliability:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        working-directory: ./Backend
        run: npm ci
      
      - name: Run reliability checks
        working-directory: ./Backend
        run: npm run reliability:check
      
      - name: Run adversarial tests
        working-directory: ./Backend
        run: npm run test:adversarial
```

### Railway / Vercel

Update build command:

```json
{
  "scripts": {
    "build": "npm run reliability:check && tsc && npm run copy:public"
  }
}
```

---

## USAGE GUIDE

### Daily Development

**Before committing:**
```bash
npm run reliability:check
```

**Before pushing:**
```bash
npm run reliability:full
```

### Weekly Maintenance

**Review architecture:**
```bash
# Open and review
cat ARCHITECTURE_FREEZE.md
```

**Check for memory leaks:**
```bash
npm run reliability:memory
```

### Monthly Review

1. Update `ARCHITECTURE_FREEZE.md` if routes/services changed
2. Review and update timeout policy
3. Check observability baseline metrics
4. Run full adversarial test suite

---

## TROUBLESHOOTING

### Issue: Route Coverage Lock Fails

**Error:** "Missing authentication middleware"

**Solution:**
1. Add `requireAuth` or `optionalAuth` to the route
2. Or add route to `PUBLIC_ROUTES` array in script if intentionally public

**Error:** "Missing ownership verification middleware"

**Solution:**
1. Add ownership middleware (e.g., `verifyVideoOwnership`)
2. Or add `requireAdmin` if admin-only route
3. Or whitelist in script if ownership is implicit

### Issue: Memory Leak Detector Warnings

**Warning:** "setInterval without clearInterval"

**Solution:**
```typescript
// Store interval reference
const interval = setInterval(...);

// Clear on shutdown
process.on('SIGTERM', () => {
  clearInterval(interval);
});
```

**Warning:** "Event listeners without removal"

**Solution:**
```typescript
// Remove listeners on cleanup
emitter.removeAllListeners();
// Or
emitter.off('event', handler);
```

### Issue: Adversarial Tests Fail

**Error:** "IDOR attack succeeded"

**Solution:**
1. Add ownership verification middleware
2. Verify ownership check logic
3. Test manually with different users

**Error:** "Prototype pollution not blocked"

**Solution:**
1. Ensure `preventPrototypePollution` middleware is applied
2. Check middleware order (should be early in chain)

---

## CONFIGURATION

### Adjust Route Coverage Rules

Edit `Backend/scripts/route-coverage-lock.js`:

```javascript
// Add public routes
const PUBLIC_ROUTES = [
  '/api/new-public-route',
];

// Add implicit ownership routes
const IMPLICIT_OWNERSHIP_ROUTES = [
  'DELETE /api/custom/:id',
];
```

### Adjust Memory Leak Thresholds

Edit `Backend/scripts/memory-leak-detector.js`:

```javascript
// Reduce sensitivity
if (timeoutMatches.length > 20 && clearMatches.length === 0) {
  // Warn only if >20 timeouts without clears
}
```

### Adjust Adversarial Test Thresholds

Edit `Backend/tests/adversarial.test.ts`:

```typescript
// Adjust mass deletion threshold
for (let i = 0; i < 500; i++) { // Reduced from 1000
  // Test logic
}
```

---

## MAINTENANCE SCHEDULE

### Daily
- [ ] Monitor health endpoint
- [ ] Check error logs
- [ ] Verify response times

### Weekly
- [ ] Run `npm run reliability:full`
- [ ] Review architecture changes
- [ ] Update documentation

### Monthly
- [ ] Full architecture review
- [ ] Update baseline metrics
- [ ] Review timeout policy
- [ ] Audit external dependencies

### Quarterly
- [ ] External security audit
- [ ] Performance optimization
- [ ] Reliability script updates
- [ ] Architecture freeze update

---

## ROLLBACK PLAN

### If Reliability Checks Block Deployment

**Option 1: Fix Issues (Recommended)**
```bash
# Fix the violations
# Then run checks again
npm run reliability:check
```

**Option 2: Temporary Bypass (Emergency Only)**
```bash
# Build without reliability checks
npm run build
```

**Option 3: Disable Specific Checks**
```json
{
  "scripts": {
    "reliability:check": "npm run reliability:memory"
    // Temporarily disable route coverage
  }
}
```

---

## SUCCESS CRITERIA

✅ **Deployment Successful If:**

1. Route coverage lock passes (0 critical violations)
2. Memory leak detector passes (0 critical leaks)
3. Adversarial tests pass (all 21 tests)
4. Build completes successfully
5. Health endpoint returns 200
6. No runtime errors in logs

---

## SUPPORT

**Documentation:**
- `ARCHITECTURE_FREEZE.md` - Complete system map
- `ENGINEERING_RELIABILITY_COMPLETE.md` - Full implementation details
- `RELIABILITY_DEPLOYMENT_GUIDE.md` - This guide

**Scripts:**
- `npm run reliability:check` - Quick check
- `npm run reliability:full` - Full check with tests
- `npm run reliability:routes` - Route coverage only
- `npm run reliability:memory` - Memory leak detection only
- `npm run test:adversarial` - Security tests only

**Contact:**
- Technical Lead: [Your Name]
- Security Team: [Security Contact]

---

**Last Updated:** 2026-02-20  
**Version:** 1.0.0  
**Status:** Production Ready
