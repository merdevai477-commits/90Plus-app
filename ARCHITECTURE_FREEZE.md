# 🧱 ARCHITECTURE FREEZE: Complete System Map

**Purpose:** Eliminate hidden assumptions. If you can't draw it, it's too complex.

**Last Updated:** 2026-02-20  
**Status:** FROZEN - Any changes require architecture review

---

## SYSTEM OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                               │
│                    (React Native App)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS + JWT
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      MIDDLEWARE CHAIN                        │
│  1. Trust Proxy                                              │
│  2. Helmet (Security Headers)                                │
│  3. CORS                                                     │
│  4. Body Parser (10MB limit)                                 │
│  5. Compression                                              │
│  6. Morgan (Logging)                                         │
│  7. Performance Monitoring                                   │
│  8. Metrics Tracking                                         │
│  9. App Version Check                                        │
│ 10. Rate Limiting (per route)                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                         ROUTES                               │
│  ├─ /api/users          (User management)                    │
│  ├─ /api/clerk          (Clerk integration)                  │
│  ├─ /api/webhooks/clerk (Clerk webhooks)                     │
│  ├─ /api/profile        (User profiles)                      │
│  ├─ /api/videos         (Video management)                   │
│  ├─ /api/analytics      (Video analytics)                    │
│  ├─ /api/reels          (Reels feed & interactions)          │
│  ├─ /api/upload         (File uploads to R2)                 │
│  ├─ /api/notifications  (Push notifications)                 │
│  ├─ /api/matches        (Match tracking)                     │
│  ├─ /api/daily-spin     (Daily rewards)                      │
│  ├─ /api/football       (Football API integration)           │
│  ├─ /api/predictions    (Match predictions)                  │
│  ├─ /api/coins          (Coin transactions)                  │
│  ├─ /api/quiz           (Daily quiz)                         │
│  ├─ /api/admin          (Admin operations)                   │
│  ├─ /api/app            (App version control)                │
│  ├─ /api/terms          (Terms of service)                   │
│  ├─ /api/reports        (Content reporting)                  │
│  ├─ /support            (Support page)                       │
│  └─ /privacy            (Privacy policy)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    ROUTE MIDDLEWARE                          │
│  ├─ requireAuth         (JWT verification)                   │
│  ├─ optionalAuth        (Optional JWT)                       │
│  ├─ requireRole         (RBAC enforcement)                   │
│  ├─ requireAdmin        (Admin-only)                         │
│  ├─ requireModerator    (Moderator+)                         │
│  ├─ verifyOwnership     (Resource ownership)                 │
│  ├─ validate            (Input validation)                   │
│  ├─ rateLimiter         (Rate limiting)                      │
│  └─ preventPrototypePollution (Security)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      CONTROLLERS                             │
│  ├─ UserController                                           │
│  ├─ VideoController                                          │
│  ├─ ProfileController                                        │
│  ├─ AnalyticsController                                      │
│  ├─ FootballController                                       │
│  └─ StorageController                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                       SERVICES                               │
│  ├─ AuditService              (Basic audit logging)          │
│  ├─ TamperProofAuditService   (Blockchain-style audit)       │
│  ├─ TokenRevocationService    (Token blacklist)              │
│  ├─ AbuseDetectionService     (Abuse prevention)             │
│  ├─ WebSocketService          (Real-time updates)            │
│  ├─ MatchWatcherService       (Match monitoring)             │
│  ├─ PredictionWatcherService  (Prediction tracking)          │
│  ├─ LeagueMatchWatcherService (League monitoring)            │
│  ├─ BackgroundPreloadService  (Cache warming)                │
│  ├─ TransfersSyncService      (Transfer data sync)           │
│  └─ AccountDeletionService    (Account cleanup)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│  ├─ Prisma ORM                                               │
│  ├─ PostgreSQL (Neon)                                        │
│  ├─ R2 Storage (Cloudflare)                                  │
│  └─ Redis (Optional - for scale)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ROUTE INVENTORY

### Authentication Required Routes (Protected)

