# 🔧 إصلاح الـ Routes الناقصة - خطة العمل

## 📊 تحليل المشكلة

بعد فحص الكود، اكتشفت التالي:

### ✅ Routes موجودة لكن بأسماء مختلفة:

1. **Matches Routes** - الملف موجود لكن الـ endpoints مختلفة:
   - ❌ المطلوب: `/live`, `/today`, `/upcoming`
   - ✅ الموجود: `/favorite/:matchId`, `/favorites`, `/push-token`
   - **المشكلة:** الـ routes الموجودة للـ favorites فقط، مش للـ live matches

2. **Reels Routes** - الملف موجود والـ endpoints موجودة:
   - ✅ `/feed` موجود (لكن المطلوب `/` بدون feed)
   - ❌ `/trending` مش موجود
   - ❌ `/rankings` مش موجود

3. **Predictions Routes** - الملف موجود لكن endpoints ناقصة:
   - ❌ `/leaderboard` مش موجود
   - ✅ باقي الـ endpoints موجودة

4. **Football Routes** - الملف موجود والـ endpoints موجودة:
   - ✅ `/standings` موجود (لكن بدون `:leagueId` parameter)
   - ✅ باقي الـ endpoints موجودة

---

## 🎯 الحلول المطلوبة

### 1. إضافة Matches Live Endpoints

```typescript
// Backend/src/routes/matches.routes.ts
// إضافة في نهاية الملف قبل export default router

/**
 * GET /api/matches/live
 * Get live matches from Football API
 */
router.get('/live', async (req: Request, res: Response): Promise<void> => {
    try {
        const { FootballService } = await import('../services/football.service');
        const liveMatches = await FootballService.getLiveFixtures();
        
        res.json({
            status: 'SUCCESS',
            data: { matches: liveMatches }
        });
    } catch (error: any) {
        logger.error('Get live matches error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * GET /api/matches/today
 * Get today's matches
 */
router.get('/today', async (req: Request, res: Response): Promise<void> => {
    try {
        const { FootballService } = await import('../services/football.service');
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const todayMatches = await FootballService.getFixturesByDate(today);
        
        res.json({
            status: 'SUCCESS',
            data: { matches: todayMatches }
        });
    } catch (error: any) {
        logger.error('Get today matches error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * GET /api/matches/upcoming
 * Get upcoming matches (next 7 days)
 */
router.get('/upcoming', async (req: Request, res: Response): Promise<void> => {
    try {
        const { FootballService } = await import('../services/football.service');
        const today = new Date();
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const from = today.toISOString().split('T')[0];
        const to = nextWeek.toISOString().split('T')[0];
        
        const upcomingMatches = await FootballService.getFixturesByDateRange(from, to);
        
        res.json({
            status: 'SUCCESS',
            data: { matches: upcomingMatches }
        });
    } catch (error: any) {
        logger.error('Get upcoming matches error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});
```

---

### 2. إضافة Reels Endpoints الناقصة

```typescript
// Backend/src/routes/reels.routes.ts
// إضافة في نهاية الملف قبل export default router

/**
 * GET /api/reels
 * Get all reels (alias for /feed)
 */
router.get('/', requireAuth, lenientLimiter, async (req: Request, res: Response): Promise<void> => {
    // Forward to /feed endpoint
    req.url = '/feed';
    return router.handle(req, res, () => {});
});

/**
 * GET /api/reels/trending
 * Get trending reels (most viewed/liked in last 24 hours)
 */
router.get('/trending', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = '10' } = req.query;
        const take = Math.min(parseInt(limit as string) || 10, 20);
        
        // Get reels from last 24 hours, sorted by engagement
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const trendingReels = await prisma.reel.findMany({
            where: {
                isDeleted: false,
                createdAt: { gte: yesterday }
            },
            take,
            orderBy: [
                { views: 'desc' },
                { _count: { likes: 'desc' } }
            ],
            select: {
                id: true,
                videoUrl: true,
                thumbnail: true,
                caption: true,
                views: true,
                sharesCount: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        isVerified: true,
                    }
                },
                _count: {
                    select: {
                        likes: true,
                        comments: true,
                    }
                }
            }
        });
        
        res.json({
            status: 'SUCCESS',
            data: {
                reels: trendingReels.map(reel => ({
                    ...reel,
                    likesCount: reel._count.likes,
                    commentsCount: reel._count.comments,
                }))
            }
        });
    } catch (error: any) {
        logger.error('Get trending reels error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

/**
 * GET /api/reels/rankings
 * Get user rankings by reel engagement
 */
router.get('/rankings', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = '10' } = req.query;
        const take = Math.min(parseInt(limit as string) || 10, 50);
        
        // Get users with most total views/likes on their reels
        const rankings = await prisma.user.findMany({
            take,
            select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                isVerified: true,
                reels: {
                    where: { isDeleted: false },
                    select: {
                        views: true,
                        _count: {
                            select: { likes: true }
                        }
                    }
                }
            },
            orderBy: {
                reels: {
                    _count: 'desc'
                }
            }
        });
        
        // Calculate total engagement for each user
        const rankedUsers = rankings.map(user => {
            const totalViews = user.reels.reduce((sum, reel) => sum + reel.views, 0);
            const totalLikes = user.reels.reduce((sum, reel) => sum + reel._count.likes, 0);
            const reelsCount = user.reels.length;
            
            return {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                isVerified: user.isVerified,
                stats: {
                    totalViews,
                    totalLikes,
                    reelsCount,
                    engagement: totalViews + (totalLikes * 10) // Weight likes more
                }
            };
        }).sort((a, b) => b.stats.engagement - a.stats.engagement);
        
        res.json({
            status: 'SUCCESS',
            data: { rankings: rankedUsers }
        });
    } catch (error: any) {
        logger.error('Get reels rankings error:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});
```

