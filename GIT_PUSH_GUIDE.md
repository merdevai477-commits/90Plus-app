# دليل استخدام سكريبت Git Push

تم إنشاء سكريبتات لتسهيل عملية رفع التحديثات على GitHub.

## للينكس/ماك (Bash)

### 1. إعطاء صلاحيات التنفيذ للسكريبت:
```bash
chmod +x git-push.sh
```

### 2. تشغيل السكريبت:
```bash
./git-push.sh
```

## للويندوز (PowerShell)

### الطريقة الأولى - تشغيل مباشر:
```powershell
powershell -ExecutionPolicy Bypass -File git-push.ps1
```

### الطريقة الثانية - من داخل PowerShell:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\git-push.ps1
```

## للويندوز (Git Bash)

إذا كنت تستخدم Git Bash على ويندوز:
```bash
bash git-push.sh
```

## ماذا يفعل السكريبت؟

1. ✅ يتحقق من أنك في مجلد Git
2. 📍 يعرض الـ branch الحالي
3. 📊 يعرض حالة الملفات المتغيرة
4. ➕ يضيف جميع التغييرات (`git add .`)
5. 📝 يعرض الملفات التي سيتم commit لها
6. 💬 يطلب منك رسالة الـ commit (أو يستخدم رسالة افتراضية)
7. 💾 يعمل commit للتغييرات
8. 🔄 يرفع التغييرات على GitHub (`git push`)

## الرسالة الافتراضية

إذا لم تكتب رسالة commit، سيستخدم السكريبت هذه الرسالة:

```
fix: resolve TypeScript errors across frontend components

- Fixed gradient colors type to tuple format in multiple components
- Fixed Easing.back() calls to include parameter
- Fixed Video type references to use 'any' for dynamic imports
- Fixed import paths and removed unused imports
- Fixed service exports (clubLogoService, brandLogoService)
- Fixed nested object state updates in VisualEnhancements
- Fixed displayMode comparisons to use uppercase values
- Fixed transfer data handling (removed non-existent value property)
- Added missing styles and constants across components
- Improved type safety and error handling
```

## ملاحظات مهمة

- 🔒 تأكد من أن لديك صلاحيات الـ push على الـ repository
- 🌐 تأكد من اتصالك بالإنترنت
- 🔑 تأكد من تسجيل دخولك على Git (credentials)
- 📦 السكريبت يضيف **جميع** التغييرات، تأكد من مراجعتها قبل التأكيد

## إذا واجهت مشاكل

### مشكلة الصلاحيات (Permission Denied):
```bash
# Linux/Mac
chmod +x git-push.sh

# Windows PowerShell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### مشكلة Push Failed:
تأكد من:
1. أن لديك صلاحيات على الـ repository
2. أن الـ remote مضبوط صح: `git remote -v`
3. أنك مسجل دخول: `git config user.name` و `git config user.email`

### إعداد Git Credentials:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

## الأوامر اليدوية (بدون السكريبت)

إذا أردت عمل push يدوياً:

```bash
# إضافة جميع التغييرات
git add .

# عمل commit
git commit -m "your message here"

# رفع على GitHub
git push origin main
# أو
git push origin master
# حسب اسم الـ branch
```

---

## ملخص التحديثات التي تم إصلاحها

### Frontend TypeScript Fixes:
- ✅ إصلاح أخطاء الـ types في 40+ ملف
- ✅ إصلاح مشاكل الـ gradient colors
- ✅ إصلاح مشاكل الـ Video component types
- ✅ إصلاح الـ imports والـ exports
- ✅ إضافة الـ styles والـ constants الناقصة
- ✅ تحسين الـ type safety

### الملفات الرئيسية المعدلة:
- `front/components/` - 30+ component
- `front/app/` - 5+ screens
- `front/services/` - Service exports
- `front/styles/` - Missing styles

🎉 **جاهز للـ push!**
