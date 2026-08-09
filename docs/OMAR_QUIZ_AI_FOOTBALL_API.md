# دليل عمر — بناء نظام أسئلة ببيانات 90Plus (من غير الشات)

وثيقة عملية للمطوّر **عمر**: إزاي تجيب **صور لاعبين، شعارات أندية، بطولات، إحصائيات وأرقام** من الـ API، وتبني بيها نظام أسئلة.

> **Base:** `https://90plus.pro/api`  
> **Local:** `http://localhost:3000/api`  
> معظم `/api/football/*` = **Public** (من غير توكن)

---

## الخلاصة السريعة (اقرأ دي الأول)

| عايز تعمل إيه؟ | فيه endpoint؟ | تستخدم إيه؟ |
|----------------|---------------|-------------|
| تجيب صورة لاعب | نعم | `GET /api/football/cached/365/player/lookup?q=` |
| تجيب شعار نادي | نعم | بحث أو `GET /api/football/cached/team/:id` |
| تجيب شعار بطولة / دوري | نعم | بحث أو `GET /api/football/leagues/all` |
| تجيب هدافين / ترتيب / أرقام | نعم | `/players/top/*` و `/cached/standings/:id` |
| تبحث بالاسم (لاعب/فريق/دوري) | نعم | `GET /api/football/cached/search?q=` |
| تخلي **AI السيرفر يولّد سؤال** من غير الشات | **لا** | مفيش `/api/ai/generate` ولا `/api/quiz/generate` للعميل |
| كويز يومي جاهز للمستخدم النهائي | نعم (Clerk) | `GET /api/quiz/daily` — مش API بيانات خام لنظامك |

**معنى الكلام:** نظام الأسئلة بتاعك يشتغل كده:

1. تنادي football endpoints وتجيب الداتا (اسم + صورة/شعار + رقم).
2. **أنت** بتبني السؤال والاختيارات في كودك (أو في الـ AI بتاع مشروعك إن وُجد).
3. مفيش حالياً endpoint منفصل عن الشات يخلّي AI 90Plus يولّد لك باك أسئلة.

الشات (`POST /api/chat/stream`) موجود لو محتاج توليد نص لاحقاً، بس **الوثيقة دي مش معتمدة عليه** — ركّز على مسارات البيانات تحت.

---

## 0) قواعد أساسية

1. **شكل الرد الغالب:**
   ```json
   { "status": "SUCCESS", "response": { ... } }
   ```
2. **البحث:** `q` لازم حرفين على الأقل.
3. **اتنين مصادر IDs:**
   - **API-Football** → `teamId` / `playerId` / `leagueId` (إحصائيات وترتيب وشعارات أندية).
   - **365Scores** → `athleteId` (صور لاعبين أقوى غالباً) — **مش نفس رقم** API-Football.
4. **مفيش endpoint اسمه أسطورة / legends.** ابحث بالاسم عادي. صور المعتزلين (زيدان، مارادونا…) ممكن تبقى ضعيفة → فضّل سؤال نصي أو شعار نادي.
5. Headers اختيارية مفيدة: `x-user-language: ar` · `Content-Type: application/json`

---

## 1) التدفق الموصى به لنظامك

```
بحث بالاسم
   ↓
اختر كيان (لاعب / فريق / دوري)
   ↓
هات الصورة أو الشعار أو الإحصائية
   ↓
ابنِ السؤال في كودك:
  - نص السؤال
  - 4 اختيارات
  - الإجابة الصحيحة
  - imageUrl / logoUrl لو السؤال مرئي
```

### مثال سريع: سؤال «من هذا اللاعب؟»

```bash
# 1) هات اللاعب + الصورة
curl "https://90plus.pro/api/football/cached/365/player/lookup?q=Mohamed%20Salah&limit=1"
```

من الرد خد:

- `response.players[0].name` → الإجابة الصحيحة  
- `response.players[0].imageUrl` → صورة السؤال  
- اختيارات غلط → اعمل lookup لأسماء قريبة أو من نفس النادي

### مثال سريع: سؤال «ما هذا الشعار؟»

```bash
curl "https://90plus.pro/api/football/cached/search?q=Al%20Ahly"
```

من `response.teams[0]`:

- `logo` → صورة السؤال  
- `name` → الإجابة الصحيحة  
- اختيارات غلط → فرق تانية من `GET /api/football/teams/top-by-country?country=Egypt`

### مثال سريع: سؤال إحصائي «مين هداف البريميرليج؟»

```bash
curl "https://90plus.pro/api/football/players/top/scorers?league=39&season=2024"
```

- أول لاعب في `response` = الإجابة  
- اللي بعده = اختيارات غلط  
- تقدر تعرض صورتهم عبر `lookup?q=<اسم>` لو حابب سؤال مرئي

---

## 2) البحث (نقطة البداية دايماً)

### 2.1 بحث موحّد — لاعب + فريق + دوري

```http
GET /api/football/cached/search?q=Salah
```

بديل مباشر (من غير كاش ثقيل أحياناً):