---

### 3. إضافة Predictions Leaderboard

```typescript
// Backend/src/routes/predictions.routes.ts
// إضافة في نهاية الملف قبل export default router

/**
 * GET /api/predictions/leaderboard
 * Get top predictors leaderboard
 */
router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit = '10' } = req.query;
        const take = Math.min(parseInt(limit as string) || 10, 50);
        
        // Get users with best prediction accuracy
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true,
                isVerified: true,
                predictions: {
                    select: {
                        isCorrect: true,
                        coinsWon: true,
                    }
                }
            }
        });
        
        // Calculate stats for each user
        const leaderboard = users.map(user => {
            const total = user.predictions.length;
            const correct = user.predictions.filter(p => p.isCorrect === true).length;
            const incorrect = user.predictions.filter(p => p.isCorrect === false).length;
            const pending = user.predictions.filter(p => p.isCorrect === null).length;
            const totalCoinsWon = user.predictions
                .filter(p => p.isCorrect === true)
                .reduce((sum, p) => sum + (p.coinsWon || 0), 0);
            
            const resolved = correct + incorrect;
            const accuracy = resolved > 0 ? Math.round((correct / resolved) * 100) : 0;
            
            return {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                isVerified: user.isVerified,
                stats: {
                    total,
                    correct,
                    incorrect,
                    pending,
                    accuracy,
                    totalCoinsWon,
                    resolved
                }
            };
        })
        .filter(u => u.stats.resolved > 0) // Only users with resolved predictions
        .sort((a, b) => {
            // Sort by accuracy first, then by total correct
            if (b.stats.accuracy !== a.stats.accuracy) {
                return b.stats.accuracy - a.stats.accuracy;
            }
            return b.stats.correct - a.stats.correct;
        })
        .slice(0, take);
        
        res.json({
            success: true,
            data: { leaderboard }
        });
    } catch (error) {
        logger.error('Error getting predictions leaderboard:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

---

### 4. إصلاح Football Standings Route

الـ route موجود لكن بدون parameter. المشكلة في الاختبار - الـ endpoint يستخدم query parameter مش path parameter:

```typescript
// الموجود حالياً (صحيح):
router.get('/standings', FootballController.getStandings);
// يستخدم: /api/football/standings?league=39&season=2024

// المطلوب في الاختبار (خطأ):
// /api/football/standings/:leagueId

// الحل: إضافة route جديد يدعم الاثنين
router.get('/standings/:leagueId', async (req, res) => {
    // Forward to main standings endpoint with query params
    req.query.league = req.params.leagueId;
    return FootballController.getStandings(req, res);
});
```

---

### 5. إضافة User Search Endpoint

```typescript
// Backend/src/routes/user.routes.ts
// إضافة في نهاية الملف قبل export default router

/**
 * GET /api/users/:username
 * Get user by username
 */