| Route | Method | Auth | Role | Ownership | Validation | Rate Limit |
|-------|--------|------|------|-----------|------------|------------|
| `/api/users/settings` | GET | ✅ | - | - | - | General |
| `/api/users/settings` | PATCH | ✅ | - | - | - | General |
| `/api/users/me` | DELETE | ✅ | - | ✅ | - | Strict |
| `/api/users/block/:userId` | POST | ✅ | - | - | ✅ | General |
| `/api/users/block/:userId` | DELETE | ✅ | - | - | - | General |
| `/api/users/blocked` | GET | ✅ | - | - | - | General |
| `/api/users/block/:userId/status` | GET | ✅ | - | - | - | General |
| `/api/users/report/:userId` | POST | ✅ | - | - | ✅ | General |
| `/api/videos` | GET | ✅ | - | - | - | General |
| `/api/videos/delete-status` | GET | ✅ | - | - | - | General |
| `/api/videos` | POST | ✅ | - | - | ✅ | General |
| `/api/videos/:id` | DELETE | ✅ | - | ✅ | - | General |
| `/api/upload/avatar` | POST | ✅ | - | - | - | General |
| `/api/upload/cover` | POST | ✅ | - | - | - | General |
| `/api/upload/reel` | POST | ✅ | - | - | - | General |
| `/api/reels/feed` | GET | ✅ | - | - | - | Lenient |
| `/api/reels/hashtag/:tag` | GET | ✅ | - | - | - | General |
| `/api/reels` | POST | ✅ | - | - | - | General |
| `/api/reels/:id/view` | POST | ✅ | - | - | - | General |
| `/api/reels/:id/like` | POST | ✅ | - | - | - | Write |
| `/api/reels/:id/like` | DELETE | ✅ | - | - | - | General |
| `/api/reels/:id/comments` | GET | ✅ | - | - | - | General |
| `/api/reels/:id/comments` | POST | ✅ | - | - | - | Write |
| `/api/reels/comments/:commentId/replies` | GET | ✅ | - | - | - | General |
| `/api/reels/search/users` | GET | ✅ | - | - | - | General |
| `/api/reels/search` | GET | ✅ | - | - | - | Lenient |
| `/api/reels/comments/:commentId/like` | POST | ✅ | - | - | - | General |
| `/api/reels/comments/:commentId/like` | DELETE | ✅ | - | - | - | General |
| `/api/reels/comments/:commentId` | DELETE | ✅ | - | ✅ | - | Strict |
| `/api/reels/comments/:commentId/report` | POST | ✅ | - | - | - | Strict |
| `/api/reels/:id/save` | POST | ✅ | - | - | - | General |
| `/api/reels/:id/save` | DELETE | ✅ | - | - | - | General |
| `/api/reels/saved` | GET | ✅ | - | - | - | General |
| `/api/reels/:id/share` | POST | ✅ | - | - | - | General |
| `/api/profile/:username` | GET | ✅ | - | - | - | General |
| `/api/notifications` | GET | ✅ | - | - | - | Lenient |
| `/api/notifications/:id` | DELETE | ✅ | - | ✅ | - | General |
| `/api/notifications/:id/read` | PUT | ✅ | - | ✅ | - | General |
| `/api/notifications/read-all` | PUT | ✅ | - | - | - | General |
| `/api/terms/accept` | POST | ✅ | - | - | - | General |
| `/api/terms/user-acceptance` | GET | ✅ | - | - | - | General |
| `/api/reports/reel/:reelId` | POST | ✅ | - | - | - | General |
| `/api/reports/comment/:commentId` | POST | ✅ | - | - | - | General |
| `/api/analytics/video/:id` | GET | ✅ | - | - | - | General |

**Total Protected Routes:** 45+

### Public Routes (No Authentication)

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | API info |
| `/api` | GET | API endpoints |
| `/api/health` | GET | Health check |
| `/api/metrics` | GET | Metrics |
| `/api/webhooks/clerk` | POST | Clerk webhook |
| `/api/webhooks/clerk/health` | GET | Webhook health |
| `/api/videos/user/:username` | GET | Public videos |
| `/api/videos/:id/view` | POST | Record view |
| `/api/reels/trending-hashtags` | GET | Trending hashtags |
| `/api/terms/latest` | GET | Latest terms |
| `/support` | GET | Support page |
| `/privacy` | GET | Privacy policy |
| `/terms` | GET | Terms page |
| `/api/football/*` | GET | Football data (various) |