```http
GET /api/football/search?q=Salah
```

**أمثلة:**

```bash
curl "https://90plus.pro/api/football/cached/search?q=Messi"
curl "https://90plus.pro/api/football/cached/search?q=Real%20Madrid"
curl "https://90plus.pro/api/football/cached/search?q=Premier%20League"
curl "https://90plus.pro/api/football/cached/search?q=Zidane"
```

**شكل الرد (تقريبي):**

```json
{
  "status": "SUCCESS",
  "response": {
    "players": [
      { "id": 154, "name": "L. Messi", "photo": "https://...", "team": "...", "type": "player" }
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

**استخدم من هنا:**
- سؤال لاعب نصي → `players[].name` / `photo`
- سؤال شعار نادي → `teams[].logo` + `name`
- سؤال بطولة → `leagues[].logo` + `name`

> للصور القوية للاعبين، متوقفش عند `photo` هنا — كمّل بـ **365 lookup** تحت.

---

## 3) صور اللاعبين (365Scores) ⭐

ده المسار الأساسي لأسئلة «خمن اللاعب من الصورة».

### 3.1 البحث + الصورة + البروفايل في طلب واحد

```http
GET /api/football/cached/365/player/lookup?q=NAME
GET /api/football/cached/365/player/lookup?athleteId=ID
```

| Query | مطلوب؟ | معنى |
|-------|--------|------|
| `q` | نعم* | اسم اللاعب (حرفين+) |
| `athleteId` | نعم* | لو عندك الـ ID خلاص (*واحد من الاتنين) |
| `limit` | لا | عدد النتائج (1–5، افتراضي 1) |
| `info=false` | لا | تعطيل البروفايل |
| `career=false` | لا | تعطيل الكارير |

```bash
curl "https://90plus.pro/api/football/cached/365/player/lookup?q=Mohamed%20Salah&limit=3"
curl "https://90plus.pro/api/football/cached/365/player/lookup?q=Trezeguet" -H "x-user-language: ar"
curl "https://90plus.pro/api/football/cached/365/player/lookup?athleteId=51735"
```

**اللي تاخده للسؤال:**

| حقل | استخدامه في الكويز |
|-----|---------------------|
| `players[].imageUrl` | صورة السؤال |
| `players[].name` | الإجابة الصحيحة |
| `players[].clubName` | تلميح أو سؤال فرعي |
| `players[].career` | أرقام/أندية لصياغة أسئلة نصية |

### 3.2 بحث أسماء فقط (من غير كارير)

```http
GET /api/football/cached/365/search?q=Salah
```

### 3.3 بعد ما عندك `athleteId`

```http
GET /api/football/cached/365/player/:athleteId/info
GET /api/football/cached/365/player/:athleteId/career
```

### 3.4 الأساطير / المعتزلين

- مفيش `/legends`.
- ابحث بالاسم: `lookup?q=Ronaldinho` أو `Zidane` أو `Maradona`.
- لو `imageUrl` فاضي أو سيئ → **متعملش guess-from-photo**؛ اعمل سؤال نصي («في أي نادٍ لعب…؟») أو استخدم شعار النادي.

---

## 4) شعارات الأندية

### بعد البحث

من `cached/search` → `teams[].id` و `teams[].logo`.

### بالـ ID مباشرة

```http
GET /api/football/cached/team/:id
GET /api/football/teams/:id
```

```bash
curl "https://90plus.pro/api/football/cached/team/541"
```

### دفعة شعارات (لحد 20)

```http
GET /api/football/cached/teams/batch?ids=33,40,42,47,49,50
```

### أندية مشهورة حسب البلد (اختيارات غلط سهلة)

```http
GET /api/football/teams/top-supported-countries
GET /api/football/teams/top-by-country?country=Egypt
```

```bash
curl "https://90plus.pro/api/football/teams/top-by-country?country=Egypt"
curl "https://90plus.pro/api/football/teams/top-by-country?country=England"
```

### تشكيلة فريق (أسماء لاعبين من نفس النادي)

```http
GET /api/football/teams/:id/squad
```

مفيدة لاختيارات غلط في سؤال لاعب.

---

## 5) شعارات البطولات / الدوريات

```http
GET /api/football/leagues/all
GET /api/football/leagues?country=England
GET /api/football/cached/search?q=Champions%20League
```

من النتيجة خد `logo` + `name` + `id`.

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

`season` = سنة بداية الموسم (مثلاً `2024` لـ 2024/25).

---

## 6) إحصائيات وأرقام

| الغرض | Endpoint |
|--------|----------|
| هدافين | `GET /api/football/players/top/scorers?league=39&season=2024` |
| صناعات | `GET /api/football/players/top/assists?league=39&season=2024` |
| صفراء | `GET /api/football/players/top/yellow-cards?league=39&season=2024` |
| حمراء | `GET /api/football/players/top/red-cards?league=39&season=2024` |
| ترتيب دوري | `GET /api/football/cached/standings/39?season=2024` |
| ترتيب (بديل) | `GET /api/football/standings?league=39&season=2024` |
| إحصائيات فريق | `GET /api/football/teams/:id/statistics?league=39&season=2024` |
| أحداث مباراة (أهداف…) | `GET /api/football/fixtures/:id/events` |
| إحصائيات مباراة | `GET /api/football/fixtures/:id/statistics` |
| مواجهات مباشرة | `GET /api/football/h2h?team1=33&team2=40&count=10` |
| بطولات فريق | `GET /api/football/teams/:id/trophies` |
| ملعب | `GET /api/football/venues/:id` |
| انتقالات لاعب | `GET /api/football/transfers?player=154` |

```bash
curl "https://90plus.pro/api/football/players/top/scorers?league=39&season=2024"
curl "https://90plus.pro/api/football/cached/standings/233"
curl "https://90plus.pro/api/football/teams/33/statistics?league=39&season=2024"
```

**إزاي تحولها لسؤال في كودك:**

1. هات قائمة الهدافين.
2. السؤال: «من هو هداف الدوري الإنجليزي موسم 2024/25؟»
3. `options.A` = أول لاعب (صح) · `B/C/D` = اللي بعده أو أسماء قريبة.
4. اختياري: اعمل `lookup?q=` لكل اختيار لو عايز صور على الاختيارات.

---

## 7) قوالب أسئلة جاهزة (من غير AI السيرفر)

### أ) خمن اللاعب من الصورة

1. `GET .../cached/365/player/lookup?q=...`
2. اعرض `imageUrl`
3. 4 أسماء (واحد صح + 3 غلط من lookup أو squad)

### ب) خمن الشعار

1. `GET .../cached/search?q=ClubName` أو `cached/team/:id`
2. اعرض `logo`
3. 4 أسماء أندية (غلط من `top-by-country`)

### ج) خمن البطولة من الشعار

1. `leagues/all` أو `search?q=...`
2. اعرض `logo`
3. 4 أسماء بطولات

### د) سؤال أرقام

1. `top/scorers` أو `standings` أو `teams/:id/statistics`
2. صياغة السؤال من الرقم/الترتيب
3. الاختيارات من نفس القائمة

### هـ) ترجمة أسماء للعربي (اختياري، مش شات)

```http
POST /api/i18n/football-names
Content-Type: application/json

