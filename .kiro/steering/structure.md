# 90Plus — Developer Onboarding Guide

> **الغرض من الملف ده:** مرجع سريع لأي مبرمج جديد على المشروع — فيه هيكل الريبو، إزاي تشغّل البيئة المحلية، أين الكود، والقواعد اللي لازم تتبعها قبل ما تفتح PR.

---

## 1. نظرة عامة على المنتج

**90Plus** منصة اجتماعية لعشاق كرة القدم (mobile-first). بتجمع:

| الركيزة | الوصف المختصر |
|---------|----------------|
| بيانات مباشرة | نتائج، جداول، تشكيلات، أحداث مباريات |
| Reels | فيديوهات قصيرة (5–60 ثانية) مع لايكات وتعليقات |
| توقعات | المستخدم يتوقع نتائج المباريات ويكسب عملات |
| كويز يومي | أسئلة كروية بفئات متغيرة + مكافآت XP وعملات |
| Gamification | عملات، مستويات، إنجازات، عجلة حظ |
| اجتماعي | متابعة، إشعارات، ترتيب، بروفايلات FIFA-style |
| Moderation | بلاغات، strikes، حظر، إزالة محتوى |

**المنصات:** iOS و Android (أساسي) + Web (ثانوي).  
**الإنتاج:** API على `https://90plus.pro/api` — التطبيق يتصل بيه في production.

لتفاصيل المنتج واللغة المستخدمة مع المستخدم: راجع `product.md` في نفس المجلد.

---

## 2. هيكل الريبو (Monorepo)

```
Football-app/
├── src/                 # ← Backend API (Express + TypeScript) — المصدر الرئيسي
├── prisma/              # Schema + migrations + seed
├── public/              # Static assets للـ API (landing pages، share links، …)
├── scripts/             # سكربتات تشغيل/صيانة على مستوى الريبو
├── front/               # React Native / Expo (التطبيق)
├── docs/                # تقارير وتوثيق تقني
├── .kiro/               # Specs و steering docs (زي الملف ده)
├── package.json         # Backend dependencies + scripts
├── .env                 # Backend secrets (لا تُرفع على Git)
└── eas.json             # إعدادات EAS build للموبايل
```

> **مهم:** مجلد `Backend/` لو موجود بيكون فيه assets ثابتة قديمة. **مصدر الـ backend الحقيقي هو `src/` في جذر الريبو** — مش داخل `Backend/`.

---

## 3. الـ Tech Stack

### Backend (`/` — جذر الريبو)

| الطبقة | التقنية |
|--------|---------|
| Runtime | Node.js 18+ |
| Framework | Express.js |
| Language | TypeScript |
| Database | PostgreSQL (Neon / Railway في الإنتاج) |
| ORM | Prisma |
| Auth | Clerk (`@clerk/express`) |
| Cache / Queues | Redis + BullMQ |
| Media | Cloudflare R2 (صور/avatars) + Mux (reels) |
| Real-time | Socket.io |
| Football data | API-Football (api-sports.io) |
| AI / Chat | OpenRouter (Qwen + Gemini) |
| Monitoring | Sentry |

### Frontend (`front/`)

| الطبقة | التقنية |
|--------|---------|
| Framework | React Native + Expo SDK 55 |
| Routing | expo-router (file-based) |
| State | Zustand + React Query + Context |
| UI | Tamagui + NativeWind |
| Auth | `@clerk/clerk-expo` |
| Lists | FlashList |
| i18n | 8 لغات في `front/locales/` |
| Builds | EAS (Expo Application Services) |

---

## 4. التشغيل المحلي (Quick Start)

### المتطلبات

- Node.js 18+
- PostgreSQL (محلي أو Neon)
- Redis (مطلوب للـ queues والـ cache — بدونه الخدمات بتشتغل بـ in-memory fallback)
- حسابات: Clerk، API-Football، Mux، R2 (للتطوير الكامل)
- للموبايل: Expo CLI + Android Studio أو Xcode

### Backend

```bash
# من جذر الريبو
npm install
cp .env.example .env          # املأ القيم الفعلية
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed           # اختياري — بيانات تجريبية
npm run dev                   # http://localhost:3000
```

**Scripts مفيدة:**

| الأمر | الاستخدام |
|-------|-----------|
| `npm run prisma:studio` | واجهة DB على `localhost:5555` |
| `npm test` | Jest tests |
| `npm run check:external` | فحص اتصال الخدمات الخارجية |
| `npm run check:notifications` | فحص pipeline الإشعارات |

### Frontend

```bash
cd front
npm install
cp .env.example .env          # املأ EXPO_PUBLIC_* vars
npm start                     # Expo dev server (LAN)
# أو
npm run android / npm run ios / npm run web
```

**ربط التطبيق بالـ API المحلي:**

