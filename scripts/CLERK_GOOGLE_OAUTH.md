# إزالة اسم "Clerk" من Google Sign-In — 90Plus

عندما يظهر **"تسجيل الدخول إلى Clerk"** في Google، السبب أن Clerk Production لسه يستخدم **OAuth credentials مشتركة** أو مشروع Google باسم Clerk.

**الحل الوحيد 100%:** OAuth credentials **خاصة بك** باسم **90Plus** في Google Cloud.

---

## 1) Google Cloud Console

1. افتح [Google Cloud Console](https://console.cloud.google.com/)
2. أنشئ مشروع جديد (أو استخدم موجود) — اسم المشروع: **90Plus**
3. **APIs & Services → OAuth consent screen**
   - User Type: **External**
   - App name: **90Plus**
   - User support email: `merdevai477@gmail.com`
   - App logo: ارفع `90Plus.png`
   - App domain: `https://90plus.pro`
   - Privacy policy: `https://90plus.pro/privacy`
   - Terms of service: `https://90plus.pro/terms`
   - Authorized domains: `90plus.pro`
4. **Scopes:** `email`, `profile`, `openid` (افتراضي)
5. **Publish app** → Production (قد تحتاج verification من Google)

---

## 2) OAuth Client ID

**APIs & Services → Credentials → Create Credentials → OAuth client ID**

- Type: **Web application**
- Name: **90Plus Clerk**

**Authorized JavaScript origins:**
```
https://90plus.pro
https://accounts.90plus.pro
https://clerk.90plus.pro
```

**Authorized redirect URIs** (انسخ من Clerk Dashboard → Google SSO):
```
https://clerk.90plus.pro/v1/oauth_callback
```

> إذا Clerk أعطاك URI مختلف، استخدم **بالظبط** ما في Dashboard.

احفظ **Client ID** و **Client Secret**.

---

## 3) Clerk Dashboard (Production)

1. [dashboard.clerk.com](https://dashboard.clerk.com) → **Production**
2. **Configure → SSO connections → Google**
3. فعّل:
   - ✅ Enable for sign-up and sign-in
   - ✅ **Use custom credentials**
4. الصق **Client ID** و **Client Secret**
5. Save

---

## 4) Apple Sign In (نفس الفكرة)

1. [Apple Developer](https://developer.apple.com/) → **Identifiers**
2. **Services ID** للـ Sign in with Apple — اسم **90Plus**
3. Domains: `90plus.pro`, `clerk.90plus.pro`
4. Return URL: `https://clerk.90plus.pro/v1/oauth_callback`
5. Clerk Dashboard → **Apple** → custom credentials

---

## 5) Clerk Branding

Dashboard → **Customization → Branding**:
- Application name: **90Plus**
- Logo: `90Plus.png`
- Home URL: `https://90plus.pro`

---

## 6) Native app (تم في الكود)

- iOS Associated Domains: `webcredentials:clerk.90plus.pro`
- Redirect URLs: `ninetyplus://auth-callback`
- **Build جديد:** `eas build --profile production`

---

## تحقق

```powershell
npx tsx scripts/clerk-verify-production.ts
```

بعد Google OAuth verification، الشاشة هتقول **"90Plus"** بدل **"Clerk"**.