**Total Public Routes:** 14+

---

## MIDDLEWARE CHAIN DETAILS

### Global Middleware (Applied to ALL requests)

```typescript
1. app.set('trust proxy', true)              // Trust reverse proxy
2. helmet()                                   // Security headers
3. cors()                                     // CORS policy
4. express.json({ limit: '10mb' })           // Body parser + size limit
5. express.urlencoded({ limit: '10mb' })     // URL encoded parser
6. compression()                              // Response compression
7. morgan()                                   // HTTP logging
8. performanceMiddleware()                    // Performance tracking
9. metricsMiddleware                          // Metrics collection
10. checkAppVersion                           // App version validation
```

### Route-Specific Middleware

```typescript
// Authentication
requireAuth                    // JWT verification + token revocation check + abuse detection
optionalAuth                   // Optional JWT verification

// Authorization (RBAC)
requireRole(...roles)          // Role verification
requireAdmin                   // Admin-only access
requireModerator               // Moderator or Admin access

// Ownership Verification (IDOR Prevention)
verifyReelOwnership           // Reel ownership check
verifyCommentOwnership        // Comment ownership check
verifyVideoOwnership          // Video ownership check
verifyNotificationOwnership   // Notification ownership check
verifyPredictionOwnership     // Prediction ownership check
verifyFileOwnership           // File ownership check

// Input Validation & Sanitization
validate(schema)              // Zod-based validation + sanitization
preventPrototypePollution     // Prototype pollution protection
rejectUnknownFields(allowed)  // Whitelist-only fields

// Rate Limiting
generalLimiter                // 100 req/15min
lenientLimiter                // 200 req/15min (high-frequency endpoints)
strictLimiter                 // 50 req/15min (sensitive operations)
writeLimiter                  // 100 req/15min (write operations)
webhookLimiter                // 1000 req/15min (webhooks)
accountDeletionRateLimiter    // 1 req/day (account deletion)
```

---

## DATABASE MODELS

### Core Models

```prisma
User                    // User accounts
UserSettings            // User preferences
Block                   // User blocking
Report                  // Content reports
Strike                  // Moderation strikes
```

### Content Models

```prisma
Reel                    // Video content
ReelView                // View tracking
ReelLike                // Like tracking
SavedReel               // Saved reels
ReelShare               // Share tracking
Comment                 // Comments & replies
CommentLike             // Comment likes
CommentMention          // @mentions in comments
Hashtag                 // Hashtag tracking
```

### Gamification Models

```prisma
Coin                    // Coin transactions
DailySpin               // Daily spin rewards
Prediction              // Match predictions
Quiz                    // Quiz questions
UserQuizAnswer          // Quiz answers
UserQuizState           // Quiz state tracking
```

### Football Models

```prisma
FavoriteMatch           // Favorite matches
CachedPlayer            // Player data cache
CachedTransfer          // Transfer data cache
```

### System Models

```prisma
Notification            // Push notifications
AuditLog                // Audit trail (tamper-proof)
RevokedToken            // Token blacklist
AppVersion              // App version control
TermsOfService          // Terms versions
UserTermsAcceptance     // Terms acceptance tracking
```

**Total Models:** 25+

---

## SECURITY FLOW

### Request Flow with Security Checks

