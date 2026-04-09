# 🚀 تعليمات النشر - iOS Login Fix

## الملفات المتاحة

### 1. للـ Windows (PowerShell) ⭐
```powershell
.\deploy-ios-fix.ps1
```

### 2. للـ Linux/Mac (Bash)
```bash
chmod +x deploy-ios-fix.sh
./deploy-ios-fix.sh
```

---

## 📋 الخطوات (Windows)

### الخطوة 1: افتح PowerShell
```powershell
# اضغط Windows + X
# اختر "Windows PowerShell" أو "Terminal"
```

### الخطوة 2: اذهب لمجلد المشروع
```powershell
cd C:\Football-app
```

### الخطوة 3: شغل السكريبت
```powershell
.\deploy-ios-fix.ps1
```

**ملاحظة:** إذا ظهرت رسالة "Execution Policy"، شغل:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\deploy-ios-fix.ps1
```

---

## 📋 الخطوات (Linux/Mac)

### الخطوة 1: افتح Terminal

### الخطوة 2: اذهب لمجلد المشروع
```bash
cd ~/Football-app
```

### الخطوة 3: اجعل السكريبت قابل للتنفيذ
```bash
chmod +x deploy-ios-fix.sh
```

### الخطوة 4: شغل السكريبت
```bash
./deploy-ios-fix.sh
```

---

## ✅ ما يفعله السكريبت

### 1. Backend Deployment (2-3 دقائق)
- ✅ يضيف CORS origins للـ iOS
- ✅ يعمل commit للتغييرات
- ✅ يرفع على Railway
- ✅ Railway ينشر تلقائياً

### 2. Frontend Build (15-20 دقيقة)
- ✅ يضيف Sentry logging
- ✅ يضيف detailed error tracking
- ✅ يعمل commit للتغييرات
- ✅ يبدأ EAS build للـ iOS
- ✅ يرفع على TestFlight تلقائياً

---

## 📊 Timeline

| الخطوة | الوقت |
|--------|-------|
| Backend Deployment | 2-3 دقائق |
| Frontend Build | 15-20 دقيقة |
| TestFlight Processing | 5-10 دقائق |
| **الإجمالي** | **25-35 دقيقة** |

---

## 🔍 مراقبة التقدم

### Backend (Railway)
```
https://railway.app
→ اذهب لـ project
→ شوف Deployments
→ تأكد من Status: Success
```

### Frontend (EAS)
```
https://expo.dev
→ اذهب لـ Builds
→ شوف iOS build progress
→ انتظر Status: Finished
```

### TestFlight
```
App Store Connect → TestFlight
→ انتظر Processing
→ Build سيظهر بعد 5-10 دقائق
```

---

## 🧪 الاختبار

### 1. نزل من TestFlight
- افتح TestFlight على iPad
- نزل النسخة الجديدة
- افتح التطبيق

### 2. جرب Login
- أدخل email و password
- اضغط "دخول"
- لاحظ ما يحدث

### 3. شوف Sentry
```
https://sentry.io
→ افتح project: 90Plus
→ اذهب لـ Issues
→ ابحث عن "Clerk login incomplete"
→ اقرأ Breadcrumbs و Extra Data
```

---

## ❓ الأسئلة الشائعة

### Q: السكريبت يقول "No changes to commit"
**A:** التغييرات مطبقة بالفعل. السكريبت سيكمل بشكل طبيعي.

### Q: EAS build فشل
**A:** شغل:
```powershell
cd front
eas build --platform ios --profile production --clear-cache
```

### Q: Railway deployment فشل
**A:** تحقق من:
- Railway logs
- Database connection
- Environment variables

### Q: TestFlight مش ظاهر
**A:** انتظر 10-15 دقيقة إضافية. Processing قد يأخذ وقت.

---

## 🆘 المساعدة

إذا واجهت أي مشكلة:

1. **تحقق من الـ logs:**
   ```powershell
   # Backend logs
   # في Railway Dashboard
   
   # Frontend build logs
   # في EAS Dashboard
   ```

2. **أعد المحاولة:**
   ```powershell
   # أعد تشغيل السكريبت
   .\deploy-ios-fix.ps1
   ```

3. **Manual deployment:**
   ```powershell
   # Backend
   cd Backend
   git add src/main.ts
   git commit -m "fix: iOS CORS"
   git push origin main
   
   # Frontend
   cd front
   git add app/auth/index.tsx
   git commit -m "fix: iOS logging"
   eas build --platform ios --profile production
   ```

---

## ✅ النجاح

بعد نجاح النشر، ستجد:

### في Railway:
- ✅ Deployment: Success
- ✅ CORS origins محدثة
- ✅ Backend يعمل

### في EAS:
- ✅ Build: Finished
- ✅ Uploaded to TestFlight
- ✅ Ready for testing

### في TestFlight:
- ✅ Build متاح
- ✅ يمكن التنزيل
- ✅ جاهز للاختبار

---

## 🎯 الخطوة التالية

بعد نجاح النشر:

1. ✅ نزل من TestFlight
2. ✅ جرب Login
3. ✅ شوف Sentry logs
4. ✅ حدد السبب الحقيقي
5. ✅ طبق الحل المناسب

**Good luck! 🚀**
