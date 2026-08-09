# دليل عمر — AI + بيانات الكرة لنظام الأسئلة

وثيقة للمطوّر **عمر**: كل الـ endpoints اللي تحتاجها عشان تبني نظام أسئلة (quiz) على بيانات 90Plus، وتستخدم الـ AI بتاعنا، وتجيب شعارات أندية / صور لاعبين / بطولات / إحصائيات.

> **Base path:** كل المسارات تحت `/api`  
> **Production:** `https://90plus.pro/api`  
> **Local:** `http://localhost:3000/api` (أو بورت السيرفر عندكم)

---

## 0) قبل ما تبدأ — قواعد مهمة

| قاعدة | التفاصيل |
|--------|----------|
| مفيش `POST /api/ai/generate` | مفيش endpoint عام اسمه "ولّد سؤال". التوليد إما عبر **الشات** أو عبر **كويز يومي جاهز من السيرفر**. |
| مفيش endpoint اسمه "أسطورة / legends" | قائمة الأساطير (زيدان، مارادونا، بيليه…) **داخلية** في الكود (`quiz-image-legends.ts`) عشان صور اللاعبين المعتزلين ضعيفة. تقدر تبحث عن أسمائهم عادي من endpoints البحث. |
| مصدرين للبيانات | **API-Football** (IDs فرق/دوريات/إحصائيات) + **365Scores** (صور لاعبين أقوى غالباً، `athleteId` مختلف عن API-Football). |
| Auth | الشات والكويز = **Clerk JWT**. معظم `/api/football/*` = **Public** (من غير توكن). |
| Headers مفيدة | `Authorization: Bearer <token>` · `x-user-timezone: Africa/Cairo` · `x-user-language: ar` أو `en` · `Content-Type: application/json` |

شكل الرد الشائع لـ football:

```json
{ "status": "SUCCESS", "response": { ... } }
```

أو أحياناً:

```json
{ "status": "SUCCESS", "results": 10, "response": [ ... ] }
```

---

## 1) الـ AI — إزاي تطلب منه يولّد سؤال أو يعمل حاجة

### 1.1 `POST /api/chat/stream` — الأهم للـ AI

**بتعمل إيه؟** تبعت رسالة للنموذج (Gemini / Bedrock / OpenRouter) ويردّ **SSE streaming**. الشات عنده tools داخلية لكرة القدم (بحث لاعب، ترتيب، هدافين…) فممكن يجاوب من بيانات حقيقية.

**Auth:** Clerk مطلوب.

**Body:**

```json
{
  "message": "ولد سؤال اختيار من متعدد عن هداف الدوري الإنجليزي مع 4 اختيارات وصحح الإجابة",
  "history": [],
  "conversationId": null,
  "preferredLanguage": "ar",
  "systemPromptSuffix": "أجب JSON فقط بدون شرح"
}
```

| حقل | مطلوب؟ | معنى |
|-----|--------|------|
| `message` | نعم | نص الطلب |
| `history` | لا | رسائل سابقة `[{role, content}]` |
| `conversationId` | لا | لو فاضي يعمل محادثة جديدة |
| `preferredLanguage` | لا | `ar` / `en` |
| `systemPromptSuffix` | لا | تعليمات إضافية (مثلاً: رجّع JSON) |
| `resumeFromToken` | لا | استكمال stream متقطع |

**مثال curl:**

```bash
curl -N -X POST "https://90plus.pro/api/chat/stream" \
  -H "Authorization: Bearer YOUR_CLERK_JWT" \
  -H "Content-Type: application/json" \
  -H "x-user-language: ar" \
  -H "x-user-timezone: Africa/Cairo" \
  -d "{\"message\":\"اقترح سؤال: من اللاعب في الصورة؟ مع 4 أسماء\",\"preferredLanguage\":\"ar\"}"
```

**شكل الـ SSE:**

```
data: {"token":"من هو..."}
data: {"token":"؟"}
data: {"done":true,"remaining":12,"limit":20,"resetAt":"..."}
```

**ملاحظات لعمر:**
- في حد يومي للرسائل → شوف `/api/chat/limit`.
- لو الـ AI متوقف مؤقتاً هيرجع `503`.
- استخدمه لتوليد **نص السؤال / الاختيارات**، وجيب الصور/الأرقام من football endpoints تحت.

---

### 1.2 باقي الشات (مفيدة بس مش أساسية للكويز)