```
1. Request arrives
   ↓
2. Trust Proxy (identify real IP)
   ↓
3. Helmet (security headers)
   ↓
4. CORS (origin validation)
   ↓
5. Body Parser (size limit: 10MB)
   ↓
6. Rate Limiter (per route)
   ├─ Check IP rate limit
   └─ Check user rate limit (if authenticated)
   ↓
7. App Version Check
   ├─ Validate app version
   └─ Force update if needed
   ↓
8. requireAuth (if protected route)
   ├─ Extract JWT from Authorization header
   ├─ Check if token is revoked (TokenRevocationService)
   ├─ Verify JWT signature (Clerk SDK)
   ├─ Check if user is blocked (AbuseDetectionService)
   ├─ Check if IP is blocked (AbuseDetectionService)
   ├─ Track request (AbuseDetectionService)
   └─ Attach user info to req.auth
   ↓
9. requireRole (if role-based route)
   ├─ Check user role from database
   └─ Verify role matches required role
   ↓
10. verifyOwnership (if resource route)
    ├─ Fetch resource from database
    ├─ Compare resource.userId with req.auth.userId
    └─ Reject if mismatch (403 Forbidden)
    ↓
11. validate (if validation required)
    ├─ Validate input against schema
    ├─ Sanitize strings (remove XSS)
    ├─ Reject unknown fields
    └─ Reject if validation fails (400 Bad Request)
    ↓
12. preventPrototypePollution
    ├─ Check for __proto__, constructor, prototype
    └─ Reject if found (400 Bad Request)
    ↓
13. Controller Logic
    ├─ Business logic execution
    ├─ Database operations
    └─ Response generation
    ↓
14. Audit Logging (async, non-blocking)
    ├─ Log sensitive operations (DELETE, role changes)
    ├─ Create tamper-proof audit log
    └─ Track failed authorization attempts
    ↓
15. Response
    ├─ Sanitize error messages (production)
    └─ Return JSON response
```

---

## SERVICE DEPENDENCIES

### Service Initialization Order

```
1. Database Connection (Prisma)
   ↓
2. Keep-Alive Service (Neon connection)
   ↓
3. Token Revocation Service
   ├─ Load revoked tokens from database
   └─ Start cleanup interval
   ↓
4. Abuse Detection Service
   └─ Start cleanup interval
   ↓
5. WebSocket Service
   └─ Initialize WebSocket server
   ↓
6. Match Watcher Service (if FOOTBALL_API_KEY set)
   └─ Start match monitoring
   ↓
7. Prediction Watcher Service
   └─ Start prediction tracking
   ↓
8. League Match Watcher Service
   └─ Start league monitoring
   ↓
9. Background Preload Service
   └─ Start cache warming
   ↓
10. Transfers Sync Service (optional)
    └─ Start transfer data sync
```

### Service Shutdown Order

```
1. WebSocket Service
   └─ Close all connections
   ↓
2. Match Watcher Service
   └─ Stop monitoring
   ↓
3. Prediction Watcher Service
   └─ Stop tracking
   ↓
4. League Match Watcher Service
   └─ Stop monitoring
   ↓
5. Background Preload Service
   └─ Stop cache warming
   ↓
6. Transfers Sync Service
   └─ Stop sync
   ↓
7. Keep-Alive Service
   └─ Stop ping
   ↓
8. Database Connection
   └─ Disconnect Prisma
```

---

## EXTERNAL DEPENDENCIES

### Required Services

```
1. Clerk (Authentication)
   - JWT verification
   - User management
   - Webhooks

2. Neon (PostgreSQL)
   - Primary database
   - Connection pooling

3. Cloudflare R2 (Storage)
   - Avatar images
   - Cover images
   - Reel videos
   - Thumbnails

4. API-Football (Football Data)
   - Live scores
   - Match fixtures
   - Player data
   - Transfer data
```

### Optional Services

```
1. Redis (Caching)
   - Token revocation (scale)
   - Abuse detection (distributed)
   - Rate limiting (distributed)

2. Sentry (Error Tracking)
   - Error monitoring
   - Performance tracking

3. New Relic / Datadog (APM)
   - Application monitoring
   - Performance metrics
```

---

## TIMEOUT POLICY

### Database Queries

```typescript
// Health check: 30 seconds
await Promise.race([
  prisma.$queryRawUnsafe('SELECT 1'),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Database connection timeout')), 30000)
  )
]);

// Regular queries: Use Prisma default (no explicit timeout)
// Recommendation: Add query timeout middleware
```

### External Requests

```typescript
// Football API: 10 seconds (fetchWithTimeout)
const response = await fetchWithTimeout(url, { timeout: 10000 });

// Clerk API: 5 seconds (default)
// Recommendation: Add explicit timeout
```

### Upload Operations