{ "texts": ["Manchester United", "Premier League"], "targetLang": "ar" }
```

Public — مفيد لو الأسماء جاية إنجليزي وعايز تعرضها بالعربي في السؤال.

---

## 8) إيه اللي **مش** متاح لك كـ API بيانات؟

| الطلب | الواقع |
|--------|--------|
| `POST` يخلّي AI 90Plus يولّد باك أسئلة لنظامك | **غير موجود** (خارج الشات) |
| Endpoint اسمه legends / أساطير | **غير موجود** — بحث بالاسم |
| توليد صور AI للاعبين | **غير موجود** — الصور من 365 / API-Football جاهزة |
| استخدام كويز يومي كمصدر داتا لنظامك | غير مناسب — ده تجربة مستخدم نهائية + Clerk |

لو محتاج لاحقاً endpoint رسمي زي:

```http
POST /api/quiz/generate
```

يرجّع JSON أسئلة جاهزة من AI السيرفر — ده يحتاج يتبنى جديد. حالياً اعتمد على الجدول فوق.

---

## 9) أخطاء شائعة

| الرد | المعنى / الحل |
|------|----------------|
| `400` — query أقل من حرفين | زوّد `q` |
| `404` — No players found | غيّر التهجئة (جرّب إنجليزي) أو قصّر الاسم |
| `503` — 365 / Football unavailable | upstream أو إعدادات؛ حاول لاحقاً أو استخدم مسار الكاش التاني |
| صورة أسطوري فاضيّة | حوّل السؤال لنص أو شعار نادي |

---

## 10) خريطة سريعة تنسخها

```
بحث عام .............. GET /api/football/cached/search?q=
صورة لاعب ............ GET /api/football/cached/365/player/lookup?q=
شعار نادي ............ GET /api/football/cached/team/:id
أندية بلد ............ GET /api/football/teams/top-by-country?country=
بطولات ............... GET /api/football/leagues/all
هدافين ............... GET /api/football/players/top/scorers?league=&season=
ترتيب ................ GET /api/football/cached/standings/:leagueId
ترجمة أسماء .......... POST /api/i18n/football-names
توليد AI من غير شات .. غير متاح حالياً
```

---

## 11) ملفات الكود لو حابب تتعمّق

| ملف | محتوى |
|-----|--------|
| `src/routes/football.routes.ts` | تسجيل كل football routes |
| `src/controllers/football.controller.ts` | منطق الطلبات |
| `src/routes/i18n.routes.ts` | ترجمة الأسماء |
| `src/services/quiz-image-legends.ts` | قائمة أسماء أسطورية داخلية (مش API) |

---

**للمطوّر عمر:** ابني نظام الأسئلة على **football + 365 lookup**. الداتا والصور من عندنا؛ صياغة السؤال والاختيارات من عندك.