| Method | Path | الوظيفة |
|--------|------|---------|
| `GET` | `/api/chat/limit` | كام رسالة باقية اليوم |
| `POST` | `/api/chat/transcribe` | صوت → نص (`multipart` field: `audio`) |
| `GET` | `/api/conversations` | قائمة محادثات المستخدم |
| `POST` | `/api/conversations` | إنشاء محادثة `{ "title": "..." }` |
| `GET` | `/api/conversations/:id/messages` | رسائل محادثة |
| `PATCH` | `/api/conversations/:id` | إعادة تسمية / تثبيت |
| `DELETE` | `/api/conversations/:id` | حذف محادثة |

كلها Clerk.

---

### 1.3 `POST /api/i18n/football-names` — ترجمة أسماء (Public)

**بتعمل إيه؟** ترجمة batch لأسماء فرق / دوريات / بلاد بالـ AI + كاش سيرفر.

```bash
curl -X POST "https://90plus.pro/api/i18n/football-names" \
  -H "Content-Type: application/json" \
  -d "{\"texts\":[\"Manchester United\",\"Premier League\",\"Egypt\"],\"targetLang\":\"ar\"}"
```

```json
{
  "translations": {
    "Manchester United": "مانشستر يونايتد",
    "Premier League": "الدوري الإنجليزي الممتاز",
    "Egypt": "مصر"
  },
  "targetLang": "ar"
}
```

حدود: من 1 لـ 200 نص، كل نص لحد 200 حرف.

---

## 2) كويز يومي جاهز عندنا (اختياري لو هتبني نظامك الخاص)

توليد الباك اليومي **من السيرفر (cron)** — مفيش endpoint "generate" للكلاينت.

| Method | Path | Body / Query | الوظيفة |
|--------|------|--------------|---------|
| `GET` | `/api/quiz/daily?language=ar` | — | باك أسئلة اليوم + `imageUrl` لو موجود |
| `POST` | `/api/quiz/answer` | `{ questionId, selectedKey: "A"\|"B"\|"C"\|"D", timeTaken?, language? }` | تسليم إجابة |
| `POST` | `/api/quiz/skip` | `{ questionId, language? }` | تخطي (عملات) |
| `POST` | `/api/quiz/hint` | `{ questionId, language? }` | تلميح (عملات) |
| `POST` | `/api/quiz/timeout` | `{ questionId, language? }` | انتهى الوقت |

**Auth:** Clerk + يفضّل `x-user-timezone`.

**لو باك لسه بيتولّد:** `503` مع `PACK_GENERATING`.

**لو بتبني نظام أسئلة مستقل:** استخدم القسم 3 و 4؛ الكويز اليومي ده منتج جاهز للمستخدمين مش API بيانات خام.

---

## 3) البحث — أهم جزء لنظام الأسئلة

### 3.1 بحث موحّد (لاعب + فريق + دوري)

#### `GET /api/football/search?q=`

- **Public**
- `q` لازم حرفين على الأقل
- يرجّع players / teams / leagues

```bash
# بحث عن لاعب
curl "https://90plus.pro/api/football/search?q=Messi"

# بحث عن فريق
curl "https://90plus.pro/api/football/search?q=Al%20Ahly"

# بحث عن دوري / بطولة
curl "https://90plus.pro/api/football/search?q=Premier%20League"

# أسطوري (معتزل) — البحث بالاسم عادي؛ الصورة ممكن تبقى ضعيفة على API-Football
curl "https://90plus.pro/api/football/search?q=Zidane"
curl "https://90plus.pro/api/football/search?q=Maradona"
```

شكل تقريبي للرد:

```json
{
  "status": "SUCCESS",
  "response": {
    "players": [
      { "id": 154, "name": "L. Messi", "photo": "https://...", "team": "Inter Miami", "type": "player" }
    ],
    "teams": [
      { "id": 541, "name": "Real Madrid", "logo": "https://...", "country": "Spain", "type": "team" }
    ],
    "leagues": [
      { "id": 39, "name": "Premier League", "logo": "https://...", "country": "England", "type": "league" }
    ]
  }
}
```

#### `GET /api/football/cached/search?q=`

نفس الفكرة من **كاش PostgreSQL** (أسرع وأرخص على الـ upstream). يفضّل تستخدمه في الإنتاج.