```typescript
// Upload routes: 15 minutes
req.setTimeout(15 * 60 * 1000, () => {
  if (!res.headersSent) {
    res.status(408).json({
      status: 'ERROR',
      message: 'Upload timeout - request took too long',
    });
  }
});
```

### Background Jobs

```typescript
// Match Watcher: 5 minutes interval
// Prediction Watcher: 5 minutes interval (cron)
// League Match Watcher: 10 minutes interval
// Background Preload: 30 minutes interval
// Transfers Sync: 1 hour interval
```

---

## MEMORY LEAK PREVENTION

### Timers & Intervals

```typescript
// ✅ All intervals stored and cleared on shutdown
const matchWatcherInterval = setInterval(...);
const predictionWatcherInterval = setInterval(...);
const cacheCleanupInterval = setInterval(...);

process.on('SIGTERM', () => {
  clearInterval(matchWatcherInterval);
  clearInterval(predictionWatcherInterval);
  clearInterval(cacheCleanupInterval);
});
```

### WebSocket Listeners

```typescript
// ✅ Destruction tracking prevents reuse after destroy
private destroyed = false;

public destroy() {
  if (this.destroyed) return;
  this.destroyed = true;
  // Cleanup...
}
```

### Event Emitters

```typescript
// ✅ Remove listeners on cleanup
emitter.removeAllListeners();
```

### Stream Handlers

```typescript
// ✅ Upload cancellation on timeout
req.on('timeout', () => {
  req.destroy();
  // Cleanup uploaded files
});
```

---

## DETERMINISTIC BEHAVIOR

### Error Response Format

```typescript
// All errors follow same structure
{
  "status": "ERROR",
  "message": "Human-readable message",
  "code": "ERROR_CODE" // Optional
}
```

### HTTP Status Codes

```
200 - Success
400 - Bad Request (validation, malformed input)
401 - Unauthorized (no token, invalid token, revoked token)
403 - Forbidden (no permission, ownership violation)
404 - Not Found (resource doesn't exist)
408 - Request Timeout (upload timeout)
429 - Too Many Requests (rate limit, abuse detection)
500 - Internal Server Error (unexpected errors)
```

### Timing Attack Prevention

```typescript
// ✅ Same response time for valid/invalid IDs
// Use constant-time comparison where possible
// Don't leak existence through timing differences
```

---

## OBSERVABILITY BASELINE

### Performance Metrics (Target)

```
Average Response Time: <100ms
P95 Latency: <500ms
P99 Latency: <1000ms
Memory Baseline: <200MB (idle)
CPU Baseline: <10% (idle)
DB Query Avg: <50ms
```

### Health Endpoint Metrics

```json
{
  "status": "OK",
  "uptime": { "seconds": 86400, "formatted": "24h 0m 0s" },
  "memory": {
    "heapUsed": "150MB",
    "heapTotal": "200MB",
    "rss": "250MB"
  },
  "security": {
    "revokedTokens": 5,
    "trackedUsers": 150,
    "blockedUsers": 0
  }
}
```

---

## ARCHITECTURE RULES

### Rule 1: No Hidden Logic
- Every route must be documented in this file
- Every middleware must be listed
- Every service must be mapped
- If it's not in this document, it doesn't exist

### Rule 2: Explicit Dependencies
- All service dependencies must be declared
- Initialization order must be documented
- Shutdown order must be documented

### Rule 3: Timeout Everything
- Database queries: 30s max
- External requests: 10s max
- Uploads: 15min max
- Background jobs: Explicit intervals

### Rule 4: Clean Up Everything
- All timers must be cleared
- All listeners must be removed
- All connections must be closed
- All resources must be freed

### Rule 5: Deterministic Responses
- Same error format everywhere
- Same status codes for same errors
- No timing differences
- No information leakage

---

## CHANGE CONTROL

### Architecture Changes Require:

1. Update this document
2. Update route coverage script
3. Update tests
4. Security review
5. Performance impact assessment

### Approval Required For:

- New routes
- New middleware
- New services
- New external dependencies
- Timeout changes
- Security policy changes

---

**Document Status:** FROZEN  
**Last Review:** 2026-02-20  
**Next Review:** 2026-03-20 (30 days)  
**Owner:** Engineering Team
