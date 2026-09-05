import express, { Application, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import cron from 'node-cron';
import prisma, { startKeepAlive, stopKeepAlive } from './lib/prisma';
import { logger } from './utils/logger';
import { basicHealthCheck } from './middleware/health-check.middleware';
import { WebSocketService } from './services/websocket.service';
import { performanceMiddleware } from './middleware/performance.middleware';
import { backgroundPreloadService } from './services/background-preload.service';
import {
    resolveAndroidSha256Fingerprints,
    buildAssetLinksJson,
} from './config/androidAppLinks';
import { buildAppleAppSiteAssociation } from './config/appleAppSite';

// Fix: BigInt cannot be serialized by JSON.stringify by default
// This adds a global toJSON so any BigInt field is safely converted to Number
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

// Load environment variables
dotenv.config();

// Check if running in production mode (must be defined before middleware)
const isProduction = process.env.NODE_ENV === 'production';

const app: Application = express();
const PORT = Number(process.env.PORT) || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api';

// ============================================
// SENTRY INITIALIZATION
// ============================================
// Initialize Sentry for error tracking and performance monitoring
// Must be called early, before other middleware
import { initializeSentry } from './config/sentry.config';
initializeSentry(app);

// Trust proxy - Required for Railway and other reverse proxies
// This allows Express to correctly identify the client's IP from X-Forwarded-For header
app.set('trust proxy', true);

// Liveness probe — keep-alive (warmup.service) and platform checks hit GET /health.
// /api/health remains the detailed readiness payload further below.
app.get('/health', basicHealthCheck);

// ============================================
// MUX WEBHOOK — raw body MUST be registered before express.json()
// ============================================
import muxWebhookRoutes from './routes/mux-webhook.routes';
app.use(
  `${API_PREFIX}/webhooks/mux`,
  express.raw({ type: 'application/json' }),
  muxWebhookRoutes,
);

// ============================================
// MIDDLEWARE
// ============================================
// Helmet security headers with production optimizations
app.use(
    helmet({
        contentSecurityPolicy: isProduction
            ? {
                  directives: {
                      defaultSrc: ["'self'"],
                      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
                      scriptSrc: ["'self'"],
                      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
                      connectSrc: ["'self'"],
                  },
              }
            : false,
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
);
// CORS configuration - stricter in production
const corsOrigins = isProduction
    ? [
          process.env.CORS_ORIGIN || 'https://90plus.pro',
          'https://90plus.pro',
          'https://90plus.app',
          /^https:\/\/.*\.90plus\.app$/,
          /^https:\/\/.*\.90plus\.pro$/,
          /^https:\/\/.*\.railway\.app$/,
          /^https:\/\/.*\.up\.railway\.app$/,
          /^footballproapp:\/\//,
      ]
    : [
          process.env.CORS_ORIGIN || 'http://localhost:8081',
          'http://192.168.1.7:8081',
          'http://localhost:3000',
          'exp://192.168.1.7:8081',
          /^https:\/\/.*\.ngrok-free\.app$/, // ngrok URLs
          /^https:\/\/.*\.ngrok\.io$/, // ngrok legacy URLs
          /^https:\/\/.*\.ngrok\.app$/, // ngrok app URLs
          /^https:\/\/.*\.railway\.app$/, // Railway URLs
          /^https:\/\/.*\.up\.railway\.app$/, // Railway URLs
          /^ninetyplusapp:\/\//, // App deep links
      ];

app.use(
    cors({
        origin: corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-mobile-app', 'x-session-token', 'svix-id', 'svix-timestamp', 'svix-signature'],
        maxAge: isProduction ? 86400 : 3600, // 24 hours in production, 1 hour in dev
    })
);

// Keep-Alive headers for better connection reuse
app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=5, max=1000');
    next();
});
// ✅ DRAGON FIX: Request size limits with proper error handling
app.use(express.json({ 
    limit: '10mb',
    verify: (req: any, res: any, buf: Buffer) => {
        // Prevent JSON bomb attacks
        if (buf.length > 10 * 1024 * 1024) {
            throw new Error('Request entity too large');
        }
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 10000, // ✅ Limit number of parameters
}));

// ✅ TASK 10: Cookie parser for CSRF protection
app.use(cookieParser());

// Compression middleware with production optimizations
app.use(
    compression({
        level: 6, // Optimal balance between compression and CPU
        threshold: 1024, // Only compress responses > 1KB
        filter: (req, res) => {
            // Don't compress if client explicitly requests no compression
            if (req.headers['x-no-compression']) {
                return false;
            }
            // Use default compression filter
            return compression.filter(req, res);
        },
    })
);

// Morgan logging - custom format with proper spacing for readability
// Format: METHOD /path STATUS RESPONSE_TIME
// Skip logging for health check pings (Railway uptime monitoring)
app.use(morgan((tokens, req, res) => {
    return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), 'ms'
    ].join(' ');
}, {
    skip: (req) => req.url === '/' || req.url === '/health' || req.url === '/api/health',
}));

// Performance monitoring
app.use(performanceMiddleware());

// Metrics tracking
import { metricsMiddleware, getMetricsHandler } from './middleware/metrics.middleware';
import { createErrorResponse } from './utils/errorSanitizer';
app.use(metricsMiddleware);

// ============================================
// CLERK GLOBAL MIDDLEWARE
// Must be applied BEFORE any requireAuth usage so that request.auth
// is populated as a function on every request.
// ============================================
import { clerkMiddleware } from '@clerk/express';
// Native iOS/Android session JWTs use varying `azp` (bundle id, scheme, clerk domain).
// Strict authorizedParties breaks App Store / Play builds → mass 401 on /clerk/me.
// Bearer tokens are still verified via CLERK_SECRET_KEY signature.
app.use(clerkMiddleware());

// App version check middleware (before routes)
import { checkAppVersion } from './middleware/app-version.middleware';
app.use(checkAppVersion);

// Route logging middleware (for debugging in development)
if (!isProduction) {
    app.use((req: Request, _res: Response, next: NextFunction) => {
        logger.debug(`Route: ${req.method} ${req.path}`);
        next();
    });
}