```bash
curl "https://90plus.pro/api/football/cached/search?q=Salah"
```

يرجّع كمان `matches` أحياناً + `_meta.fromCache`.

---

### 3.2 صور لاعبين من 365Scores (مفضّل للكويز المرئي)

IDs هنا اسمها **`athleteId`** — **مش** نفس ID بتاع API-Football.

#### `GET /api/football/cached/365/search?q=`

بحث سريع عن لاعبين + `imageUrl`.

```bash
curl "https://90plus.pro/api/football/cached/365/search?q=Trezeguet" \
  -H "x-user-language: ar"
```

#### `GET /api/football/cached/365/player/lookup` ⭐ الأفضل

بحث + بروفايل + كارير في طلب واحد.

| Query | معنى |
|-------|------|
| `q` | اسم اللاعب (من حرفين) **أو** |
| `athleteId` | لو عندك الـ ID خلاص |
| `limit` | عدد النتائج (افتراضي 1، لحد 5) |
| `info=false` | تعطيل البروفايل |
| `career=false` | تعطيل الكارير |

```bash
# بالاسم
curl "https://90plus.pro/api/football/cached/365/player/lookup?q=Mohamed%20Salah&limit=3"

# بـ athleteId مباشرة
curl "https://90plus.pro/api/football/cached/365/player/lookup?athleteId=51735"

# أسطوري
curl "https://90plus.pro/api/football/cached/365/player/lookup?q=Ronaldinho"
```

شكل تقريبي:

```json
{
  "status": "SUCCESS",
  "source": "365scores",
  "response": {
    "query": "Mohamed Salah",
    "players": [
      {
        "athleteId": 12345,
        "name": "Mohamed Salah",
        "shortName": "Salah",
        "clubName": "Liverpool",
        "imageUrl": "https://imagecache.365scores.com/...",
        "info": { "position": "...", "nationality": "..." },
        "career": { "seasons": [], "trophies": [] }
      }
    ]
  }
}
```

#### تفاصيل لاعب 365 بعد ما عندك `athleteId`

```bash
curl "https://90plus.pro/api/football/cached/365/player/51735/info"
curl "https://90plus.pro/api/football/cached/365/player/51735/career"
```

---

### 3.3 ملاحظة «الأساطير»

- **مفيش** `/api/football/legends` ولا endpoint بالعربي «أسطورة».
- داخلياً عندنا قائمة أسماء معتزلين (زيدان، مالدينى، بيليه، مارادونا، رونالدينيو، هنري، بيرلو…) في `src/services/quiz-image-legends.ts`.
- استخدامها عندنا: لو سؤال `guess_player` بيعتمد على صورة فقط، والاسم أسطوري، غالباً الصورة مش موثوقة → بنحوّل لنص أو نتجاهل الصورة.
- **أنت كعمر:** ابحث بالاسم عادي (`search` أو `365/player/lookup`). لو الصورة ناقصة/سيئة، خلّي السؤال نصّي أو استخدم شعار النادي بدل صورة اللاعب.

---

## 4) شعارات أندية وبطولات + بروفايلات

### 4.1 فرق وشعارات

| Method | Path | إزاي تستخدمه |
|--------|------|----------------|
| `GET` | `/api/football/teams/:id` | فريق بالـ ID → فيه `logo` |
| `GET` | `/api/football/cached/team/:id` | نفس الفكرة من الكاش |
| `GET` | `/api/football/cached/teams/batch?ids=33,50,541` | لحد 20 فريق مرة واحدة |
| `GET` | `/api/football/cached/teams/all?country=Egypt&limit=100` | كل الفرق المتخزنة |
| `GET` | `/api/football/teams/top-by-country?country=Egypt` | أندية مشهورة لبلد (للـ picker) |
| `GET` | `/api/football/teams/top-supported-countries` | قائمة البلاد المدعومة للـ picker |
| `GET` | `/api/football/teams/:id/squad` | تشكيلة الفريق (أسماء ± صور) |

```bash
# شعار ريال مدريد (مثال ID — اتأكد من search أولاً)
curl "https://90plus.pro/api/football/cached/team/541"

# أندية مصر الشهيرة
curl "https://90plus.pro/api/football/teams/top-by-country?country=Egypt"

# دفعة شعارات
curl "https://90plus.pro/api/football/cached/teams/batch?ids=33,40,42,47,49,50"
```

