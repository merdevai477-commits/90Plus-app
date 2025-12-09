# 📧 إعداد Email Verification

## ⚠️ المشكلة الحالية

الخطأ الذي يظهر:
```
530-5.7.0 Authentication Required
```

**السبب:** SMTP service غير مُعد بشكل صحيح. Gmail يتطلب App Password وليس كلمة المرور العادية.

---

## 🔧 الحلول المتاحة

### الحل 1: إعداد Gmail SMTP (موصى به للإنتاج)

1. **إنشاء App Password في Gmail:**
   - اذهب إلى [Google Account Settings](https://myaccount.google.com/)
   - Security → 2-Step Verification → App passwords
   - أنشئ App Password جديد
   - استخدم هذا الـ password في `.env`

2. **إضافة إلى `.env`:**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password-here
   ```

### الحل 2: استخدام Email Service مجاني (موصى به)

**خيارات مجانية:**
- **Resend** (100 emails/day مجاناً): https://resend.com
- **SendGrid** (100 emails/day مجاناً): https://sendgrid.com
- **Mailgun** (5,000 emails/month مجاناً): https://mailgun.com

**مثال مع Resend:**
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### الحل 3: Development Mode (للتطوير فقط)

للتطوير المحلي فقط، يمكن تفعيل auto-verification:

```env
NODE_ENV=development
ALLOW_AUTO_VERIFY=true
```

⚠️ **تحذير:** لا تستخدم هذا في الإنتاج! سيسمح بإنشاء حسابات بدون تحقق.

---

## 🛡️ الحماية من Spam

تم إضافة Rate Limiting:
- **5 signups** لكل IP في الساعة
- **10 login attempts** لكل IP في 15 دقيقة
- فحص Email المستخدمة مؤخراً

---

## ✅ بعد الإعداد

1. أعد تشغيل الـ backend
2. جرب signup - يجب أن يصل email verification
3. اضغط على الرابط في الإيميل للتحقق

---

## 🔍 التحقق من الإعداد

```bash
# في Backend directory
npm run dev
```

إذا كان SMTP مُعد بشكل صحيح، سترى:
```
✅ Email service is ready
```

إذا لم يكن مُعد:
```
❌ Email service configuration error
```