// Upload timeout middleware - 15 minutes for upload routes
const UPLOAD_TIMEOUT = 15 * 60 * 1000; // 15 minutes
app.use(`${API_PREFIX}/upload`, (req: Request, res: Response, next: NextFunction) => {
    req.setTimeout(UPLOAD_TIMEOUT, () => {
        if (!res.headersSent) {
            res.status(408).json({
                status: 'ERROR',
                message: 'Upload timeout - request took too long',
            });
        }
    });
    next();
});

// ============================================
// ROUTES
// ============================================

// Import routes
import userRoutes from './routes/user.routes';
import clerkUserRoutes from './routes/clerk-user.routes';
import webhookRoutes from './routes/webhook.routes';
import profileRoutes from './routes/profile.routes';
import profileCompletionRoutes from './routes/profile-completion.routes';
import videoRoutes from './routes/video.routes';
import analyticsRoutes from './routes/analytics.routes';
import reelsRoutes from './routes/reels.routes';
import uploadRoutes from './routes/upload.routes';
import notificationRoutes from './routes/notification.routes';
import matchesRoutes from './routes/matches.routes';
import teamsRoutes from './routes/teams.routes';
import dailySpinRoutes from './routes/daily-spin.routes';
import footballRoutes from './routes/football.routes';
import knowledgeExportRoutes from './routes/knowledge-export.routes';
import predictionsRoutes from './routes/predictions.routes';
import predictionGroupsRoutes from './routes/prediction-groups.routes';
import competitionsRoutes from './routes/competitions.routes';
import assRoutes from './routes/ass.routes';
import coinsRoutes from './routes/coins.routes';

import adminRoutes from './routes/admin.routes';
import appVersionRoutes from './routes/app-version.routes';
import supportRoutes from './routes/support.routes';
import termsRoutes from './routes/terms.routes';
import reportsRoutes from './routes/reports.routes';
import gdprRoutes from './routes/gdpr.routes';
import chatRoutes from './routes/chat.routes';
import xpRoutes from './routes/xp.routes';
import quizRoutes from './routes/quiz.routes';
import shareWinRoutes from './routes/share-win.routes';
import matchChatRoutes from './routes/match-chat.routes';
import authRoutes from './routes/auth.routes';
import debugRoutes from './routes/debug.routes';
import i18nRoutes from './routes/i18n.routes';
import newsRoutes from './routes/news.routes';
import path from 'path';
import { resolvePublicDir, resolvePublicFile } from './utils/public-path.util';
import {
    CLERK_SIGN_IN_URL,
    CLERK_SIGN_UP_URL,
    CLERK_USER_PROFILE_URL,
} from './config/clerkUrls';

// Import services
import { MatchWatcherService } from './services/match-watcher.service';
import { LeagueMatchWatcherService } from './services/league-match-watcher.service';
import { FollowedTeamWatcherService } from './services/followed-team-watcher.service';
import { PredictionWatcherService } from './services/prediction-watcher.service';

// Import rate limiters
import {
    generalLimiter,
    lenientLimiter,
    lenientShellDailySpinLimiter,
    lenientShellQuizLimiter,
    lenientPredictionsReadLimiter,
    userSyncLimiterClerkMe,
    userSyncLimiterClerkStats,
    userSyncLimiterCoinsBalance,
    userSyncLimiterProfileCompletion,
    userSyncLimiterXp,
    userSyncLimiterGdpr,
    userSyncLimiterPushToken,
    webhookLimiter,
} from './middleware/rateLimit.middleware';

// Apply lenient rate limiting to high-frequency endpoints (must be before generalLimiter)
app.use(`${API_PREFIX}/football/fixtures/live`, lenientLimiter);
app.use(`${API_PREFIX}/football/cached/matches`, lenientLimiter);
app.use(`${API_PREFIX}/news`, lenientLimiter);
app.use(`${API_PREFIX}/notifications`, lenientLimiter);
app.use(`${API_PREFIX}/reels/rankings`, lenientLimiter);
// Chat routes: streaming + long polling — use lenient limiter
app.use(`${API_PREFIX}/chat`, lenientLimiter);
app.use(`${API_PREFIX}/conversations`, lenientLimiter);
app.use(`${API_PREFIX}/daily-spin`, lenientShellDailySpinLimiter);

// All /predictions routes (GET-heavy from multiple tabs); POST still passes generalLimiter after.
app.use(`${API_PREFIX}/predictions`, lenientPredictionsReadLimiter);
// User/profile-related endpoints are called frequently by the app shell.
// Separate limiter instances so one noisy endpoint cannot exhaust the quota for all others.
app.use(`${API_PREFIX}/clerk/me`, userSyncLimiterClerkMe);
app.use(`${API_PREFIX}/clerk/stats`, userSyncLimiterClerkStats);
app.use(`${API_PREFIX}/coins/balance`, userSyncLimiterCoinsBalance);
app.use(`${API_PREFIX}/profile/completion`, userSyncLimiterProfileCompletion);
app.use(`${API_PREFIX}/xp`, userSyncLimiterXp);
app.use(`${API_PREFIX}/gdpr`, userSyncLimiterGdpr);
app.use(`${API_PREFIX}/matches/push-token`, userSyncLimiterPushToken);

// Apply general rate limiting to all API routes (skips the endpoints above inside middleware)
app.use(`${API_PREFIX}`, generalLimiter);