تدفق موصى به لسؤال «ما هذا الشعار؟»:

1. `GET /cached/search?q=Barcelona` → خد `teams[0].id` و `logo`
2. أو لو عندك ID: `GET /cached/team/529`

---

### 4.2 دوريات / بطولات وشعاراتها

| Method | Path | ملاحظات |
|--------|------|---------|
| `GET` | `/api/football/leagues?country=England` | فلترة |
| `GET` | `/api/football/leagues/all` | كل الدوريات من الكاش + logos |
| `GET` | `/api/football/search?q=Champions%20League` | أسرع لو عارف الاسم |

```bash
curl "https://90plus.pro/api/football/leagues/all"
curl "https://90plus.pro/api/football/search?q=%D9%83%D8%A3%D8%B3%20%D8%A7%D9%84%D8%B9%D8%A7%D9%84%D9%85"
```

---

### 4.3 لاعب من API-Football (ID مختلف عن 365)

```bash
curl "https://90plus.pro/api/football/players/154?season=2024"
curl "https://90plus.pro/api/football/cached/player/154"
```

استخدمه للإحصائيات/الموسم. **للصورة في الكويز** فضّل مسار 365 (`lookup`).

---

## 5) إحصائيات وأرقام (أهداف، ترتيب، بطاقات…)

### IDs دوريات شائعة (API-Football)

| ID | البطولة |
|----|---------|
| 39 | Premier League |
| 140 | La Liga |
| 135 | Serie A |
| 78 | Bundesliga |
| 61 | Ligue 1 |
| 2 | Champions League |
| 3 | Europa League |
| 1 | World Cup |
| 233 | الدوري المصري |
| 307 | دوري روشن السعودي |

`season` غالباً سنة بداية الموسم (مثلاً `2024` لموسم 2024/25). لو مش مبعوت، بعض endpoints بتفترض قيمة افتراضية.

### Endpoints الإحصائيات

| Method | Path | مثال |
|--------|------|------|
| `GET` | `/api/football/players/top/scorers?league=39&season=2024` | هدافين |
| `GET` | `/api/football/players/top/assists?league=39&season=2024` | صناعات |
| `GET` | `/api/football/players/top/yellow-cards?league=39&season=2024` | صفراء |
| `GET` | `/api/football/players/top/red-cards?league=39&season=2024` | حمراء |
| `GET` | `/api/football/standings?league=39&season=2024` | ترتيب |
| `GET` | `/api/football/standings/39` | نفس الترتيب (path) |
| `GET` | `/api/football/cached/standings/39?season=2024` | ترتيب من الكاش |
| `GET` | `/api/football/teams/:id/statistics?league=39&season=2024` | إحصائيات فريق |
| `GET` | `/api/football/fixtures/:id/statistics` | إحصائيات مباراة |
| `GET` | `/api/football/fixtures/:id/events` | أهداف/بطاقات/تبديل في ماتش |
| `GET` | `/api/football/h2h?team1=33&team2=40&count=10` | مواجهات مباشرة |
| `GET` | `/api/football/cached/h2h?team1=33&team2=40` | H2H كاش |
| `GET` | `/api/football/venues/:id` | ملعب (سؤال ستاد) |
| `GET` | `/api/football/teams/:id/trophies` | بطولات الفريق |
| `GET` | `/api/football/transfers?player=154` | انتقالات لاعب |

```bash
# سؤال: مين هداف البريميرليج؟
curl "https://90plus.pro/api/football/players/top/scorers?league=39&season=2024"

# سؤال: مين أول الدوري المصري؟
curl "https://90plus.pro/api/football/cached/standings/233"

# سؤال: كام هدف سجل الفريق في الموسم؟
curl "https://90plus.pro/api/football/teams/33/statistics?league=39&season=2024"
```

---

## 6) سيناريوهات جاهزة لنظام الأسئلة (Workflow)

### أ) سؤال «من هذا اللاعب؟» (صورة)

1. `GET /api/football/cached/365/player/lookup?q=Salah&limit=1`
2. خد `players[0].imageUrl` + `name`
3. (اختياري) اطلب من AI عبر `/api/chat/stream` يولّد 3 أسماء غلط قريبة
4. ابنِ السؤال: صورة + 4 اختيارات

### ب) سؤال «ما هذا الشعار؟»