- Android emulator: `http://10.0.2.2:3000/api`
- iOS simulator: `http://localhost:3000/api`
- جهاز حقيقي على نفس الشبكة: IP الجهاز + `EXPO_PUBLIC_LOCAL_IP` في `front/.env`
- لازم `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` يطابق `CLERK_*` في backend (test keys للتطوير المحلي)

---

## 5. متغيرات البيئة (Environment)

| الملف | الغرض |
|-------|--------|
| `.env` (جذر الريبو) | كل secrets الـ backend |
| `.env.example` | قالب — **أضف أي متغير جديد هنا بقيمة placeholder** |
| `front/.env` | متغيرات Expo (`EXPO_PUBLIC_*` فقط — بتظهر في الكلاينت) |
| `front/.env.example` | قالب الفرونت |

**قواعد صارمة:**

1. **ممنوع** hardcode لـ secrets أو URLs في الكود.
2. Backend يقرأ env من `src/config/` فقط — مش مباشرة من `process.env` في أي مكان تاني.
3. Frontend يقرأ env من `front/config/api.config.ts`.
4. `EXPO_PUBLIC_*` = public — ممنوع تحط فيها secrets.

لتفاصيل migrations و cache keys: راجع `env-and-migrations.md`.

### أهم المتغيرات (ملخص)

| المتغير | أين | ليه |
|---------|-----|-----|
| `DATABASE_URL` | backend | PostgreSQL |
| `REDIS_URL` | backend | Cache + Bull queues |
| `CLERK_SECRET_KEY` | backend | Auth |
| `CLERK_PUBLISHABLE_KEY` | backend + front | Auth |
| `FOOTBALL_API_KEY` | backend | بيانات المباريات |
| `MUX_*` | backend | رفع ومعالجة reels |
| `R2_*` | backend | صور وملفات media |
| `OPENROUTER_API_KEY` | backend | Chat + Quiz AI |
| `EXPO_PUBLIC_API_URL` | front | عنوان الـ API |
| `EXPO_PUBLIC_WS_URL` | front | WebSocket |

---

## 6. هيكل الـ Backend (`src/`)

```
src/
├── main.ts              # نقطة الدخول — Express + cron + WebSocket
├── config/              # إعدادات من env (auth, storage, sentry, …)
├── controllers/         # HTTP handlers رفيعة — تفوّض للـ services
├── routes/              # Express routers + middleware composition
├── middleware/          # clerk, rbac, rate-limit, responseCache, …
├── services/            # Business logic (+ *-cache.service.ts)
├── queues/              # BullMQ background jobs
├── lib/                 # prisma.ts, redis.ts (singletons — استخدمهم فقط)
├── utils/               # Pure helpers
├── data/                # Static seed data (quiz questions, …)
├── scripts/             # One-off scripts داخل src
└── __tests__/           # Property-based tests (fast-check)
```

### قواعد Backend

- **Controllers رفيعة:** validate → call service → shape response. مفيش business logic جوا الـ controller.
- **Services** فيها المنطق وبتتشارك بين routes و queues و scripts.
- **Prisma** من `src/lib/prisma.ts` فقط — **Redis** من `src/lib/redis.ts` فقط.
- **Middleware** يتجمّع في `routes/` فقط: `router.post('/path', ...middleware, controller)`.
- Cache services: `<domain>-cache.service.ts` (مثال: `match-cache.service.ts`).
- Writes على أكتر من جدول → Prisma transaction.
- Auth: `clerk.middleware` + `rbac.middleware` للـ admin/developer.
- Rate limit على كل endpoint بيكتب أو بيتعلق بالـ auth.
- **ممنوع** تعديل migration مطبّق — اعمل migration جديد.

### Routes الموجودة (مرجع سريع)

```
auth, clerk-user, user, profile, profile-completion
football, matches, predictions, quiz
reels, upload, video, storage
chat, notification, coins, xp, lucky-wheel, daily-spin
reports, admin, gdpr, terms, support, analytics
news, i18n, app-version, webhook, mux-webhook
```

---

## 7. هيكل الـ Frontend (`front/`)

```
front/
├── app/                 # expo-router — الشاشات (file-based routes)
│   ├── (tabs)/          # التابات الرئيسية: Home, matches, quiz, reels, chat, …
│   ├── auth/            # تسجيل دخول / onboarding
│   ├── user/[username]  # بروفايلات ديناميكية
│   └── _layout.tsx      # Root layout
├── components/          # UI مجمّعة حسب feature
│   ├── common/, Home/, Matches/, reels/, Quiz/, chat/
│   ├── profile/, rank/, notifications/, auth/, tamagui/
├── services/            # API clients (*Api.ts, *Service.ts, *CacheService.ts)
├── hooks/               # Custom hooks (use*)
├── contexts/            # LanguageContext, CoinsContext, SettingsContext, …
├── src/
│   ├── store/           # Zustand stores
│   ├── services/        # authService, storageService, …
│   ├── storage/         # Persistent storage helpers
│   ├── hooks/           # Internal hooks
│   └── i18n/            # i18n setup
├── locales/             # en, ar, es, fr, de, it, pt, tr
├── constants/           # theme, ui, …
├── config/api.config.ts # API base URL + endpoints
└── utils/, types/, data/, assets/
```