// Public health — register BEFORE chatRoutes at /api (must not require auth)
app.get(`${API_PREFIX}/health`, async (_req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    const environment = process.env.NODE_ENV || 'development';
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    try {
        await Promise.race([
            prisma.$queryRawUnsafe('SELECT 1'),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Database connection timeout')), 30000)
            )
        ]);

        const { TokenRevocationService } = await import('./services/token-revocation.service');
        const { AbuseDetectionService } = await import('./services/abuse-detection.service');

        const tokenStats = TokenRevocationService.getStats();
        const abuseStats = AbuseDetectionService.getStats();

        res.status(200).json({
            status: 'OK',
            message: '90Plus API is running',
            timestamp,
            database: 'Connected',
            environment,
            server: 'Running',
            uptime: {
                seconds: Math.floor(uptime),
                formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
            },
            memory: {
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
                heapUsedBytes: memoryUsage.heapUsed,
                rssBytes: memoryUsage.rss,
            },
            security: {
                revokedTokens: tokenStats.totalRevoked,
                trackedUsers: abuseStats.trackedUsers,
                trackedIPs: abuseStats.trackedIPs,
                blockedUsers: abuseStats.blockedUsers,
                blockedIPs: abuseStats.blockedIPs,
            },
            caches: await (async () => {
                try {
                    const { footballDataCacheService } = await import(
                        './services/football-data-cache.service'
                    );
                    const { getScores365InProcessCacheSizes } = await import(
                        './services/scores365-experiment.service'
                    );
                    const { getResponseCacheMemorySize } = await import(
                        './middleware/responseCache.middleware'
                    );
                    const { redisCacheService } = await import('./services/redis-cache.service');
                    const { matchCacheService } = await import('./services/match-cache.service');
                    const { playerCacheService } = await import('./services/player-cache.service');
                    return {
                        football: footballDataCacheService.getInProcessCacheSizes(),
                        scores365: getScores365InProcessCacheSizes(),
                        responseCacheL1: getResponseCacheMemorySize(),
                        redisMemoryFallback: redisCacheService.memoryFallbackSize(),
                        matchCache: matchCacheService.getCacheStats().memoryCacheSize,
                        players: playerCacheService.getInProcessCacheSizes(),
                    };
                } catch {
                    return null;
                }
            })(),
            providers: await (async () => {
                try {
                    const { getQuotaStatus } = await import('./services/api-football-quota.service');
                    const { getQuotaExhaustedUntilMs } = await import('./services/football.service');
                    const quota = await getQuotaStatus(getQuotaExhaustedUntilMs());
                    return {
                        apiFootball: {
                            status: quota.status,
                            dailyUsed: quota.used,
                            dailyLimit: quota.dailyLimit,
                            jobUsed: quota.jobUsed,
                            jobLimit: quota.jobLimit,
                            remaining: quota.remaining,
                            resetAt: quota.resetAt.toISOString(),
                            redisAvailable: quota.redisAvailable,
                        },
                        scores365: { status: 'active' as const },
                    };
                } catch {
                    return {
                        apiFootball: { status: 'disabled' as const },
                        scores365: { status: 'active' as const },
                    };
                }
            })(),
        });
    } catch (error: any) {
        res.status(200).json({
            status: 'PARTIAL',
            message: '90Plus API is running, but database is not connected',
            timestamp,
            database: 'Disconnected',
            environment,
            server: 'Running',
            error: error?.message || 'Database connection failed',
        });
    }
});