1. `GET /api/football/cached/search?q=Al%20Ahly`
2. خد `teams[0].logo` + `name`
3. اختيارات غلط من فرق نفس البلد: `GET /teams/top-by-country?country=Egypt`

### ج) سؤال «ما هذه البطولة؟»

1. `GET /api/football/search?q=World%20Cup` أو `/leagues/all`
2. استخدم `leagues[].logo` + `name`

### د) سؤال إحصائي «من هداف …؟»

1. `GET /players/top/scorers?league=39&season=2024`
2. أول لاعب = الإجابة الصحيحة
3. اختيارات غلط = اللاعبين 2–4 أو أسماء من دوري تاني

### هـ) سؤال عن أسطوري معتزل

1. ابحث بالاسم: `lookup?q=Zidane` أو `search?q=Zidane`
2. لو `imageUrl` فاضي/سيئ → سؤال **نصي** («في أي نادٍ لعب زيدان أطول فترة؟») مش تخمين من صورة
3. ممكن تستخدم شعار النادي التاريخي بدل وجه اللاعب

### و) توليد نص السؤال بالـ AI بعد ما عندك الداتا

```json
POST /api/chat/stream
{
  "message": "عندي بيانات JSON التالية: {\"player\":\"Salah\",\"goals\":20,\"league\":\"Premier League\"}. ولّد سؤال اختيار من متعدد بالعربي، 4 اختيارات، وحدد الإجابة الصحيحة كمفتاح A/B/C/D. رجّع JSON فقط.",
  "preferredLanguage": "ar",
  "systemPromptSuffix": "Output valid JSON only: {question, options:{A,B,C,D}, correctKey}"
}
```

---

## 7) Headers كاملة — نسخة تنسخها

```http
Authorization: Bearer <CLERK_JWT>   # للشات والكويز فقط
Content-Type: application/json
x-user-timezone: Africa/Cairo
x-user-language: ar
```

Football endpoints غالباً تشتغل من غير Authorization.

---

## 8) أخطاء شائعة هتشوفها

| Status / رسالة | المعنى |
|----------------|--------|
| `400` — `q` must be at least 2 characters | قصّر البحث |
| `401` / Unauthorized | ناقص أو باطل Clerk token |
| `404` — No players found | الاسم مش لاقيه على 365 — جرّب تهجئة إنجليزي |
| `503` — PACK_GENERATING | باك الكويز اليومي لسه بيتجهز |
| `503` — AI temporarily unavailable | الشات متوقف مؤقتاً |
| `503` — Football / 365 unavailable | upstream أو إعدادات السيرفر |

---

## 9) خريطة سريعة «عايز إيه → أنادي إيه»

| عايز | Endpoint |
|------|----------|
| AI يولّد / يكتب سؤال | `POST /api/chat/stream` |
| ترجمة أسماء | `POST /api/i18n/football-names` |
| بحث لاعب/فريق/دوري | `GET /api/football/cached/search?q=` |
| صورة لاعب قوية | `GET /api/football/cached/365/player/lookup?q=` |
| شعار نادي | `GET /api/football/cached/team/:id` أو من نتائج البحث `logo` |
| شعار بطولة | من `/search` أو `/leagues/all` → `logo` |
| هدافين / أرقام | `/players/top/scorers` + باقي top/* |
| ترتيب دوري | `/cached/standings/:leagueId` |
| كويز يومي جاهز للمستخدم | `GET /api/quiz/daily` |
| قائمة أساطير جاهزة كـ API | **غير موجودة** — ابحث بالاسم |

---

## 10) ملفات الكود لو حابب تتعمّق

| ملف | محتوى |
|-----|--------|
| `src/routes/chat.routes.ts` | AI chat |
| `src/routes/quiz.routes.ts` | Daily quiz |
| `src/routes/i18n.routes.ts` | ترجمة أسماء |
| `src/routes/football.routes.ts` | كل football routes |
| `src/controllers/football.controller.ts` | منطق الطلبات |
| `src/services/quiz-image-legends.ts` | قائمة الأسماء الأسطورية الداخلية |
| `src/services/quiz-image-enricher.service.ts` | إزاي بنجيب صور أسئلة الكويز داخلياً |

---

**آخر تحديث للوثيقة:** مبني على مسارات Express الحالية في الريبو (`/api/chat`, `/api/quiz`, `/api/i18n`, `/api/football`). لو اتغير route، راجع الملفات فوق.
