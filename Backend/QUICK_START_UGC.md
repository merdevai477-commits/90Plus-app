# 🚀 Quick Start - UGC Compliance

## تشغيل سريع للاختبار

### 1. تثبيت Dependencies
```bash
cd Backend
npm install
```

### 2. تطبيق Schema Changes
```bash
npx prisma db push --accept-data-loss
npx prisma generate
```

### 3. تشغيل الاختبارات
```bash
npm run test:ugc
```

### 4. تشغيل السيرفر
```bash
npm run dev
```

---

## اختبار Endpoints يدوياً

### 1. EULA Status
```bash
curl -X GET http://localhost:3000/api/eula/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Accept EULA
```bash
curl -X POST http://localhost:3000/api/eula/accept \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version": "1.0"}'
```

### 3. Report Content
```bash
curl -X POST http://localhost:3000/api/reports/reel/REEL_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "spam", "additionalInfo": "This is spam"}'
```

### 4. Block User
```bash
curl -X POST http://localhost:3000/api/users/block/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Get Blocked Users
```bash
curl -X GET http://localhost:3000/api/users/blocked \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Admin: Get Reports
```bash
curl -X GET http://localhost:3000/api/admin/reports \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 7. Admin: Ban User
```bash
curl -X POST http://localhost:3000/api/admin/users/USER_ID/ban \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Violation of community guidelines"}'
```

---

## إنشاء Admin User

```sql
-- في Prisma Studio أو مباشرة في قاعدة البيانات
UPDATE users 
SET role = 'ADMIN' 
WHERE email = 'your-email@example.com';
```

---

## التحقق من Cron Jobs

Cron job يعمل تلقائياً كل ساعة للتحقق من التقارير المعلقة > 20 ساعة.

للتحقق من Logs:
```bash
# في السيرفر
tail -f logs/app.log | grep "Pending reports"
```

---

## Troubleshooting

### مشكلة: EULA fields not found
```bash
npx prisma db push --accept-data-loss
npx prisma generate
```

### مشكلة: Tests failing
```bash
# تأكد من أن السيرفر يعمل
npm run dev

# في terminal آخر
npm run test:ugc
```

### مشكلة: Content filter not working
```bash
# تأكد من تثبيت bad-words
npm install bad-words
```

---

## الملفات المهمة

- `Backend/src/routes/eula.routes.ts` - EULA endpoints
- `Backend/src/routes/reports.routes.ts` - Report endpoints
- `Backend/src/routes/user.routes.ts` - Block endpoints
- `Backend/src/routes/admin.routes.ts` - Admin endpoints
- `Backend/src/middleware/filter-content.middleware.ts` - Content filter
- `Backend/src/services/admin-notification.service.ts` - Admin notifications
- `Backend/tests/ugc-compliance.test.ts` - Test suite

---

## Next Steps

1. ✅ تشغيل الاختبارات
2. ✅ اختبار يدوي لكل endpoint
3. ✅ تسجيل فيديوهات على iOS
4. ✅ رفع للـ App Store Connect
5. ✅ Submit for Review

---

**جاهز للتقديم! 🎉**
