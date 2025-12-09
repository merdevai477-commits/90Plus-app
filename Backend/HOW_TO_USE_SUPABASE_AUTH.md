# 🔄 كيفية استخدام Supabase Auth

## الخطوات للتبديل إلى Supabase Auth

### 1. إعداد Supabase
اتبع التعليمات في `SUPABASE_AUTH_SETUP.md`

### 2. إضافة متغيرات البيئة
أضف في ملف `.env` في مجلد `Backend`:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. استبدال الملفات في Backend

#### Option A: استبدال كامل (موصى به)
```powershell
# نسخ احتياطي للملفات القديمة
cd Backend/src/controllers
Copy-Item auth.controller.ts auth.controller.old.ts
Copy-Item ../middleware/auth.middleware.ts ../middleware/auth.middleware.old.ts

# استبدال الملفات
Copy-Item auth.controller.supabase.ts auth.controller.ts
Copy-Item ../middleware/auth.middleware.supabase.ts ../middleware/auth.middleware.ts
```

#### Option B: استخدام الملفات الجديدة مباشرة
عدّل `auth.routes.ts` لاستيراد من الملفات الجديدة:
```typescript
import { register, login, ... } from '../controllers/auth.controller.supabase';
import { authenticateToken } from '../middleware/auth.middleware.supabase';
```

### 4. تحديث Frontend

#### Option A: استبدال كامل
```powershell
cd front/services
Copy-Item auth.service.ts auth.service.old.ts
Copy-Item auth.service.supabase.ts auth.service.ts
```

#### Option B: استخدام الملف الجديد
عدّل الاستيراد في الملفات التي تستخدم `authService`:
```typescript
import { authService } from '../services/auth.service.supabase';
```

### 5. إضافة متغيرات البيئة في Frontend
أضف في ملف `.env` في مجلد `front`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 6. تحديث app.json (لـ Expo)
أضف في `app.json`:
```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "https://xxxxx.supabase.co",
      "supabaseAnonKey": "your-anon-key"
    }
  }
}
```

### 7. تشغيل المشروع
```powershell
# Backend
cd Backend
npm run dev

# Frontend
cd front
npm start
```

## ✅ المزايا بعد التبديل
- ✅ إدارة تلقائية للجلسات
- ✅ دعم OAuth (Google, Facebook, Apple)
- ✅ Magic Links
- ✅ Phone Authentication
- ✅ أمان محسّن
- ✅ مجاني في الخطة المجانية

## ⚠️ ملاحظات مهمة
1. **لا تشارك `SUPABASE_SERVICE_ROLE_KEY` أبداً!**
2. استخدم `SUPABASE_ANON_KEY` في Frontend فقط
3. استخدم `SUPABASE_SERVICE_ROLE_KEY` في Backend فقط
4. تأكد من تفعيل Email provider في Supabase Dashboard

## 🔄 العودة للنظام القديم
إذا أردت العودة للنظام القديم:
```powershell
# Backend
cd Backend/src/controllers
Copy-Item auth.controller.old.ts auth.controller.ts
cd ../middleware
Copy-Item auth.middleware.old.ts auth.middleware.ts

# Frontend
cd front/services
Copy-Item auth.service.old.ts auth.service.ts
```

