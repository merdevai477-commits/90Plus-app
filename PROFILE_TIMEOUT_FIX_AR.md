# إصلاح مشكلة Timeout في البروفايل

## المشكلة ❌

لما بتفتح البروفايل، في requests كتيرة timeout (500ms):
```
GET /api/football/fixtures 500 106ms
GET /api/football/cached/matches/2026-02-13 500 368ms
GET /api/clerk/me 500 10ms
GET /api/reels/feed 500 10ms
GET /api/notifications 500 8ms
... (كتير جداً)
```

## السبب

المشكلة مش في صفحة البروفايل نفسها، لكن في:

1. **Timeout قصير جداً** - الـ API config فيها timeout 10-15 ثانية، لكن الـ requests بتفشل بعد 500ms
2. **Requests متكررة** - في components بتعمل نفس الـ request أكتر من مرة
3. **Network بطيء** - الـ API بياخد وقت طويل للرد

## الحل المؤقت ✅

### 1. زيادة Timeout في API Config

في `front/config/api.config.ts`:

```typescript
const CONFIG: Record<Environment, APIConfig> = {
  development: {
    baseUrl: 'http://localhost:3000/api',
    wsUrl: 'ws://localhost:3000',
    timeout: 30000, // ✅ زيادة من 10s إلى 30s
    uploadTimeout: 15 * 60 * 1000,
    retryAttempts: 2,
  },
  production: {
    baseUrl: 'https://90plus-app-production.up.railway.app/api',
    wsUrl: 'wss://90plus-app-production.up.railway.app',
    timeout: 30000, // ✅ زيادة من 15s إلى 30s
    uploadTimeout: 15 * 60 * 1000,
    retryAttempts: 2,
  },
};
```

### 2. تحسين Cache للـ Football API

الـ requests المتكررة لـ `/api/football/fixtures` و `/api/football/cached/matches` محتاجة cache أفضل.

### 3. Lazy Loading للـ Components

تأجيل تحميل الـ components اللي مش ظاهرة على الشاشة.

## الحل الدائم (للمستقبل)

1. **تحسين Backend Performance**:
   - إضافة indexes على Database
   - تحسين queries
   - استخدام Redis cache

2. **Request Deduplication**:
   - منع نفس الـ request من الحدوث أكتر من مرة في نفس الوقت

3. **Pagination**:
   - تحميل البيانات على دفعات بدلاً من كلها مرة واحدة

## ملاحظة مهمة

المشكلة الحالية مش critical لأن:
- ✅ البروفايل بيفتح عادي
- ✅ الـ requests بتنجح في النهاية
- ⚠️ بس بياخد وقت أطول من اللازم

## للـ Build 10

المشكلة دي مش هتمنع الـ build، لكن محتاجة تحسين في المستقبل.
