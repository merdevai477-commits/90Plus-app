# 🔐 Supabase Auth Setup Guide

## الخطوات المطلوبة لإعداد Supabase Auth

### 1. إنشاء حساب Supabase
1. اذهب إلى: https://supabase.com/dashboard
2. سجل دخول أو أنشئ حساب جديد
3. أنشئ مشروع جديد (New Project)

### 2. الحصول على المفاتيح (Keys)
بعد إنشاء المشروع:
1. اذهب إلى **Settings** → **API**
2. ستجد:
   - **Project URL** (مثل: `https://xxxxx.supabase.co`)
   - **anon/public key** (مفتاح عام)
   - **service_role key** (مفتاح خاص - لا تشاركه!)

### 3. إعداد متغيرات البيئة (.env)
أضف هذه المتغيرات في ملف `.env` في مجلد `Backend`:

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 4. تفعيل Authentication Providers
في Supabase Dashboard:
1. اذهب إلى **Authentication** → **Providers**
2. فعّل **Email** provider
3. (اختياري) فعّل **Google OAuth** إذا كنت تريد استخدامه

### 5. إعداد Google OAuth (اختياري)
إذا كنت تريد استخدام Google OAuth:
1. اذهب إلى **Authentication** → **Providers** → **Google**
2. أدخل **Client ID** و **Client Secret** من Google Cloud Console
3. أضف Redirect URL: `https://xxxxx.supabase.co/auth/v1/callback`

### 6. ربط Supabase Users مع Prisma
بعد تسجيل المستخدم في Supabase، سيتم إنشاء سجل في جدول `auth.users` تلقائياً.
يمكنك ربطه مع جدول `users` في Prisma باستخدام `user_metadata` أو `id`.

### 7. تشغيل المشروع
```powershell
cd Backend
npm run dev
```

## ✅ المزايا
- ✅ مجاني في الخطة المجانية
- ✅ إدارة تلقائية للجلسات والـ tokens
- ✅ دعم OAuth (Google, Facebook, Apple, GitHub)
- ✅ Magic Links
- ✅ Phone Authentication
- ✅ Row Level Security (RLS)

## 📝 ملاحظات
- لا تشارك `SUPABASE_SERVICE_ROLE_KEY` أبداً!
- استخدم `SUPABASE_ANON_KEY` في Frontend فقط
- استخدم `SUPABASE_SERVICE_ROLE_KEY` في Backend فقط

