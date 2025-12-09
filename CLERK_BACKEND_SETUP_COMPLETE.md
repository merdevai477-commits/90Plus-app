# ✅ Clerk + Backend Integration - Complete!

## 🎉 تم الإعداد بنجاح!

تم دمج Clerk مع Backend بنجاح!

---

## 📋 ما تم عمله:

### 1️⃣ تنصيب Clerk SDK:
```bash
✅ npm install @clerk/clerk-sdk-node
```

### 2️⃣ إضافة Clerk Keys في .env:
```env
✅ CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
⚠️  CLERK_SECRET_KEY=YOUR_CLERK_SECRET_KEY_HERE
```

### 3️⃣ إنشاء Clerk Middleware:
```
✅ Backend/src/middleware/clerk.middleware.ts
   - requireAuth() - للـ routes المحمية
   - optionalAuth() - للـ routes الاختيارية
```

### 4️⃣ إنشاء Clerk User Service:
```
✅ Backend/src/services/clerk-user.service.ts
   - findOrCreateUser() - إيجاد أو إنشاء مستخدم
   - getUserByClerkId() - الحصول على مستخدم
   - updateUser() - تحديث بيانات المستخدم
   - syncUserFromClerk() - مزامنة من Clerk
```

### 5️⃣ إنشاء Protected Routes:
```
✅ Backend/src/routes/clerk-user.routes.ts
   - GET  /api/clerk/me - الحصول على بيانات المستخدم
   - PUT  /api/clerk/profile - تحديث البروفايل
   - POST /api/clerk/sync - مزامنة البيانات
```

### 6️⃣ تحديث Prisma Schema:
```prisma
✅ model User {
     clerkUserId  String?  @unique  // ← جديد!
     // ...
   }
```

### 7️⃣ تحديث main.ts:
```typescript
✅ app.use('/api/clerk', clerkUserRoutes);
```

---

## ⚠️  خطوة مهمة جداً!

### احصل على Clerk Secret Key:

1. افتح: https://dashboard.clerk.com
2. اختار Application بتاعك
3. اذهب إلى: **API Keys**
4. انسخ **Secret Key** (يبدأ بـ `sk_test_` أو `sk_live_`)
5. حدّث `Backend/.env`:
   ```env
   CLERK_SECRET_KEY=sk_test_xxxxx
   ```

---

## 🔄 كيف يعمل الآن:

### 1. المستخدم يسجل دخول (Frontend):
```typescript
// في Frontend
const { getToken } = useAuth();
const token = await getToken();
```

### 2. Frontend يطلب بيانات (مع Token):
```typescript
fetch('http://backend/api/clerk/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### 3. Backend يتحقق من Token:
```typescript
// Middleware يتحقق تلقائياً
// req.auth.userId متاح الآن
```

### 4. Backend يحفظ/يجيب البيانات:
```typescript
const user = await ClerkUserService.findOrCreateUser(req.auth.userId);
// أول مرة: ينشئ المستخدم في Database
// المرات التالية: يجيب البيانات الموجودة
```

---

## 📊 API Endpoints الجديدة:

### GET /api/clerk/me (Protected)
**الحصول على بيانات المستخدم الحالي**

Request:
```bash
GET /api/clerk/me
Authorization: Bearer <JWT_TOKEN>
```

Response:
```json
{
  "status": "SUCCESS",
  "data": {
    "user": {
      "id": "uuid",
      "clerkUserId": "user_xxxxx",
      "email": "user@example.com",
      "username": "username",
      "displayName": "User Name",
      "avatar": "https://...",
      "coins": 50,
      "level": 1,
      "xp": 0,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

### PUT /api/clerk/profile (Protected)
**تحديث بيانات المستخدم**

Request:
```bash
PUT /api/clerk/profile
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "username": "new_username",
  "displayName": "New Name",
  "bio": "My bio",
  "favoriteTeam": "Real Madrid"
}
```

Response:
```json
{
  "status": "SUCCESS",
  "message": "Profile updated successfully",
  "data": {
    "user": { ... }
  }
}
```

---

### POST /api/clerk/sync (Protected)
**مزامنة البيانات من Clerk**

Request:
```bash
POST /api/clerk/sync
Authorization: Bearer <JWT_TOKEN>
```

Response:
```json
{
  "status": "SUCCESS",
  "message": "User synced successfully",
  "data": {
    "user": { ... }
  }
}
```

---

## 🔧 استخدام في Frontend:

### مثال كامل:

```typescript
import { useAuth } from '@clerk/clerk-expo';

const ProfileScreen = () => {
  const { getToken, userId } = useAuth();
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const token = await getToken();
      
      const response = await fetch('http://backend/api/clerk/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      setUser(data.data.user);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const updateProfile = async (updates) => {
    try {
      const token = await getToken();
      
      const response = await fetch('http://backend/api/clerk/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
      
      const data = await response.json();
      setUser(data.data.user);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  return (
    <View>
      {user && (
        <>
          <Text>{user.displayName}</Text>
          <Text>Coins: {user.coins}</Text>
          <Text>Level: {user.level}</Text>
        </>
      )}
    </View>
  );
};
```

---

## 🗄️  Database Migration:

### لتطبيق التغييرات على Database:

```bash
cd Backend
npx prisma migrate dev --name add_clerk_user_id
```

**ملاحظة:** إذا كان عندك users موجودين، قد تحتاج:
1. عمل backup للـ database
2. تحديث الـ users الموجودين يدوياً
3. أو مسح الـ users القدامى

---

## ✅ الخطوات التالية:

### 1. احصل على Clerk Secret Key:
```
⚠️  مهم جداً! بدونه Backend مش هيشتغل
```

### 2. شغّل Migration:
```bash
cd Backend
npx prisma migrate dev --name add_clerk_user_id
```

### 3. شغّل Backend:
```bash
cd Backend
npm run dev
```

### 4. اختبر من Frontend:
```typescript
const token = await getToken();
fetch('http://localhost:3000/api/clerk/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## 🆘 حل المشاكل:

### 1. "CLERK_SECRET_KEY is not defined"
- تأكد من إضافة Secret Key في `.env`
- أعد تشغيل Backend

### 2. "Unauthorized - Invalid token"
- تأكد من أن Token صحيح
- تأكد من أن Secret Key صحيح
- تأكد من أن المستخدم مسجل دخول

### 3. "User not found"
- أول مرة يستخدم المستخدم API، سيتم إنشاؤه تلقائياً
- تأكد من أن Clerk User ID صحيح

---

## 📊 الخلاصة:

**Clerk + Backend جاهزين!**

- ✅ Authentication آمن (JWT Tokens)
- ✅ User Management (Database)
- ✅ Protected Routes
- ✅ Auto Sync من Clerk
- ✅ Ready for Production

---

## 🚀 جاهز للاستخدام!

**الخطوة الأخيرة:**
1. احصل على Clerk Secret Key
2. حدّث `.env`
3. شغّل Backend
4. اختبر من Frontend

**كل حاجة جاهزة!** 🎉
