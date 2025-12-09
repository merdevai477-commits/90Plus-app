# 🚀 دليل استخدام ngrok مع Expo Go

## 📋 الخطوات الكاملة:

### 1️⃣ تثبيت ngrok (إذا لم يكن مثبت)

```powershell
# باستخدام Chocolatey
choco install ngrok

# أو حمّل من الموقع
# https://ngrok.com/download
```

---

### 2️⃣ تشغيل ngrok مع Backend

#### الطريقة السهلة (موصى بها):
```powershell
cd Backend
.\start-ngrok-expo.ps1
```

#### الطريقة اليدوية:

**Terminal 1 - ngrok:**
```powershell
ngrok http 3000
```

**Terminal 2 - Backend:**
```powershell
cd Backend
npm run dev
```

---

### 3️⃣ الحصول على ngrok URL

بعد تشغيل ngrok، ستحصل على URL مثل:
```
https://abc123.ngrok-free.app
```

يمكنك رؤيته في:
- نافذة ngrok
- http://localhost:4040 (ngrok web interface)

---

### 4️⃣ تحديث Frontend (app.json)

افتح `front/app.json` وعدّل:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://abc123.ngrok-free.app/api"
    }
  }
}
```

**⚠️ مهم:** استبدل `abc123.ngrok-free.app` بـ ngrok URL الخاص بك!

---

### 5️⃣ إعادة تشغيل Expo

```powershell
cd front
npm start
```

ثم اضغط `r` لإعادة تحميل التطبيق في Expo Go.

---

### 6️⃣ (اختياري) تحديث Google OAuth

إذا كنت تستخدم Google OAuth:

1. **Google Cloud Console:**
   - اذهب إلى: https://console.cloud.google.com/
   - APIs & Services → Credentials
   - أضف Authorized redirect URI:
   ```
   https://abc123.ngrok-free.app/api/auth/google/callback
   ```

2. **تحديث .env:**
   ```env
   GOOGLE_CALLBACK_URL="https://abc123.ngrok-free.app/api/auth/google/callback"
   ```

---

## ⚠️ ملاحظات مهمة:

### 1. ngrok URL يتغير في كل مرة
- **Free plan:** URL يتغير في كل مرة تشغل ngrok
- **Paid plan:** يمكنك الحصول على URL ثابت

### 2. تحديث app.json في كل مرة
- كل مرة تشغل ngrok وتحصل على URL جديد، يجب تحديث `app.json`
- أو استخدم ngrok URL ثابت (paid plan)

### 3. CORS
- الباك إند يدعم ngrok URLs تلقائياً
- لا حاجة لتعديل CORS settings

---

## 🎯 نصائح:

### للحصول على URL ثابت (Free):
1. سجل حساب في ngrok (مجاني)
2. احصل على authtoken
3. استخدم:
   ```powershell
   ngrok config add-authtoken YOUR_TOKEN
   ngrok http 3000 --domain=your-domain.ngrok-free.app
   ```

### لمراقبة الطلبات:
- افتح: http://localhost:4040
- ستشاهد جميع الطلبات في الوقت الفعلي

---

## ✅ الخلاصة:

1. شغّل `.\start-ngrok-expo.ps1`
2. انسخ ngrok URL
3. حدّث `front/app.json` → `apiUrl`
4. أعد تشغيل Expo
5. جاهز! 🎉

---

## 🆘 حل المشاكل:

### ngrok لا يعمل:
- تأكد من تثبيت ngrok
- تأكد من أن البورت 3000 غير مستخدم
- جرب: `ngrok http 3000` يدوياً

### التطبيق لا يتصل:
- تأكد من تحديث `app.json`
- تأكد من إعادة تشغيل Expo
- تحقق من ngrok URL في http://localhost:4040

### CORS errors:
- تأكد من أن ngrok URL يبدأ بـ `https://`
- تأكد من تحديث CORS في Backend (موجود تلقائياً)

