# Migration من Neon إلى Railway PostgreSQL

## لماذا نحتاج للتغيير؟

### المشاكل الحالية مع Neon:
1. **Connection Timeout** - بيقفل الـ connection بعد 5 دقائق
2. **Connection Pool محدود** - 5 connections فقط
3. **البطء** - الـ server في أوروبا والـ Railway في أمريكا
4. **500 Errors** - بسبب الـ connection issues

### المميزات مع Railway PostgreSQL:
1. ✅ **أسرع** - نفس الـ server مع الـ backend
2. ✅ **Connection Pool أفضل** - unlimited connections
3. ✅ **مش بيقفل** - always-on connection
4. ✅ **مجاني** - عندك $5 credit

## خطوات الـ Migration

### الخطوة 1: Backup البيانات الحالية (مهم جداً!)

```bash
# من مجلد Backend
cd Backend

# Export البيانات من Neon
npx prisma db pull
npx prisma db push --force-reset

# أو export SQL dump
pg_dump "postgresql://neondb_owner:npg_PpiHYbQ2etD4@ep-floral-sunset-als9j23r-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require" > neon_backup.sql
```

### الخطوة 2: إضافة PostgreSQL على Railway

1. **افتح Railway Dashboard**
   ```
   https://railway.app/dashboard
   ```

2. **اختار المشروع: 90Plus-app**

3. **اضغط "New"**
   - اختار "Database"
   - اختار "Add PostgreSQL"

4. **انتظر الـ Deployment** (1-2 دقيقة)

5. **تأكد من الـ DATABASE_URL**
   - اضغط على PostgreSQL service
   - اضغط على "Variables"
   - انسخ الـ `DATABASE_URL`

### الخطوة 3: تحديث Environment Variables

1. **في Railway Dashboard:**
   - اختار الـ Backend service (مش PostgreSQL)
   - اضغط على "Variables"
   - ابحث عن `DATABASE_URL`
   - غيرها إلى: `${{Postgres.DATABASE_URL}}`

2. **أو استخدم Railway CLI:**
   ```bash
   railway variables set DATABASE_URL='${{Postgres.DATABASE_URL}}'
   ```

### الخطوة 4: Run Migrations

```bash
# من مجلد Backend
cd Backend

# Run migrations على Railway PostgreSQL
railway run npx prisma migrate deploy

# أو
railway run npx prisma db push
```

### الخطوة 5: Import البيانات (إذا كان عندك بيانات مهمة)

**Option 1: استخدام Prisma Studio**
```bash
# Connect to Neon (old)
DATABASE_URL="postgresql://neondb_owner:..." npx prisma studio

# Export البيانات يدوياً

# Connect to Railway (new)
railway run npx prisma studio

# Import البيانات يدوياً
```

**Option 2: استخدام SQL dump**
```bash
# Import من الـ backup
railway run psql < neon_backup.sql
```

**Option 3: Start Fresh (إذا مش عندك بيانات مهمة)**
```bash
# Just run migrations
railway run npx prisma migrate deploy
```

### الخطوة 6: Test الـ Connection

```bash
# Test locally
DATABASE_URL='${{Postgres.DATABASE_URL}}' npm run dev

# Test على Railway
railway logs
# دور على: ✅ Database connected
```

### الخطوة 7: Redeploy

```bash
# Push التغييرات
git add .
git commit -m "chore: migrate to Railway PostgreSQL"
git push origin main

# Railway هيعمل auto-deploy
```

## Verification Checklist

بعد الـ migration، تأكد من:

- [ ] `/api/health` endpoint بيرجع "Database: Connected"
- [ ] `/api/clerk/me` بيشتغل بدون 500 errors
- [ ] Profile screen بيحمل بدون مشاكل
- [ ] مفيش connection timeout errors في الـ logs
- [ ] Response time أسرع (< 500ms)

## Rollback Plan (إذا حصلت مشكلة)

```bash
# ارجع لـ Neon
railway variables set DATABASE_URL="postgresql://neondb_owner:npg_PpiHYbQ2etD4@ep-floral-sunset-als9j23r-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Redeploy
git push origin main
```

## Cost Estimation

**Railway PostgreSQL:**
- Free tier: $5 credit
- Usage: ~$0.50/month (estimated)
- Credit duration: ~10 months

**Neon:**
- Free tier: unlimited
- But: connection issues and slower

## Recommended: Use Railway PostgreSQL

لأن:
1. المشاكل الحالية بسبب Neon connection issues
2. Railway PostgreSQL أسرع وأكثر استقراراً
3. عندك $5 credit كافية لفترة طويلة
4. أسهل في الـ management

## Quick Start (إذا مش عندك بيانات مهمة)

```bash
# 1. Add PostgreSQL on Railway Dashboard
# 2. Set DATABASE_URL to ${{Postgres.DATABASE_URL}}
# 3. Run migrations
railway run npx prisma migrate deploy

# 4. Redeploy
git push origin main

# Done! ✅
```

## Support

إذا واجهت مشاكل:
- Check Railway logs: `railway logs`
- Check PostgreSQL status in Railway Dashboard
- Verify DATABASE_URL is set correctly
- Test connection: `railway run npx prisma db pull`
