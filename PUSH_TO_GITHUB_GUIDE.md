# دليل رفع التحديثات على GitHub و Railway

## الطريقة الأولى: استخدام السكريبت الجاهز ⚡

```powershell
# شغل السكريبت
.\push-to-github.ps1
```

السكريبت هيعمل كل حاجة تلقائياً:
- ✅ يشوف الـ remote الحالي
- ✅ يسألك لو عايز تغيره
- ✅ يضيف كل التغييرات
- ✅ يعمل commit
- ✅ يرفع على GitHub

---

## الطريقة الثانية: الخطوات اليدوية 📝

### 1. تغيير الـ GitHub Remote (لو محتاج)

```powershell
# شوف الـ remote الحالي
git remote -v

# لو عايز تغيره:
git remote remove origin
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git

# تأكد إن اتغير
git remote -v
```

### 2. إضافة كل التغييرات

```powershell
# شوف التغييرات
git status

# أضف كل التغييرات
git add .

# أو أضف ملفات محددة
git add front/services/predictions.service.ts
git add front/components/common/CommentsModal.tsx
git add front/.env
```

### 3. عمل Commit

```powershell
# Commit مع رسالة واضحة
git commit -m "🔧 Fix: Updated predictions service + CommentsModal cleanup

- Fixed predictions.service.ts to use centralized API config
- Removed unused imports from CommentsModal
- Added .env file for local development
- Fixed Network request failed errors in predictions tab"
```

### 4. رفع على GitHub

```powershell
# شوف اسم الـ branch الحالي
git branch

# ارفع على GitHub
git push origin main

# أو لو الـ branch اسمه master
git push origin master
```

---

## التحديثات اللي تمت في هذا الكوميت 📋

### 1. إصلاح `predictions.service.ts` ✅
- **المشكلة**: كان يستخدم `localhost:3000` مباشرة
- **الحل**: استخدام `getApiUrl()` من الـ API config المركزي
- **النتيجة**: الآن يستخدم الـ URL الصحيح حسب البيئة (development/production)

### 2. تنظيف `CommentsModal.tsx` ✅
- حذف imports غير مستخدمة:
  - `KeyboardAvoidingView`
  - `MoreVertical`
  - `ProfileTheme`
  - `useLanguage` (deprecated)
  - `mentionQuery` state
- **النتيجة**: كود أنظف بدون warnings

### 3. إضافة `.env` للـ Frontend ✅
- ملف `.env` جديد للتطوير المحلي
- يحتوي على:
  - `EXPO_PUBLIC_API_URL` للـ localhost
  - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `EXPO_PUBLIC_SPORTMONKS_TOKEN`

---

## بعد الرفع على GitHub 🚀

### Railway هيعمل Auto-Deploy تلقائياً:

1. **افتح Railway Dashboard**
   - روح على: https://railway.app/dashboard
   - اختار الـ project بتاعك

2. **تابع الـ Deployment**
   - هتشوف deployment جديد بيبدأ تلقائياً
   - انتظر 2-5 دقائق للـ deployment يخلص

3. **تأكد من النجاح**
   - لما يخلص، هتشوف ✅ بجانب الـ deployment
   - جرب التطبيق وشوف لو الـ predictions tab شغال

---

## لو حصلت مشاكل ⚠️

### مشكلة: "Permission denied"
```powershell
# تأكد إنك مسجل دخول على GitHub
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# لو محتاج Personal Access Token
# روح على: https://github.com/settings/tokens
# اعمل token جديد واستخدمه بدل الـ password
```

### مشكلة: "Railway مش بيعمل deploy"
1. تأكد إن Railway متصل بالـ GitHub repo الصحيح
2. روح على Railway Settings → GitHub → Reconnect
3. تأكد إن الـ branch الصحيح محدد في Railway

### مشكلة: "Predictions لسه مش شغالة"
1. تأكد إن الـ Backend على Railway شغال
2. افتح Railway logs وشوف لو في errors
3. تأكد إن الـ environment variables صحيحة في Railway

---

## ملاحظات مهمة 📌

1. **الـ `.env` مش هيترفع على GitHub** (موجود في `.gitignore`)
2. **Railway بيستخدم الـ environment variables من Dashboard**
3. **التطبيق المحلي هيستخدم `localhost:3000`**
4. **التطبيق على Production هيستخدم Railway URL تلقائياً**

---

## أوامر Git مفيدة 🛠️

```powershell
# شوف التغييرات
git status

# شوف الـ commits الأخيرة
git log --oneline -5

# تراجع عن آخر commit (لو غلطت)
git reset --soft HEAD~1

# شوف الفرق في ملف معين
git diff front/services/predictions.service.ts

# شوف كل الـ branches
git branch -a

# انتقل لـ branch تاني
git checkout branch-name
```

---

## تواصل مع Railway 🔗

- **Dashboard**: https://railway.app/dashboard
- **Docs**: https://docs.railway.app
- **Status**: https://status.railway.app

---

**✨ بالتوفيق! لو حصلت أي مشكلة، قولي وأنا هساعدك.**
