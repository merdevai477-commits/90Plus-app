# 🔒 ZERO TRUST IMPLEMENTATION GUIDE

## Quick Start: Apply Critical Fixes

### Step 1: Apply Ownership Verification (CRITICAL)

Add to routes that modify user resources:

```typescript
import { verifyOwnership } from '../middleware/zero-trust.middleware';

// Before (VULNERABLE):
router.delete('/:id', requireAuth, async (req, res) => {
  await prisma.reel.delete({ where: { id: req.params.id } });
});

// After (SECURE):
router.delete('/:id', 
  requireAuth, 
  verifyOwnership('reel'), // ← Add this
  async (req, res) => {
    await prisma.reel.delete({ where: { id: req.params.id } });
  }
);
```

**Apply to these routes:**
- `DELETE /api/reels/:id`
- `DELETE /api/comments/:commentId`
- `PATCH /api/users/settings`
- `DELETE /api/videos/:id`
- Any route that modifies user-owned resources

---

### Step 2: Apply Prototype Pollution Protection (CRITICAL)

Add to all routes that accept JSON bodies:

```typescript
import { preventPrototypePollution } from '../middleware/zero-trust.middleware';

// Apply globally in main.ts:
app.use(express.json({ limit: '10mb' }));
app.use(preventPrototypePollution); // ← Add after body parser
```

---

### Step 3: Apply Unknown Field Rejection (HIGH)

Add to POST/PATCH routes:

```typescript
import { rejectUnknownFields } from '../middleware/zero-trust.middleware';

router.post('/reels', 
  requireAuth,
  rejectUnknownFields(['caption', 'hashtags', 'mentions']), // ← Whitelist
  async (req, res) => {
    // Only allowed fields will reach here
  }
);
```

---

### Step 4: Apply Validation to All Input Routes (HIGH)

```typescript
import { validate } from '../middleware/validation.middleware';

router.post('/reels/:id/comments',
  requireAuth,
  validate({
    body: {
      content: { type: 'string', required: true, min: 1, max: 500 },
      parentId: { type: 'string', required: false },
    }
  }),
  async (req, res) => {
    // Input is validated and sanitized
  }
);
```

---

### Step 5: Apply User-Based Rate Limiting (MEDIUM)

```typescript
import { userRateLimit } from '../middleware/zero-trust.middleware';

router.post('/reels',
  requireAuth,
  userRateLimit(10, 60000), // 10 requests per minute per user
  async (req, res) => {
    // Rate limited per user
  }
);
```

---

## Complete Example: Secure Route

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import { validate } from '../middleware/validation.middleware';
import { 
  verifyOwnership, 
  preventPrototypePollution,
  rejectUnknownFields,
  userRateLimit 
} from '../middleware/zero-trust.middleware';

const router = Router();

// ✅ ZERO TRUST COMPLIANT ROUTE
router.delete('/reels/:id',
  requireAuth,                    // 1. Verify authentication
  verifyOwnership('reel'),        // 2. Verify ownership
  userRateLimit(100, 60000),      // 3. Rate limit per user
  async (req, res) => {
    // 4. Business logic (safe - all checks passed)
    await prisma.reel.delete({ where: { id: req.params.id } });
    res.json({ status: 'SUCCESS' });
  }
);

router.post('/reels/:id/comments',
  requireAuth,                    // 1. Verify authentication
  preventPrototypePollution,      // 2. Block dangerous keys
  rejectUnknownFields(['content', 'parentId']), // 3. Whitelist fields
  validate({                      // 4. Validate and sanitize
    body: {
      content: { type: 'string', required: true, min: 1, max: 500 },
      parentId: { type: 'string', required: false },
    }
  }),
  userRateLimit(60, 60000),       // 5. Rate limit per user
  async (req, res) => {
    // 6. Business logic (safe - all checks passed)
    const comment = await prisma.comment.create({
      data: {
        content: req.body.content,
        reelId: req.params.id,
        userId: req.userId, // From requireAuth
        parentId: req.body.parentId,
      }
    });
    res.json({ status: 'SUCCESS', data: comment });
  }
);

export default router;
```

---

## Checklist: Route Security

For each route, verify:

- [ ] `requireAuth` applied (if protected)
- [ ] `verifyOwnership` applied (if modifying resources)
- [ ] `preventPrototypePollution` applied (if accepting JSON)
- [ ] `rejectUnknownFields` applied (if POST/PATCH)
- [ ] `validate` applied (if accepting user input)
- [ ] `userRateLimit` applied (if write operation)
- [ ] Business logic validates ownership again (defense in depth)
- [ ] Error messages don't leak sensitive info
- [ ] No direct database queries without ownership check

---

## Testing Zero Trust Implementation

### Test 1: IDOR Protection

```bash
# As User A, try to delete User B's reel
curl -X DELETE http://localhost:3000/api/reels/user-b-reel-id \
  -H "Authorization: Bearer user-a-token"

# Expected: 403 Forbidden
# Actual: Should be blocked by verifyOwnership()
```

### Test 2: Prototype Pollution

```bash
curl -X POST http://localhost:3000/api/reels \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"__proto__": {"isAdmin": true}, "caption": "test"}'

# Expected: 400 Bad Request - Dangerous keys detected
```

### Test 3: Unknown Fields

```bash
curl -X POST http://localhost:3000/api/reels \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"caption": "test", "malicious": "field"}'

# Expected: 400 Bad Request - Unknown fields not allowed
```

### Test 4: XSS Sanitization

```bash
curl -X POST http://localhost:3000/api/reels/:id/comments \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"content": "<script>alert(1)</script>"}'

# Expected: 200 OK, but content sanitized (script tags removed)
```

---

## Deployment Checklist

Before deploying to production:

- [ ] All CRITICAL fixes applied
- [ ] All HIGH fixes applied
- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Remove unused dependencies
- [ ] Test IDOR protection
- [ ] Test prototype pollution protection
- [ ] Test input sanitization
- [ ] Test rate limiting
- [ ] Review error messages (no sensitive data)
- [ ] Enable production error sanitization
- [ ] Test graceful shutdown
- [ ] Monitor logs for suspicious activity

---

## Monitoring & Alerts

Set up alerts for:

- Multiple 403 Forbidden responses (IDOR attempts)
- 400 Bad Request with "Dangerous keys" (prototype pollution attempts)
- 429 Too Many Requests (rate limit exceeded)
- Multiple 401 Unauthorized (brute force attempts)
- Unusual patterns in ownership verification failures

---

## Next Steps

1. Apply critical fixes (ownership verification)
2. Test thoroughly in staging
3. Deploy to production
4. Monitor for 24 hours
5. Implement remaining HIGH priority fixes
6. Schedule next security audit

---

**Remember:** Zero Trust means verify everything, trust nothing. Every request is hostile until proven otherwise.

