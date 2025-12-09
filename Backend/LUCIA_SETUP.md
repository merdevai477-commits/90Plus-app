# 🔐 إعداد Lucia Auth - دليل شامل

## ✅ تم إكمال إعداد Lucia بنجاح!

### 📋 ما تم إنجازه:

#### 1. إعدادات Lucia (`src/config/lucia.config.ts`)
- ✅ تكوين PrismaAdapter مع Session و User models
- ✅ إعداد session cookies مع الأمان المناسب
- ✅ تعريف UserAttributes (username, email, avatar, coins, level, etc.)
- ✅ TypeScript declarations للـ types

#### 2. Authentication Middleware (`src/middleware/auth.middleware.ts`)
- ✅ `authMiddleware`: يقرأ ويحقق من session cookies
- ✅ `requireAuth`: يحمي المسارات التي تحتاج authentication
- ✅ CSRF protection محسّن (يتخطى للـ mobile apps)
- ✅ Session refresh تلقائي

#### 3. Auth Service (`src/services/auth.service.ts`)
- ✅ `signup()`: إنشاء مستخدم جديد مع session
- ✅ `login()`: تسجيل دخول وإنشاء session
- ✅ `logout()`: إلغاء session

#### 4. Auth Controller (`src/controllers/auth.controller.ts`)
- ✅ `POST /api/auth/signup` - تسجيل مستخدم جديد
- ✅ `POST /api/auth/login` - تسجيل دخول
- ✅ `POST /api/auth/logout` - تسجيل خروج
- ✅ `GET /api/auth/me` - الحصول على معلومات المستخدم الحالي

#### 5. Routes (`src/routes/auth.routes.ts`)
- ✅ جميع المسارات تستخدم `authMiddleware`
- ✅ `/me` محمي بـ `requireAuth`

---

## 🚀 كيفية الاستخدام

### 1. تسجيل مستخدم جديد (Signup)

```bash
POST http://localhost:3000/api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "username": "username",
  "displayName": "User Name"
}
```

**Response:**
```json
{
  "status": "SUCCESS",
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "...",
      "email": "user@example.com",
      "username": "username",
      "displayName": "User Name",
      "avatar": null,
      "coins": 0,
      "level": 1,
      "isVerified": false,
      "isDeveloper": false
    }
  }
}
```

**ملاحظة:** Session cookie يتم إرساله تلقائياً في `Set-Cookie` header.

---

### 2. تسجيل دخول (Login)

```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "status": "SUCCESS",
  "message": "Login successful",
  "data": {
    "user": {
      "id": "...",
      "email": "user@example.com",
      "username": "username",
      ...
    }
  }
}
```

**ملاحظة:** Session cookie يتم إرساله تلقائياً في `Set-Cookie` header.

---

### 3. الحصول على معلومات المستخدم (Me)

```bash
GET http://localhost:3000/api/auth/me
Cookie: auth_session=...
```

**Response:**
```json
{
  "status": "SUCCESS",
  "data": {
    "id": "...",
    "username": "username",
    "email": "user@example.com",
    "avatar": null,
    "displayName": "User Name",
    "coins": 0,
    "level": 1,
    "isVerified": false,
    "isDeveloper": false
  }
}
```

---

### 4. تسجيل خروج (Logout)

```bash
POST http://localhost:3000/api/auth/logout
Cookie: auth_session=...
```

**Response:**
```json
{
  "status": "SUCCESS",
  "message": "Logged out successfully"
}
```

---

## 🔒 الأمان

### Session Cookies
- ✅ `httpOnly`: true (لا يمكن الوصول من JavaScript)
- ✅ `secure`: true في production (HTTPS only)
- ✅ `sameSite`: 'lax' (حماية من CSRF)
- ✅ `path`: '/' (متاح لجميع المسارات)

### CSRF Protection
- ✅ يتم التحقق من Origin header للـ non-GET requests
- ✅ يتخطى CSRF check للـ mobile apps (Expo/React Native)
- ✅ يمكن إضافة header `x-mobile-app: true` للـ mobile requests

---

## 📱 استخدام مع Mobile Apps

### React Native / Expo

```typescript
// Login example
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-mobile-app': 'true', // Skip CSRF check
  },
  credentials: 'include', // Important for cookies
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
  }),
});

// Cookies are automatically handled by fetch with credentials: 'include'
```

---

## 🛠️ Troubleshooting

### المشكلة: Session cookie لا يتم حفظه
**الحل:**
- تأكد من استخدام `credentials: 'include'` في fetch requests
- تأكد من أن CORS يسمح بـ credentials: `credentials: true`

### المشكلة: CSRF error في mobile app
**الحل:**
- أضف header `x-mobile-app: true` في requests
- أو تأكد من أن User-Agent يحتوي على 'Expo' أو 'ReactNative'

### المشكلة: Session expires quickly
**الحل:**
- Sessions في Lucia تدوم لمدة 30 يوم افتراضياً
- يمكن تعديل المدة في `lucia.config.ts`

---

## 📝 ملاحظات مهمة

1. **Session Management**: Lucia يدير sessions تلقائياً في قاعدة البيانات
2. **Password Hashing**: يتم استخدام bcrypt مع salt rounds = 10
3. **User ID**: يتم توليده باستخدام `generateIdFromEntropySize(10)`
4. **Session Refresh**: يتم تحديث session cookie تلقائياً عند كل request

---

## ✅ الحالة الحالية

- ✅ Lucia مُعد بالكامل
- ✅ جميع endpoints جاهزة
- ✅ Middleware يعمل بشكل صحيح
- ✅ CSRF protection مفعّل
- ✅ Session management تلقائي

**جاهز للاستخدام! 🎉**