### قواعد Frontend

- **Navigation:** expo-router فقط — ممنوع navigation library تانية.
- Screens في `app/` → default export. Components في `components/` → named export.
- **State:**
  - UI محلي → `useState`
  - Server data → React Query
  - Global app state → Zustand (`src/store/`)
  - Cross-cutting (لغة، عملات) → `contexts/`
- **i18n:** كل نص للمستخدم من `locales/` — ممنوع hardcode. العربي RTL: استخدم `start`/`end` مش `left`/`right`.
- Lists طويلة → `FlatList` / `FlashList` مع `keyExtractor` ثابت.
- Path alias: `@/*` → جذر `front/`.

### التابات الرئيسية

| التاب | الملف |
|-------|-------|
| Home | `app/(tabs)/Home.tsx` |
| Matches | `app/(tabs)/matches.tsx` |
| Quiz | `app/(tabs)/quiz.tsx` |
| Reels | `app/(tabs)/reels.tsx` |
| Chat | `app/(tabs)/chat.tsx` |
| Rank | `app/(tabs)/rank.tsx` |
| Profile | `app/(tabs)/profile.tsx` |
| Settings | `app/(tabs)/settings.tsx` |

---

## 8. خريطة الميزات (أين أشتغل؟)

| الميزة | Backend | Frontend |
|--------|---------|----------|
| مباريات مباشرة | `routes/football.routes.ts`, `routes/matches.routes.ts`, `services/match-cache.service.ts` | `app/(tabs)/matches.tsx`, `components/Matches/` |
| Reels | `routes/reels.routes.ts`, `routes/upload.routes.ts`, `services/video-processor.service.ts` | `app/(tabs)/reels.tsx`, `components/reels/` |
| Quiz | `routes/quiz.routes.ts` | `app/(tabs)/quiz.tsx`, `components/Quiz/` |
| توقعات | `routes/predictions.routes.ts` | `src/store/usePredictionsStore.ts` |
| Chat / AI | `routes/chat.routes.ts`, `services/chat.service.ts` | `app/(tabs)/chat.tsx`, `components/chat/` |
| إشعارات | `routes/notification.routes.ts`, `queues/` | `app/notifications.tsx`, `components/notifications/` |
| Gamification | `routes/coins.routes.ts`, `routes/xp.routes.ts`, … | `contexts/CoinsContext`, `app/(tabs)/rank.tsx` |
| Moderation | `routes/reports.routes.ts`, `routes/admin.routes.ts` | `app/settings/blocked-users.tsx` |
| Push (أهداف مباراة) | `services/match-events/`, `queues/match-event-push.queue.ts` | `hooks/useLiveFixture.ts`, push registration services |

---

## 9. قاعدة البيانات (Prisma)

**المصدر الوحيد:** `prisma/schema.prisma`  
**Migrations:** `prisma/migrations/` — كل migration في folder باسم `YYYYMMDDHHMMSS_snake_case_name/`

### Domains

| Domain | Models (أمثلة) |
|--------|------------------|
| Users & Auth | `User`, `Session`, `RefreshTokens` |
| Football | `Leagues`, `Teams`, `Players`, `Matches` |
| Quiz | `QuizCategories`, `QuizQuestions`, `QuizAttempts` |
| Social | `Follows`, `Reels`, `Likes`, `Comments` |
| Gamification | `CoinTransactions`, `Achievements`, `UserAchievements` |
| Moderation | `Reports`, `Notifications`, `Strikes` |

**قواعد:**

- Soft delete (`deletedAt`) لمحتوى المستخدم — ممنوع hard-delete.
- Index على الحقول اللي بتتعمل عليها query كتير (username, email, FKs).
- Workflow: عدّل schema → `npm run prisma:migrate` → commit الـ migration.sql.

### Invariants (لازم تفضل صحيحة دايمًا)

- رصيد العملات **مش سالب** أبدًا.
- التوقعات **idempotent** per (user, match).
- Quiz scoring **monotonic** — إجابة صح مش بتقلل النقاط.
- Strikes **بتتراكم** — ممنوع reset صامت.
- Age gating قبل features الاجتماعية.

---

## 10. اتفاقيات الـ API

