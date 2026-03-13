# 🔧 حل مشكلة Railpack في Railway

## المشكلة
Railway بيستخدم Railpack builder بدل Nixpacks، وده بيسبب خطأ "npm: not found"

## الحل السريع ⚡

### الخطوة 1: افتح Railway Dashboard
1. روح على [Railway Dashboard](https://railway.app/dashboard)
2. افتح الـ project بتاعك: `90plus-app-production`
3. اضغط على الـ Backend service

### الخطوة 2: غير الـ Builder
1. اضغط على **Settings** (في القائمة الجانبية)
2. في قسم **Build**:
   - **Builder**: اختار **NIXPACKS** (مش Railpack ولا Dockerfile)
   - **Build Command**: احذف أي حاجة موجودة وحط:
     ```
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command**: احذف أي حاجة موجودة وحط:
     ```
     npm run start:prod
     ```

### الخطوة 3: اعمل Redeploy
1. ارجع للـ **Deployments** tab
2. اضغط على **Deploy** (الزرار الأزرق فوق)
3. أو اضغط على آخر deployment واختار **Redeploy**

### الخطوة 4: اتأكد من Environment Variables
اضغط على **Variables** tab وتأكد إن عندك:

```env
DATABASE_URL=postgresql://postgres:vOloGOqWWTtAwVyRpeysOqqDhpFlNQKz@postgres.railway.internal:5432/railway
REDIS_URL=your_upstash_redis_url
CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_key
NODE_ENV=production
PORT=3000
CORS_ORIGIN=*
```

## ليه المشكلة دي حصلت؟
- كان في ملف `railway.json` بيقول استخدم Dockerfile
- Railway ما لقاش Dockerfile صح فراح استخدم Railpack
- Railpack مش فيه npm، عشان كده طلع الخطأ

## الحل اللي عملناه
- مسحنا `railway.json`
- خلينا `railway.toml` بس (فيه `builder = "NIXPACKS"`)
- ضفنا `nixpacks.json` كمان للتأكيد
- دلوقتي Railway هيستخدم Nixpacks اللي فيه Node.js و npm

## بعد ما الـ deployment ينجح
1. هتلاقي الـ domain بتاعك شغال: `90plus-app-production-26e9.up.railway.app`
2. جرب تفتح: `https://90plus-app-production-26e9.up.railway.app/health`
3. لو شغال، روح على الـ Frontend وغير الـ API URL في `front/config/api.config.ts`

## لو لسه في مشكلة
1. تأكد إن الـ **Root Directory** في Settings = `/Backend`
2. تأكد إن الـ **Builder** = `NIXPACKS` (مش Railpack)
3. امسح الـ build cache: Settings → Delete Service Cache
4. اعمل Redeploy تاني
