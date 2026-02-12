# إعداد قاعدة البيانات على Railway

## المشكلة
Railway بيعرض تحذير عن استخدام `DATABASE_PUBLIC_URL` لأنه بيستخدم endpoint عام وهيكلفك فلوس (egress fees).

## الحل السريع ✅

### 1. روح على Railway Dashboard
- افتح مشروع Backend
- اضغط على Variables

### 2. استخدم DATABASE_URL (مش DATABASE_PUBLIC_URL)

**احذف أو غيّر:**
```
DATABASE_PUBLIC_URL=postgresql://postgres:eTnAHqpEFqHnbHKrIJPEDktLFrTrRBda@maglev.proxy.rlwy.net:19764/railway
```

**استخدم بدلها:**
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

أو لو عايز تحطها يدوي:
```
DATABASE_URL=postgresql://postgres:eTnAHqpEFqHnbHKrIJPEDktLFrTrRBda@postgres.railway.internal:5432/railway
```

### 3. الفرق بين الاتنين

| المتغير | الاستخدام | التكلفة | السرعة |
|---------|-----------|---------|--------|
| `DATABASE_PUBLIC_URL` | Public endpoint (maglev.proxy) | ❌ بفلوس | 🐌 أبطأ |
| `DATABASE_URL` | Private network (postgres.railway.internal) | ✅ مجاني | ⚡ أسرع |

### 4. ليه Private Network أحسن؟
- **مجاني**: مفيش egress fees
- **أسرع**: الاتصال داخل شبكة Railway الخاصة
- **أأمن**: مش exposed للإنترنت

## التأكد من الإعداد

بعد ما تغير المتغير:
1. Railway هيعمل auto-deploy
2. استنى الـ deployment يخلص
3. جرب `/api/health` endpoint
4. لو شغال تمام، يبقى كل حاجة تمام ✅

## ملاحظة مهمة
الكود في `Backend/src/main.ts` بيستخدم `process.env.DATABASE_URL` بالفعل، فمش محتاج تغير أي كود.
