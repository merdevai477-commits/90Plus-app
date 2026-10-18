# 90Plus — صفحة واحدة للمسابقة

انسخ القسم الذي يطابق خانة الاستمارة. الأرقام الوحيدة هنا هي مواصفات المنتج (مدة الفيديو، حجم الحزمة، عدد أدوات المساعد)، وليست إحصاءات استخدام.

---

## الاسم

**90Plus**

## السطر التعريفي (حتى 160 حرفًا)

منصة كرة قدم اجتماعية: نتائج حية، فيديوهات قصيرة، توقعات، مسابقات يومية، ومساعد ذكي يجيب من بيانات المباريات الحقيقية.

## السطر التعريفي — English

A football social platform: live scores, short video, predictions, daily quizzes, and an AI assistant grounded in real match data.

---

## المشكلة

مشجع كرة القدم يتنقل بين تطبيق للنتائج، وآخر للفيديو، وثالث للمسابقات، ومجموعة واتساب للتوقعات. التطبيقات العالمية ضعيفة بالعربية، وإجابات الذكاء الاصطناعي العامة عن الكرة تختلق أرقامًا وأسماء. البيانات الحية غالية وبطيئة إذا طُلبت من المصدر في كل مرة يفتح فيها المستخدم الشاشة.

## الحل

90Plus يبقي المشجع داخل حلقة واحدة: يتابع المباراة لحظة بلحظة، يتوقع نتيجتها، يناقشها، يشاهد ويشارك اللقطات، يختبر معلوماته في مسابقة يومية، ويصعد في الترتيب. المساعد داخل التطبيق لا يجيب من ذاكرته فقط؛ يستدعي أدوات مربوطة ببيانات الفرق واللاعبين والمباريات قبل أن يكتب الإجابة.

---

## ماذا يميز المشروع؟

1. **مساعد كروي مربوط بالبيانات.** يبحث عن لاعب، يجلب مباراة اليوم، التشكيلة، الترتيب، والمواجهات المباشرة، ثم يصيغ الإجابة. هذا يقلل الاختلاق مقارنة بمحادثة عامة.
2. **مسابقة يومية تُولَّد ثم تُراجَع.** النموذج يكتب الأسئلة من مجموعة كيانات يختارها الخادم (لاعبون، أندية، شعارات، ملاعب)، ثم طبقة تحقق ترفض السؤال إذا لم يطابق البيانات.
3. **خط بيانات حي مصمم للتكلفة والسرعة.** مصدران رياضيان، تخزين مؤقت، بث لحظي داخل التطبيق، إشعار عند الحدث، ونشاط مباشر على شاشة قفل آيفون.
4. **أكثر من لعبة تفاعل واحدة.** توقع فردي، مجموعات توقعات، ملك التوقعات، خماسي الهدافين، مسابقات برعاية وجوائز، وشارك واربح.
5. **منتج عربي أولًا، وشغّال.** أول فتح للتطبيق بالعربية، مع إنجليزية كاملة، وحسابات ومتاجر ونظام أمان وخصوصية.

---

## الجمهور

مشجع يتابع الدوريات الكبرى ويريد بالعربية: النتيجة، اللقطة، التوقع، والسؤال الذي يثبت أنه «فاهم كورة». الجمهور الثاني هو الراعي الذي يريد مسابقة مرتبطة بمباراة حقيقية وجائزة واضحة.

## الحالة اليوم

- تطبيق iOS و Android، الإصدار **1.1.2**.
- واجهة برمجية منشورة على `https://90plus.pro/api`.
- مصادقة، فيديو، إشعارات، مسابقات، ومساعد ذكي في الإنتاج.

## التقنيات في سطر

React Native و Expo للموبايل، Node.js و TypeScript و Express للخادم، PostgreSQL و Prisma للبيانات، Redis للتخزين المؤقت والطوابير، Socket.io للحظي، Clerk للمصادقة، Mux للفيديو، Cloudflare R2 للصور، وGemini مع OpenRouter للذكاء الاصطناعي.

---

## English one-pager

**Problem.** Fans split their attention across a scores app, a video app, a quiz app, and a group chat. Global products treat Arabic as a translation pass. General-purpose chat models invent football facts. Live data is slow and expensive if every screen hit calls the provider.

**Solution.** 90Plus keeps the fan in one loop: follow the match live, predict it, discuss it, watch and post clips, take a daily quiz, and climb a rank. The in-app assistant calls football tools (player search, live matches, lineups, standings, head-to-head) before it answers.

**Why it is different.** Grounded match assistant; a daily quiz that is generated from a server-owned entity set and rejected if it fails validation; a cached dual-provider live pipeline with push and iOS Live Activities; several games on the same identity (predictions, groups, King of Predictions, Top Scorers Five, sponsored prize contests, Share & Win); Arabic-first product that is already shipping.

**Status.** iOS and Android app **1.1.2**. API at `https://90plus.pro/api`.