router.get('/:username', async (req: Request, res: Response): Promise<void> => {
    try {
        const { username } = req.params;
        const usernameStr = Array.isArray(username) ? username[0] : username;
        
        const user = await prisma.user.findUnique({
            where: { username: usernameStr },
            select: {
                id: true,
                username: true,
                displayName: true,
                email: true,
                avatar: true,
                bio: true,
                isVerified: true,
                isDeveloper: true,
                coins: true,
                level: true,
                xp: true,
                createdAt: true,
                _count: {
                    select: {
                        reels: true,
                        followers: true,
                        following: true,
                    }
                }
            }
        });
        
        if (!user) {
            res.status(404).json({
                status: 'ERROR',
                message: 'User not found'
            });
            return;
        }
        
        res.json({
            status: 'SUCCESS',
            data: {
                user: {
                    ...user,
                    reelsCount: user._count.reels,
                    followersCount: user._count.followers,
                    followingCount: user._count.following,
                }
            }
        });
    } catch (error: any) {
        logger.error('Get user by username error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});
```

---

### 6. إضافة Clerk User Endpoint

```typescript
// Backend/src/routes/clerk-user.routes.ts
// إضافة في نهاية الملف قبل export default router

/**
 * GET /api/clerk/user
 * Get current authenticated user
 */
router.get('/user', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        
        if (!clerkUserId) {
            res.status(401).json({
                status: 'ERROR',
                message: 'Unauthorized'
            });
            return;
        }
        
        const user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: {
                id: true,
                clerkUserId: true,
                username: true,
                displayName: true,
                email: true,
                avatar: true,
                bio: true,
                isVerified: true,
                isDeveloper: true,
                coins: true,
                level: true,
                xp: true,
                createdAt: true,
            }
        });
        
        if (!user) {
            res.status(404).json({
                status: 'ERROR',
                message: 'User not found'
            });
            return;
        }
        
        res.json({
            status: 'SUCCESS',
            data: { user }
        });
    } catch (error: any) {
        logger.error('Get current user error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});
```

---

### 7. إضافة App Version Check Update Endpoint

```typescript
// Backend/src/routes/app-version.routes.ts
// إضافة في نهاية الملف قبل export default router

/**
 * GET /api/app/check-update
 * Check if app update is available
 */
router.get('/check-update', async (req: Request, res: Response): Promise<void> => {
    try {
        const { currentVersion, platform } = req.query;
        
        if (!currentVersion) {
            res.status(400).json({
                status: 'ERROR',
                message: 'currentVersion is required'
            });
            return;
        }
        
        // Get latest version from database
        const latestVersion = await prisma.appVersion.findFirst({
            where: {
                platform: platform as string || 'both',
                isActive: true
            },
            orderBy: { createdAt: 'desc' }
        });
        
        if (!latestVersion) {
            res.json({
                status: 'SUCCESS',
                data: {
                    updateAvailable: false,
                    currentVersion,
                    message: 'No updates available'
                }
            });
            return;
        }
        
        // Compare versions
        const updateAvailable = latestVersion.version !== currentVersion;
        
        res.json({
            status: 'SUCCESS',
            data: {
                updateAvailable,
                currentVersion,
                latestVersion: latestVersion.version,
                forceUpdate: latestVersion.forceUpdate || false,
                message: latestVersion.releaseNotes || 'Update available',
                downloadUrl: latestVersion.downloadUrl
            }
        });
    } catch (error: any) {
        logger.error('Check update error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});
```

---

### 8. إصلاح GDPR Routes (404 → 401)

```typescript
// Backend/src/routes/gdpr.routes.ts
// تأكد من تطبيق requireAuth middleware على كل الـ routes

import { requireAuth } from '../middleware/clerk.middleware';

// في بداية الملف بعد const router = Router();
router.use(requireAuth); // تطبيق على كل الـ routes

// أو تطبيقه على كل route لوحده:
router.get('/consent', requireAuth, getConsent);
router.post('/consent', requireAuth, updateConsent);
router.get('/deletion-status', requireAuth, getDeletionStatus);
// ... باقي الـ routes
```

---

### 9. جعل Quiz Categories Public

```typescript
// Backend/src/routes/quiz.routes.ts
// امسح requireAuth من categories endpoint

// قبل:
router.get('/categories', requireAuth, getCategories);

// بعد:
router.get('/categories', getCategories); // بدون requireAuth
```

---

## 📝 ملخص التغييرات المطلوبة

| الملف | التغيير | الأولوية |
|-------|---------|----------|
| `matches.routes.ts` | إضافة `/live`, `/today`, `/upcoming` | 🔴 عاجل |
| `reels.routes.ts` | إضافة `/`, `/trending`, `/rankings` | 🔴 عاجل |
| `predictions.routes.ts` | إضافة `/leaderboard` | 🟡 متوسط |
| `football.routes.ts` | إضافة `/standings/:leagueId` | 🟡 متوسط |
| `user.routes.ts` | إضافة `/:username` | 🟡 متوسط |
| `clerk-user.routes.ts` | إضافة `/user` | 🟡 متوسط |
| `app-version.routes.ts` | إضافة `/check-update` | 🟡 متوسط |
| `gdpr.routes.ts` | إضافة `requireAuth` middleware | 🔴 عاجل |
| `quiz.routes.ts` | إزالة `requireAuth` من `/categories` | 🟢 منخفض |

---

## 🚀 خطوات التنفيذ

1. **إصلاح الـ routes الناقصة** (2-3 ساعات)
2. **اختبار الـ endpoints محلياً** (1 ساعة)
3. **Deploy للـ Railway** (30 دقيقة)
4. **اختبار على Production** (30 دقيقة)

**إجمالي الوقت المتوقع:** 4-5 ساعات

---

**تم إنشاء التقرير بواسطة:** Kiro AI Assistant  
**التاريخ:** 31 مارس 2026
