# GitHub Management Script
# سكربت إدارة GitHub

سكربت bash لإدارة عمليات GitHub بسهولة.

## المتطلبات / Requirements

- Git مثبت على النظام
- Bash (Git Bash على Windows أو WSL)

## كيفية الاستخدام / How to Use

### على Windows:

1. افتح **Git Bash** أو **WSL**
2. انتقل إلى مجلد المشروع:
   ```bash
   cd /c/Football-app
   ```
3. شغّل السكربت:
   ```bash
   ./github.sh
   ```

### على Linux/Mac:

1. افتح Terminal
2. انتقل إلى مجلد المشروع:
   ```bash
   cd /path/to/Football-app
   ```
3. شغّل السكربت:
   ```bash
   ./github.sh
   ```

## الميزات / Features

السكربت يوفر القائمة التالية:

1. **Initialize Git & Connect to GitHub** - تهيئة Git وإضافة مستودع GitHub
2. **Commit Changes** - حفظ التغييرات
3. **Push to GitHub** - رفع التغييرات إلى GitHub
4. **Pull from GitHub** - سحب التغييرات من GitHub
5. **Sync (Pull + Push)** - مزامنة (سحب ثم رفع)
6. **Create New Branch** - إنشاء فرع جديد
7. **Switch Branch** - التبديل بين الفروع
8. **Show Status** - عرض حالة Git

## أمثلة الاستخدام / Usage Examples

### أول مرة (إعداد جديد):

```bash
./github.sh
# اختر 1: Initialize Git & Connect to GitHub
# أدخل رابط المستودع: https://github.com/username/repo.git
```

### حفظ ورفع التغييرات:

```bash
./github.sh
# اختر 2: Commit Changes
# أدخل رسالة الـ commit
# اختر 3: Push to GitHub
```

### سحب آخر التحديثات:

```bash
./github.sh
# اختر 4: Pull from GitHub
```

### مزامنة كاملة:

```bash
./github.sh
# اختر 5: Sync (Pull + Push)
```

## ملاحظات / Notes

- تأكد من أن لديك صلاحيات الكتابة على المستودع
- في حالة وجود تعارضات (conflicts)، قم بحلها يدوياً قبل المتابعة
- السكربت يدعم الفروع (branches) ويعمل مع `main` أو `master`

## استكشاف الأخطاء / Troubleshooting

### خطأ: "Permission denied"
```bash
chmod +x github.sh
```

### خطأ: "Git repository not initialized"
اختر الخيار 1 من القائمة لتهيئة Git

### خطأ: "No remote repository found"
اختر الخيار 1 من القائمة لإضافة مستودع GitHub

