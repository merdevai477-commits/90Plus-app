# دليل رفع التغييرات إلى GitHub 🚀

## الطريقة السهلة (موصى بها) ⭐

### استخدام السكريبت الجاهز

```powershell
# الطريقة 1: مع رسالة مباشرة
.\push.ps1 "اصلاح مشكلة التوقعات"

# الطريقة 2: بدون رسالة (سيطلب منك ادخالها)
.\push.ps1
```

### أمثلة على الرسائل

```powershell
# مثال 1: إصلاح مشكلة
.\push.ps1 "اصلاح مشكلة عرض التوقعات كخاطئة"

# مثال 2: إضافة ميزة جديدة
.\push.ps1 "اضافة نظام التوقعات اليومية"

# مثال 3: تحسين الأداء
.\push.ps1 "تحسين سرعة تحميل المباريات"

# مثال 4: تحديث التصميم
.\push.ps1 "تحديث تصميم صفحة البروفايل"

# مثال 5: إصلاح عدة مشاكل
.\push.ps1 "اصلاح WebSocket + التوقعات + Cache"
```

---

## الطريقة اليدوية (للمتقدمين)

إذا كنت تريد التحكم الكامل:

### 1. عرض الملفات المتغيرة
```powershell
git status
```

### 2. إضافة ملفات محددة
```powershell
# إضافة ملف واحد
git add Backend/src/routes/predictions.routes.ts

# إضافة مجلد كامل
git add Backend/

# إضافة جميع الملفات
git add .
```

### 3. حفظ التغييرات (Commit)
```powershell
git commit -m "رسالة التغييرات"
```

### 4. رفع التغييرات
```powershell
git push origin main
```

---

## حل المشاكل الشائعة 🔧

### مشكلة 1: "Updates were rejected"
```powershell
# السبب: هناك تغييرات على GitHub غير موجودة عندك
# الحل:
git pull origin main
.\push.ps1 "رسالتك"
```

### مشكلة 2: "Merge conflict"
```powershell
# السبب: تعارض في الملفات
# الحل:
git status  # شوف الملفات المتعارضة
# افتح الملفات وحل التعارض يدوياً
git add .
git commit -m "حل التعارض"
git push origin main
```

### مشكلة 3: "Permission denied"
```powershell
# السبب: مشكلة في المصادقة
# الحل:
# تأكد من تسجيل الدخول في Git
git config --global user.name "اسمك"
git config --global user.email "بريدك@example.com"
```

### مشكلة 4: "Cannot run script"
```powershell
# السبب: PowerShell لا يسمح بتشغيل السكريبتات
# الحل:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## نصائح مهمة 💡

### ✅ افعل
- اكتب رسالة واضحة تشرح التغييرات
- ارفع التغييرات بشكل منتظم (كل يوم أو بعد كل ميزة)
- تأكد من اختبار التغييرات قبل الرفع
- استخدم رسائل بالعربية أو الإنجليزية (حسب تفضيلك)

### ❌ لا تفعل
- لا ترفع ملفات حساسة (مثل `.env` مع بيانات حقيقية)
- لا تكتب رسائل غير واضحة (مثل "update" أو "fix")
- لا ترفع ملفات كبيرة جداً (أكثر من 100MB)
- لا ترفع مجلد `node_modules` (موجود في `.gitignore`)

---

## أمثلة على رسائل Commit جيدة

### بالعربية
```
✅ "اصلاح مشكلة عرض التوقعات كخاطئة قبل انتهاء المباراة"
✅ "اضافة نظام الإشعارات للمباريات المفضلة"
✅ "تحسين أداء تحميل المباريات بنسبة 60%"
✅ "تحديث تصميم صفحة البروفايل مع FIFA Card"
✅ "اصلاح WebSocket connection errors"

❌ "update"
❌ "fix bug"
❌ "changes"
```

### بالإنجليزية
```
✅ "Fix predictions showing as incorrect before match ends"
✅ "Add push notifications for favorite matches"
✅ "Improve matches loading performance by 60%"
✅ "Update profile page design with FIFA Card"
✅ "Fix WebSocket connection errors"

❌ "update"
❌ "fix"
❌ "changes"
```

---

## سير العمل الموصى به 🔄

### يومياً
```powershell
# في نهاية اليوم
.\push.ps1 "ملخص التغييرات اليوم"
```

### بعد كل ميزة
```powershell
# بعد إنهاء ميزة جديدة
.\push.ps1 "اضافة ميزة التوقعات اليومية"
```

### بعد إصلاح مشكلة
```powershell
# بعد إصلاح bug
.\push.ps1 "اصلاح مشكلة WebSocket"
```

### قبل النشر (Deployment)
```powershell
# قبل رفع على Railway
.\push.ps1 "جاهز للنشر - v1.2.0"
```

---

## التحقق من التغييرات على GitHub

بعد الرفع، افتح:
```
https://github.com/merdevai477-commits/90Plus-app
```

ستجد:
- ✅ آخر Commit مع رسالتك
- ✅ الملفات المتغيرة
- ✅ تاريخ ووقت التغيير
- ✅ عدد الأسطر المضافة/المحذوفة

---

## السكريبتات المتاحة 📜

### 1. `push.ps1` - رفع جميع التغييرات
```powershell
.\push.ps1 "رسالة التغييرات"
```
**الاستخدام**: للتغييرات العادية

### 2. `quick-push.ps1` - رفع سريع (إذا كان موجود)
```powershell
.\quick-push.ps1
```
**الاستخدام**: للتغييرات الصغيرة

### 3. `git-push.ps1` - رفع مع خيارات إضافية (إذا كان موجود)
```powershell
.\git-push.ps1
```
**الاستخدام**: للتحكم الكامل

---

## الملفات التي يتم تجاهلها تلقائياً

هذه الملفات **لن** يتم رفعها (موجودة في `.gitignore`):

```
node_modules/          # مكتبات Node.js
.env                   # متغيرات البيئة الحساسة
dist/                  # ملفات البناء
build/                 # ملفات البناء
*.log                  # ملفات السجلات
.DS_Store              # ملفات macOS
Thumbs.db              # ملفات Windows
```

---

## أوامر Git مفيدة أخرى

### عرض السجل
```powershell
# آخر 5 تغييرات
git log -5 --oneline

# تفاصيل آخر تغيير
git log -1

# سجل كامل مع الرسم البياني
git log --graph --oneline --all
```

### التراجع عن التغييرات
```powershell
# التراجع عن ملف معين (قبل add)
git checkout -- filename.ts

# التراجع عن جميع التغييرات (قبل add)
git checkout -- .

# التراجع عن add (قبل commit)
git reset HEAD filename.ts

# التراجع عن آخر commit (بدون حذف التغييرات)
git reset --soft HEAD~1

# التراجع عن آخر commit (مع حذف التغييرات)
git reset --hard HEAD~1
```

### عرض الفروع
```powershell
# عرض جميع الفروع
git branch -a

# إنشاء فرع جديد
git checkout -b feature/new-feature

# التبديل بين الفروع
git checkout main
```

---

## الخلاصة 📝

### للاستخدام اليومي:
```powershell
.\push.ps1 "وصف التغييرات"
```

### هذا كل شيء! 🎉

السكريبت سيقوم بـ:
1. ✅ عرض الملفات المتغيرة
2. ✅ إضافة جميع الملفات
3. ✅ حفظ التغييرات (Commit)
4. ✅ رفع التغييرات إلى GitHub
5. ✅ عرض النتيجة

---

**آخر تحديث**: 2026-01-18  
**الحالة**: ✅ جاهز للاستخدام