- **Base path:** `/api`
- **REST:** أفعال HTTP + أسماء جمع (`/api/users`, `/api/reels`)
- **Success:** `{ data: <payload>, message?: string }`
- **Pagination:** `{ data: [...], total, page, limit }` — default `limit = 20`
- **Error:** `{ error: "E0xx", message, details?, timestamp, path }` — أكواد E001–E010
- **Versioning:** `/api/v2/...` للتغييرات breaking فقط
- **ممنوع** إرجاع internal IDs حساسة أو tokens أو password hashes

---

## 11. الأدوار (RBAC)

| Role | الصلاحيات |
|------|-----------|
| User | الافتراضي — reels، توقعات، quiz، متابعة |
| Developer | أدوات داخلية + debug endpoints |
| Admin | Moderation، إدارة مستخدمين، strikes |

> الـ RBAC على السيرفر فقط. ممنوع الاعتماد على checks في الكلاينت لوحده.

---

## 12. الاختبارات

| النوع | المكان | الأداة |
|-------|--------|--------|
| Backend property tests | `src/__tests__/` | fast-check + Jest |
| Backend unit tests | `src/services/__tests__/` | Jest |
| Frontend tests | `front/**/__tests__/` | Jest + Testing Library |
| Integration | scripts في `scripts/` | ts-node ضد API حقيقي |

**Mock** Clerk, Redis, APIs خارجية في unit tests.  
**Property tests** تستهدف invariants: coins، predictions، quiz scoring.

---

## 13. النشر (Deployment)

| الجزء | المنصة | ملاحظات |
|-------|--------|---------|
| Backend API | Railway | `npm run build` → `node dist/src/main.js` |
| Database | Neon PostgreSQL | `DATABASE_URL` على Railway |
| Redis | Railway / Upstash | `REDIS_URL` |
| Mobile builds | EAS | `front/` — `eas build` |
| Media CDN | Cloudflare R2 + Mux | Reels على Mux، صور على R2 |
| Auth | Clerk | test keys محلي، live keys على production |

**Production URLs:**

- API: `https://90plus.pro/api`
- WebSocket: `wss://90plus.pro`
- Share links: `https://90plus.pro` (مش `/api`)

---

## 14. إضافة كود جديد — Checklist

### Backend feature جديد

1. `src/routes/<feature>.routes.ts`
2. `src/controllers/<feature>.controller.ts`
3. `src/services/<feature>.service.ts`
4. Cache service لو البيانات hot: `src/services/<feature>-cache.service.ts`
5. سجّل الـ route في `src/main.ts`
6. Migration لو في schema change
7. Env vars في `.env` + `.env.example`
8. Property test لو بيلمس coins / predictions / quiz

### Frontend screen جديد

1. Screen في `front/app/` (تابات في `app/(tabs)/`)
2. UI قابل لإعادة الاستخدام في `front/components/<Feature>/`
3. Data fetching في `front/services/`
4. Logic في `front/hooks/`
5. مفاتيح ترجمة في **كل** ملفات `front/locales/` (على الأقل `en.ts` + `ar.ts`)

### قبل الـ PR

- [ ] `npm run lint` (backend + front)
- [ ] `npm test` للملفات المتأثرة
- [ ] مفيش secrets في الكود
- [ ] مفيش `console.log` — استخدم logger
- [ ] RTL-safe للنصوص العربية
- [ ] RBAC على السيرفر للعمليات الحساسة

---

## 15. ملفات مرجعية تانية في الريبو

| الملف | المحتوى |
|-------|---------|
| `.kiro/steering/product.md` | دليل المنتج والـ domain language |
| `.kiro/steering/env-and-migrations.md` | Env, migrations, Redis cache keys |
| `.kiro/steering/Mr.dev.md` | قواعد الكود التفصيلية للـ AI والمطورين |
| `README.md` | Quick start للـ backend |
| `front/TAMAGUI_SETUP.md` | إعداد Tamagui |
| `docs/` | تقارير push, audit, … |

---

## 16. خدمات خارجية (External Services)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Expo App   │────▶│  Express API │────▶│  PostgreSQL     │
│  (front/)   │ WS  │  (src/)      │     │  (Neon)         │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
    ┌─────────┐      ┌─────────┐      ┌──────────┐
    │  Clerk  │      │  Redis  │      │ API-Foot │
    │  (Auth) │      │ (Cache) │      │  ball    │
    └─────────┘      └─────────┘      └──────────┘
         │                 │
         ▼                 ▼
    ┌─────────┐      ┌─────────┐      ┌──────────┐
    │   Mux   │      │   R2    │      │OpenRouter│
    │ (Reels) │      │ (Media) │      │ (AI/Chat)│
    └─────────┘      └─────────┘      └──────────┘
```

---

*آخر تحديث: يونيو 2026 — لو لقيت حاجة قديمة في الملف، حدّثها أو بلّغ صاحب الريبو.*