// Register routes
app.use(`${API_PREFIX}/debug`, debugRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/clerk`, clerkUserRoutes);
app.use(`${API_PREFIX}/webhooks/clerk`, webhookLimiter, webhookRoutes);
// IMPORTANT: profileCompletionRoutes MUST be mounted BEFORE profileRoutes
// because profileRoutes contains a greedy GET /:username handler that would
// otherwise swallow /completion, /completion/step as "username" lookups and
// return 404 "User not found".
app.use(`${API_PREFIX}/profile`, profileCompletionRoutes); // Profile completion routes (must come first)
app.use(`${API_PREFIX}/profile`, profileRoutes);
app.use(`${API_PREFIX}/videos`, videoRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/reels`, reelsRoutes);
app.use(`${API_PREFIX}/upload`, uploadRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/matches`, matchesRoutes);
app.use(`${API_PREFIX}/teams`, teamsRoutes);
app.use(`${API_PREFIX}/daily-spin`, dailySpinRoutes);
app.use(`${API_PREFIX}/football`, footballRoutes);
// INTERNAL ONLY — Football Knowledge Factory season-aware export (API key auth)
app.use(`${API_PREFIX}/internal/football/knowledge`, knowledgeExportRoutes);
app.use(`${API_PREFIX}/news`, newsRoutes);
app.use(`${API_PREFIX}/i18n`, i18nRoutes);
app.use(`${API_PREFIX}/predictions`, predictionsRoutes);
app.use(`${API_PREFIX}/prediction-groups`, predictionGroupsRoutes);
app.use(`${API_PREFIX}/competitions`, competitionsRoutes);
app.use(`${API_PREFIX}/ass`, assRoutes);
app.use(`${API_PREFIX}/coins`, coinsRoutes);
app.use(`${API_PREFIX}/app`, appVersionRoutes);
app.use(`${API_PREFIX}/terms`, termsRoutes);
app.use(`${API_PREFIX}/reports`, reportsRoutes);
app.use(`${API_PREFIX}/gdpr`, gdprRoutes); // GDPR compliance routes
app.use(`${API_PREFIX}/admin`, adminRoutes); // Admin routes
app.use(`${API_PREFIX}`, chatRoutes); // AI chat: /chat/limit, /chat/stream, /conversations/*
app.use(`${API_PREFIX}/xp`, xpRoutes); // XP system: /xp/me, /xp/users/:userId, /xp/me/history, /xp/curve
app.use(`${API_PREFIX}/quiz`, lenientShellQuizLimiter);
app.use(`${API_PREFIX}/quiz`, quizRoutes);
app.use(`${API_PREFIX}/share-win`, shareWinRoutes); // Share & Win: referrals, weekly cycles, leaderboard
app.use(`${API_PREFIX}/match-chat`, matchChatRoutes);

// Support and legal pages (without API prefix)
app.use('/', supportRoutes);

// Android App Links verification (SHA-256 release fingerprint)
app.get('/.well-known/assetlinks.json', (_req, res) => {
    const fingerprints = resolveAndroidSha256Fingerprints(process.env.ANDROID_RELEASE_SHA256);
    res.setHeader('Content-Type', 'application/json');
    res.json(buildAssetLinksJson(fingerprints));
});

// iOS Universal Links — Apple App Site Association (no auth, no redirect)
const sendAppleAppSiteAssociation = (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).json(buildAppleAppSiteAssociation());
};
app.get('/.well-known/apple-app-site-association', sendAppleAppSiteAssociation);
app.get('/apple-app-site-association', sendAppleAppSiteAssociation);

// Serve static files for privacy and terms (Apple compliance)
const publicPath = resolvePublicDir(__dirname);

logger.info(`📁 Public path: ${publicPath}`);
logger.info(`📁 Current directory: ${__dirname}`);
logger.info(`📁 Production mode: ${isProduction}`);

app.get(['/AsS', '/ass'], (_req: Request, res: Response) => {
    const filePath = path.join(publicPath, 'ass', 'index.html');
    res.set('Cache-Control', 'no-store');
    res.sendFile(filePath, (err) => {
        if (err) {
            logger.error('Failed to send AsS page:', err);
            res.status(500).send('تعذّر تحميل لوحة المراجعة');
        }
    });
});

app.get('/news', (_req: Request, res: Response) => {
    const filePath = resolvePublicFile(__dirname, 'news.html');
    logger.info(`📰 Serving news page from: ${filePath}`);
    res.sendFile(filePath, (err) => {
        if (err) {
            logger.error('Failed to send news.html:', err);
            res.status(500).send('تعذّر تحميل صفحة الأخبار');
        }
    });
});

app.get('/news.html', (_req, res) => {
    res.redirect(301, '/news');
});

app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'index.html'), (err) => {
        if (err) {
            logger.error('Failed to send index.html:', err);
            res.status(500).send('90Plus');
        }
    });
});

// Clerk Account Portal (accounts.90plus.pro) — short paths on main domain
app.get('/sign-in', (_req, res) => res.redirect(302, CLERK_SIGN_IN_URL));
app.get('/sign-up', (_req, res) => res.redirect(302, CLERK_SIGN_UP_URL));
app.get('/login', (_req, res) => res.redirect(302, CLERK_SIGN_IN_URL));
app.get('/account', (_req, res) => res.redirect(302, CLERK_USER_PROFILE_URL));
app.get('/user', (_req, res) => res.redirect(302, CLERK_USER_PROFILE_URL));

// Serve static files from public directory
app.use(express.static(publicPath));

// Serve legal pages with proper error handling and logging
app.get('/privacy-policy.html', (req, res) => {
    const filePath = path.join(publicPath, 'privacy-policy.html');
    logger.info(`📄 Serving privacy policy from: ${filePath}`);
    res.sendFile(filePath, (err) => {
        if (err) {
            logger.error('Failed to send privacy-policy.html:', err);
            res.status(404).json({ 
                status: 'ERROR', 
                message: 'Privacy policy not found',
                path: filePath,
                exists: require('fs').existsSync(filePath)
            });
        }
    });
});

app.get('/terms-of-service.html', (req, res) => {
    const filePath = path.join(publicPath, 'terms-of-service.html');
    logger.info(`📄 Serving terms of service from: ${filePath}`);
    res.sendFile(filePath, (err) => {
        if (err) {
            logger.error('Failed to send terms-of-service.html:', err);
            res.status(404).json({ 
                status: 'ERROR', 
                message: 'Terms of service not found',
                path: filePath,
                exists: require('fs').existsSync(filePath)
            });
        }
    });
});

app.get('/support.html', (req, res) => {
    const filePath = path.join(publicPath, 'support.html');
    logger.info(`📄 Serving support page from: ${filePath}`);
    res.sendFile(filePath, (err) => {
        if (err) {
            logger.error('Failed to send support.html:', err);
            res.status(404).json({ 
                status: 'ERROR', 
                message: 'Support page not found',
                path: filePath,
                exists: require('fs').existsSync(filePath)
            });
        }
    });
});

app.get('/delete-account.html', (req, res) => {
    const filePath = path.join(publicPath, 'delete-account.html');
    logger.info(`📄 Serving delete account page from: ${filePath}`);
    res.sendFile(filePath, (err) => {
        if (err) {
            logger.error('Failed to send delete-account.html:', err);
            res.status(404).json({
                status: 'ERROR',
                message: 'Delete account page not found',
                path: filePath,
                exists: require('fs').existsSync(filePath)
            });
        }
    });
});

// Legacy routes for backward compatibility (/privacy is served by support.routes.ts)
app.get('/terms', (req, res) => {
    res.redirect('/terms-of-service.html');
});

// /support is served by support.routes.ts (public/support.html)

app.get('/delete-account', (req, res) => {
    res.redirect('/delete-account.html');
});



// Metrics endpoint (for monitoring)
app.get(`${API_PREFIX}/metrics`, getMetricsHandler);

// ✅ TASK 10: CSRF token endpoint
import { getCSRFTokenHandler } from './middleware/csrf.middleware';
app.get(`${API_PREFIX}/csrf-token`, getCSRFTokenHandler);

app.get(`${API_PREFIX}`, (_req: Request, res: Response) => {
    res.json({
        name: '90Plus API',
        version: '1.0.0',
        description: 'Backend API for 90Plus App using Express, Prisma, and PostgreSQL',
        endpoints: {
            health: `${API_PREFIX}/health`,
            users: `${API_PREFIX}/users (authenticated routes)`,
        },
    });
});

// Unmatched public paths → landing page (deep links open in app; browsers get home)
const LANDING_PAGE_URL = 'https://90plus.pro';
const CATCH_ALL_EXCLUDED_PREFIXES = [
    '/api',
    '/.well-known',
    '/apple-app-site-association',
    '/health',
];
app.get('*', (req: Request, res: Response, next: NextFunction) => {
    const isExcluded = CATCH_ALL_EXCLUDED_PREFIXES.some((prefix) =>
        req.path.startsWith(prefix),
    );
    if (isExcluded) {
        return next();
    }
    res.redirect(301, LANDING_PAGE_URL);
});

// ============================================
// ERROR HANDLING
// ============================================
// 404 Handler - يجب أن يكون بعد جميع الـ routes
app.use((req: Request, res: Response) => {
    logger.warn(`404 - Route not found`, {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        url: req.url,
        query: req.query,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
    });
    
    res.status(404).json({
        status: 'ERROR',
        message: 'Route not found',
        path: req.path,
        method: req.method,
        originalUrl: req.originalUrl,
        suggestion: `Check available routes at ${API_PREFIX}/health`,
    });
});

// Note: Sentry error handler is automatically added by setupExpressErrorHandler in initializeSentry

// ✅ ZERO TRUST: Production-safe error handler with sanitization
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Error:', err);

    // ✅ Use error sanitizer in production (static import)
    if (process.env.NODE_ENV === 'production') {
        const sanitized = createErrorResponse(err);
        res.status(500).json(sanitized);
    } else {
        res.status(500).json({
            status: 'ERROR',
            message: err.message,
            stack: err.stack,
        });
    }
});

// ============================================
// SERVER START
// ============================================

// Create HTTP server for both Express and WebSocket
const httpServer = createServer(app);

// Increase server timeout for uploads (15 minutes)
httpServer.timeout = 15 * 60 * 1000; // 15 minutes
httpServer.keepAliveTimeout = 10 * 60 * 1000; // 10 minutes
httpServer.headersTimeout = 11 * 60 * 1000; // 11 minutes (must be > keepAliveTimeout)

async function startServer() {
    try {
        const allowStartWithoutDb = process.env.ALLOW_START_WITHOUT_DATABASE === 'true';

        logger.info('Connecting to Database...');
        let databaseConnected = false;
        try {
            // ✅ FIX P2037: Do NOT call prisma.$connect() explicitly.
            // $connect() opens connections OUTSIDE the pool and causes "too many clients".
            // Instead, run a lightweight query — Prisma pools manage connections automatically.
            await prisma.$queryRaw`SELECT 1`;
            databaseConnected = true;
            logger.info('✅ Database connected successfully');
        } catch (connectErr) {
            logger.error('❌ FATAL: Failed to connect to database on startup:', connectErr);
            if (allowStartWithoutDb) {
                logger.warn(
                    '⚠️ ALLOW_START_WITHOUT_DATABASE=true — HTTP will start without a working DB (development only).'
                );
            } else {
                logger.error('Exiting: set ALLOW_START_WITHOUT_DATABASE=true only for local debugging without Postgres.');
                process.exit(1);
                return;
            }
        }

        if (databaseConnected) {
            try {
                startKeepAlive();
                logger.info('✅ Database keep-alive started');

                const { TokenRevocationService } = await import('./services/token-revocation.service');
                const { AbuseDetectionService } = await import('./services/abuse-detection.service');

                await TokenRevocationService.loadFromDatabase();
                TokenRevocationService.startCleanup();
                AbuseDetectionService.startCleanup();

                logger.info('✅ Enterprise Immunity services started');
                logger.info('   - Token Revocation System: Active');
                logger.info('   - Abuse Detection Engine: Active');
                logger.info('   - Tamper-Proof Audit: Active');

                import('./services/reel-mux-heal.service')
                    .then(({ healStuckReels }) =>
                        healStuckReels({
                            dryRun: false,
                            statuses: ['FAILED'],
                            maxAgeDays: 7,
                            notify: true,
                            invalidateCaches: true,
                        }),
                    )
                    .then((summary) => {
                        if (summary.healedReady > 0) {
                            logger.info('[ReelHeal] Startup heal recovered reels:', summary);
                        }
                    })
                    .catch((err) =>
                        logger.warn('[ReelHeal] Startup heal failed (non-fatal):', err?.message ?? err),
                    );

                import('./services/mux-cleanup.service')
                    .then(({ ensureMuxUploadHeadroom }) => ensureMuxUploadHeadroom(2))
                    .then((freed) => {
                        if (freed > 0) {
                            logger.info(`[MuxCleanup] Startup freed ${freed} orphan/stale Mux asset slot(s)`);
                        }
                    })
                    .catch((err) =>
                        logger.warn('[MuxCleanup] Startup headroom check failed (non-fatal):', err?.message ?? err),
                    );
            } catch (postConnectErr) {
                logger.error('❌ Failed to initialize database-dependent services after connect:', postConnectErr);
                process.exit(1);
                return;
            }
        }

        // Initialize WebSocket server (Requirements: 21.1)
        WebSocketService.initialize(httpServer);

        // ✅ Fix 1: Initialize video-processing queue + verify ffmpeg (always, regardless of football API key)
        try {
            const { getVideoProcessingQueue, verifyFfmpeg } = await import('./services/video-processor.service');
            getVideoProcessingQueue();
            verifyFfmpeg();
            logger.info('✅ Video processing queue initialised');
        } catch (vpErr) {
            logger.error('❌ Failed to initialise video processing queue:', vpErr);
        }

        // ✅ Warmup: pre-heat DB connection pool + prefetch hot data to avoid
        //    slow cold-start queries (CachedFixture, Leagues, …)
        if (databaseConnected) {
            try {
                const { warmupService } = await import('./services/warmup.service');
                warmupService.start().catch((err) =>
                    logger.warn('Warmup failed (non-fatal):', err?.message ?? err),
                );
            } catch (warmErr) {
                logger.warn('Could not start warmup service (non-fatal):', warmErr);
            }
        }

        httpServer.listen(PORT, '0.0.0.0', async () => {
            logger.info('🚀 90Plus Backend is running! ');
            logger.info(`📍 Server: http://0.0.0.0:${PORT}`);
            logger.info(`📍 API: http://0.0.0.0:${PORT}${API_PREFIX}`);
            logger.info(`📍 Health: http://0.0.0.0:${PORT}/health`);
            logger.info(`📍 API health: http://0.0.0.0:${PORT}${API_PREFIX}/health`);
            logger.info(`📍 WebSocket: ws://0.0.0.0:${PORT}`);
            logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

            try {
                const { startKeepAlivePing } = await import('./services/warmup.service');
                startKeepAlivePing(PORT);
            } catch (pingErr) {
                logger.warn('Could not start keep-alive ping (non-fatal):', pingErr);
            } 

                // Start match watcher for push notifications
                if (process.env.FOOTBALL_API_KEY) {
                    const { logWorldCupOnlyModeStartup } = await import(
                        './config/world-cup-only-mode.config'
                    );
                    logWorldCupOnlyModeStartup();
                    const { log365StoreHotfixStartup } = await import(
                        './services/scores365-experiment.service'
                    );
                    log365StoreHotfixStartup();
                    const { syncScores365FixtureMappingsFromFixturesList } = await import(
                        './services/scores365-experiment.service'
                    );
                    void syncScores365FixtureMappingsFromFixturesList().catch((err) =>
                        logger.warn('[Scores365] fixture↔game startup sync failed', err),
                    );

                    const plan = (process.env.FOOTBALL_API_PLAN || '').toLowerCase();
                    const isFreePlan = !plan || plan === 'free';

                    // ── Always-on watchers ───────────────────────────────
                    // These two services are essential to user-visible
                    // behaviour:
                    //   - MatchWatcher delivers goal/halftime/match-end push
                    //     notifications that users explicitly subscribed to.
                    //   - PredictionWatcher resolves predictions, awards
                    //     coins + XP, and sends the result notification.
                    // Both already short-circuit on quota exhaustion via
                    // footballService.fetchFromApi (returns [] until the
                    // cooldown window expires), so running them on Free plan
                    // is safe — they degrade rather than burn the quota.
                    MatchWatcherService.start();
                    PredictionWatcherService.start();

                    // Followed-team match alerts (kickoff + same-day upcoming).
                    // Reuses the subscription/reminder/ingestor pipeline and
                    // short-circuits on quota exhaustion, so it is safe on free plan.
                    FollowedTeamWatcherService.start();

                    const { liveFixtureSyncService } = await import('./services/live-fixture-sync.service');
                    liveFixtureSyncService.start();

                    const { footballCalendarSyncService } = await import(
                        './services/football-calendar-sync.service'
                    );
                    footballCalendarSyncService.start();

                    // ── Always-on queues & verification ──────────────────
                    // These have nothing to do with API-Football quota; they
                    // process push receipts and notification fan-out, which
                    // we want even on free plan so social/system pushes
                    // still flow through Bull (with retries) instead of the
                    // fire-and-forget in-process fallback.
                    try {
                        const { getReceiptQueue } = await import('./queues/receipt.queue');
                        getReceiptQueue();

                        const { getNotificationQueue } = await import('./queues/notification.queue');
                        getNotificationQueue();

                        const { getMatchStartReminderQueue } = await import('./queues/match-start-reminder.queue');
                        getMatchStartReminderQueue();

                        const { getMatchEventPushQueue } = await import('./queues/match-event-push.queue');
                        getMatchEventPushQueue();

                        const { verifyFCMConfiguration } = await import('./services/push-notification.service');
                        verifyFCMConfiguration();
                    } catch (queueErr) {
                        logger.warn('Failed to initialise notification queues (non-fatal):', queueErr);
                    }

                    // Daily quiz packs are independent of Football API plan — always warm + cron.
                    const { ensureDailyPacksForToday } = await import('./services/quiz-daily.service');
                    ensureDailyPacksForToday().catch((err) =>
                        logger.error('Quiz pack warmup failed:', err),
                    );
                    const { regenerateDailyQuestionsChallenges } = await import(
                        './services/questions-challenges.service'
                    );
                    const { ensureQuizEntityDataset } = await import(
                        './services/quiz-team-roster-sync.service'
                    );

                    /*
                     * Questions rounds are authored over the football entity pool, so the
                     * pool has to exist BEFORE generation runs. Nothing used to refresh it:
                     * the cron regenerated rounds against an empty TeamPlayer table, every
                     * mode failed to generate, and old rows were recycled forward instead.
                     *
                     * ensureQuizEntityDataset is a no-op (and costs no API quota) whenever
                     * the pool is already healthy.
                     */
                    const warmQuestions = async () => {
                        await ensureQuizEntityDataset();
                        await regenerateDailyQuestionsChallenges();
                    };
                    warmQuestions().catch((err) =>
                        logger.error('Questions challenges warmup failed:', err),
                    );
                    cron.schedule('0 0 * * *', () => {
                        logger.info('⏰ Cron: Generating daily quiz packs (ar + en)...');
                        ensureDailyPacksForToday().catch((err) =>
                            logger.error('Daily quiz pack cron error:', err),
                        );
                        // Runs at 00:00 UTC — the same moment the API-Football daily
                        // quota resets, so a pool starved by yesterday's quota refills
                        // before the day's rounds are authored.
                        warmQuestions().catch((err) =>
                            logger.error('Daily questions challenges cron error:', err),
                        );
                    });
                    logger.info('✅ Daily quiz pack cron scheduled (00:00 UTC)');

                    if (process.env.WORLD_CUP_NEWS_ENABLED === 'true') {
                        const { startWorldCupNewsRefreshCron } = await import(
                            './services/world-cup-news-cron.service'
                        );
                        startWorldCupNewsRefreshCron();
                    } else {
                        logger.info('📰 World Cup news cron disabled (WORLD_CUP_NEWS_ENABLED≠true)');
                    }

                    // ✅ Share & Win — archive finished weekly cycles with their final
                    // ranks. Rollover is also lazy on every read/write, so this only
                    // makes it prompt for weeks with no traffic.
                    const { closeDueCycles, ensureCurrentCycle } = await import(
                        './services/share-win.service'
                    );
                    const runShareWinRollover = () => {
                        ensureCurrentCycle()
                            .then(() => closeDueCycles())
                            .catch((err) => logger.error('Share & Win cycle rollover error:', err));
                    };
                    runShareWinRollover();
                    setInterval(runShareWinRollover, 15 * 60 * 1000).unref?.();
                    logger.info('✅ Share & Win weekly cycle rollover scheduled (every 15m)');

                    const { startWinnerReminderCron } = await import(
                        './services/competition-award.service'
                    );
                    startWinnerReminderCron();

                    if (isFreePlan) {
                        logger.warn('⚠️ FOOTBALL_API_PLAN is free/undefined — heavy watchers (league preloader, preload, etc.) disabled to preserve quota. Match + prediction watchers still run with circuit-breaker protection.');
                    } else {
                        LeagueMatchWatcherService.start(); // ✅ Start league match watcher

                        // ✅ Start lucky wheel daily notifier
                        const { startLuckyWheelNotifier } = await import('./services/lucky-wheel-notifier.service');
                        startLuckyWheelNotifier();

                        // ✅ Start prediction ticket renewal notifier (daily at 8 AM Egypt)
                        const { startPredictionTicketNotifier } = await import('./services/prediction-ticket-notifier.service');
                        startPredictionTicketNotifier();

                        // ✅ Start cooldown expiry notifier (hourly check)
                        const { startCooldownExpiryNotifier } = await import('./services/cooldown-expiry-notifier.service');
                        startCooldownExpiryNotifier();

                        // ✅ Start daily quiz renewal notifier (daily at 9 AM Egypt)
                        const { startDailyQuizNotifier } = await import('./services/daily-quiz-notifier.service');
                        startDailyQuizNotifier();

                        // ✅ Start AI coach 12-hour check-in (opt-in, twice daily)
                        const { startAICheckinNotifier } = await import('./services/ai-checkin-notifier.service');
                        startAICheckinNotifier();
                    }
                    
                    // ✅ Start football background service for API optimization
                    const { footballBackgroundService } = await import('./services/football-background.service');
                    footballBackgroundService.start();
                    logger.info('✅ Football Background Service started (API optimization)');
                    
                    // ✅ Prediction watcher runs via setInterval in PredictionWatcherService.start()
                    // (duplicate cron removed — was doubling API-Football fixture checks)
                    
                    // Backfill finished fixtures missing events/lineups in fullData
                    cron.schedule('0 5 * * *', async () => {
                        logger.info('⏰ Cron: Backfilling missing finished match details...');
                        try {
                            const { matchCacheService } = await import('./services/match-cache.service');
                            const count = await matchCacheService.backfillMissingMatchDetails(40);
                            logger.info(`✅ Backfilled details for ${count} finished fixtures`);
                        } catch (error) {
                            logger.error('❌ Finished match backfill cron failed:', error);
                        }
                    });
                    logger.info('✅ Finished match details backfill scheduled (daily 05:00 UTC)');
                    
                    // ✅ Setup Cron Job for Account Deletion (daily at 2 AM)
                    cron.schedule('0 2 * * *', async () => {
                        logger.info('⏰ Cron: Running scheduled account deletions...');
                        try {
                            const { AccountDeletionService } = await import('./services/account-deletion.service');
                            const usersToDelete = await AccountDeletionService.getUsersScheduledForDeletion();
                            
                            if (usersToDelete.length > 0) {
                                logger.info(`Found ${usersToDelete.length} users scheduled for deletion`);
                                
                                for (const user of usersToDelete) {
                                    try {
                                        await AccountDeletionService.permanentlyDeleteAccount(user.id);
                                        logger.info(`✅ Permanently deleted user: ${user.username} (${user.email})`);
                                    } catch (error) {
                                        logger.error(`❌ Failed to delete user ${user.id}:`, error);
                                    }
                                }
                            } else {
                                logger.info('No users scheduled for deletion');
                            }
                        } catch (error) {
                            logger.error('❌ Account deletion cron job failed:', error);
                        }
                    });
                    logger.info('✅ Account Deletion Cron Job scheduled (daily at 2 AM)');
                    
                    // GDPR maintenance — run the work directly (no nested setInterval).
                    // Previously setupGDPRCronJobs() was called every hour and each call
                    // created a NEW setInterval → unbounded timer leak.
                    cron.schedule('0 * * * *', async () => {
                        logger.info('⏰ GDPR Cron: scheduled deletions + export cleanup...');
                        try {
                            const { runGdprMaintenanceJobs } = await import(
                                './services/data-anonymization.service'
                            );
                            await runGdprMaintenanceJobs();
                        } catch (error) {
                            logger.error('❌ GDPR cron job failed:', error);
                        }
                    });
                    logger.info('✅ GDPR Cron Jobs scheduled (hourly, no nested intervals)');

                    // Match event retention — daily at 4:30 AM UTC
                    cron.schedule('30 4 * * *', async () => {
                        logger.info('⏰ Cron: Running match event retention cleanup...');
                        try {
                            const { cleanupMatchEventData } = await import(
                                './services/match-events/match-event-cleanup.service'
                            );
                            await cleanupMatchEventData();
                        } catch (error) {
                            logger.error('❌ Match event cleanup cron failed:', error);
                        }
                    });
                    logger.info('✅ Match event retention cron scheduled (daily at 04:30 UTC)');

                    // ✅ Fix 2: R2 Orphan Cleanup – daily at 03:00 Cairo (UTC+2 = 01:00 UTC)
                    cron.schedule('0 1 * * *', async () => {
                        logger.info('⏰ Cron: Running R2 orphan cleanup...');
                        try {
                            const { runOrphanCleanup } = await import('./services/r2-cleanup.service');
                            await runOrphanCleanup();
                        } catch (error) {
                            logger.error('❌ R2 orphan cleanup cron failed:', error);
                        }
                    });
                    logger.info('✅ R2 Orphan Cleanup Cron Job scheduled (daily at 03:00 Cairo)');

                    // ✅ Fix 2: Stuck PROCESSING reel cleanup – every hour
                    cron.schedule('0 * * * *', async () => {
                        logger.info('⏰ Cron: Running stuck reel cleanup...');
                        try {
                            const { runStuckReelCleanup } = await import('./services/r2-cleanup.service');
                            await runStuckReelCleanup();
                        } catch (error) {
                            logger.error('❌ Stuck reel cleanup cron failed:', error);
                        }
                    });
                    logger.info('✅ Stuck Reel Cleanup Cron Job scheduled (every hour)');

                    // Mux orphan reconciliation — reconnect PROCESSING reels missing muxUploadId
                    cron.schedule('*/10 * * * *', async () => {
                        logger.info('⏰ Cron: Running Mux reel reconciliation...');
                        try {
                            const { runMuxReconciliation } = await import(
                                './services/reel-mux-reconcile.service'
                            );
                            const summary = await runMuxReconciliation();
                            if (
                                summary.identifiersAttached > 0 ||
                                summary.healedReady > 0 ||
                                summary.repairFailed > 0
                            ) {
                                logger.info('[MuxReconcile] Cron summary:', summary);
                            }
                        } catch (error) {
                            logger.error('❌ Mux reel reconciliation cron failed:', error);
                        }
                    });
                    logger.info('✅ Mux Reel Reconciliation Cron scheduled (every 10 minutes)');

                    // Mux free-tier cap: prune orphan/stale assets before uploads block
                    cron.schedule('15 * * * *', async () => {
                        logger.info('⏰ Cron: Running Mux asset headroom check...');
                        try {
                            const { ensureMuxUploadHeadroom } = await import('./services/mux-cleanup.service');
                            const freed = await ensureMuxUploadHeadroom(2);
                            if (freed > 0) {
                                logger.info(`✅ Mux headroom: freed ${freed} asset slot(s)`);
                            }
                        } catch (error) {
                            logger.error('❌ Mux headroom cron failed:', error);
                        }
                    });
                    logger.info('✅ Mux asset headroom cron scheduled (hourly at :15)');

                    // ✅ Daily ranking badges (views, shares, comments, predictions)
                    cron.schedule('0 4 * * *', async () => {
                        const { runRankingBadgesJob } = await import('./services/ranking-badges-cron.service');
                        await runRankingBadgesJob();
                    });
                    logger.info('✅ Ranking Badges Cron Job scheduled (daily at 4 AM UTC)');
                    
                    // ✅ OPTIMIZATION 4: Start background preload service
                    backgroundPreloadService.start();
                    logger.info('✅ Background preload service started');

                    // ✅ Proactive data refresh worker (weekly/monthly/100-day)
                    const { startDataRefreshWorker } = await import('./workers/dataRefreshWorker');
                    startDataRefreshWorker();
                    logger.info('✅ Data refresh worker scheduled (weekly/monthly/100-day)');

                    // ✅ World Cup sync worker — lineup completeness + live stats (365Scores)
                    try {
                        const { startWorldCupSyncWorker } = await import('./workers/worldCupSync.service');
                        startWorldCupSyncWorker();
                    } catch (wcErr) {
                        logger.warn('⚠️ WC sync worker failed to start (non-fatal):', (wcErr as Error)?.message);
                    }

                    // ✅ Other leagues sync worker — live fixture refresh for non-WC competitions
                    try {
                        const { startOtherLeaguesSyncWorker } = await import('./workers/otherLeaguesSync.service');
                        startOtherLeaguesSyncWorker();
                    } catch (olErr) {
                        logger.warn('⚠️ Other leagues sync worker failed to start (non-fatal):', (olErr as Error)?.message);
                    }

                    // ✅ Stale NS safety sweep — catch fixtures stuck NS past kickoff+3h
                    try {
                        const { startStaleNsSweepWorker } = await import('./services/stale-ns-sweep.service');
                        startStaleNsSweepWorker();
                    } catch (staleErr) {
                        logger.warn('⚠️ Stale NS sweep worker failed to start (non-fatal):', (staleErr as Error)?.message);
                    }

                    // ✅ Idempotently sync player name mappings (upsert) so new
                    // seed entries land on deploy even when the table isn't empty.
                    void import('./services/player-name-resolver.service')
                        .then(({ seedCommonPlayerMappings, invalidateMappingCache }) =>
                            seedCommonPlayerMappings().then(() => invalidateMappingCache()),
                        )
                        .then(() => logger.info('✅ Player name mappings synced'))
                        .catch((err) =>
                            logger.warn('Player name mapping sync failed:', err?.message ?? err),
                        );

                } else {
                    logger.info('⚠️ FOOTBALL_API_KEY not set - Match watcher disabled');
                }
        });



        // Handle server errors
        httpServer.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`❌ Port ${PORT} is already in use`);
            } else {
                logger.error('❌ Server error:', error);
            }
            process.exit(1);
        });
    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    logger.info('\n👋 Shutting down gracefully...');
    WebSocketService.shutdown();
    MatchWatcherService.stop();
    PredictionWatcherService.stop(); // ✅ Stop prediction watcher
    LeagueMatchWatcherService.stop(); // ✅ Stop league match watcher
    FollowedTeamWatcherService.stop(); // ✅ Stop followed-team watcher
    try {
        const { closeMatchEventPushQueue } = await import('./queues/match-event-push.queue');
        await closeMatchEventPushQueue();
    } catch {
        /* non-fatal */
    }
    const { liveFixtureSyncService } = await import('./services/live-fixture-sync.service');
    liveFixtureSyncService.stop();
    const { footballCalendarSyncService } = await import('./services/football-calendar-sync.service');
    footballCalendarSyncService.stop();
    backgroundPreloadService.stop(); // ✅ OPTIMIZATION 4: Stop background preload

    stopKeepAlive();
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('\n👋 Shutting down gracefully...');
    WebSocketService.shutdown();
    MatchWatcherService.stop();
    PredictionWatcherService.stop(); // ✅ Stop prediction watcher
    LeagueMatchWatcherService.stop();
    FollowedTeamWatcherService.stop(); // ✅ Stop followed-team watcher
    try {
        const { closeMatchEventPushQueue } = await import('./queues/match-event-push.queue');
        await closeMatchEventPushQueue();
    } catch {
        /* non-fatal */
    }
    const { liveFixtureSyncService } = await import('./services/live-fixture-sync.service');
    liveFixtureSyncService.stop();
    const { footballCalendarSyncService } = await import('./services/football-calendar-sync.service');
    footballCalendarSyncService.stop();
    backgroundPreloadService.stop(); // ✅ OPTIMIZATION 4: Stop background preload

    stopKeepAlive();
    await prisma.$disconnect();
    process.exit(0);
});

// Handle uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (error: Error) => {
    logger.error('❌ Uncaught Exception:', error);
    // Don't exit immediately - let the server try to handle it
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately - let the server try to handle it
});

startServer();

export default app;
