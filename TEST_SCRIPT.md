# ✅ تم إصلاح السكريبت!

## المشكلة كانت:
الـ PowerShell كان بيفسر الـ `-` في الـ commit message على أنه operator.

## الحل:
تم تغيير `-` إلى `*` في الـ commit message.

## جرب الآن:

```powershell
.\quick-deploy-profile.ps1
```

يجب أن يعمل بدون مشاكل! ✅

## إذا استمرت المشكلة:

استخدم الطريقة اليدوية:

```powershell
# 1. إضافة الملفات
git add .

# 2. عمل commit
git commit -m "Fix: Profile loading issue"

# 3. Push
git push origin main
```

أو استخدم:

```powershell
git push origin $(git branch --show-current)
```

✨ Good luck!
