# 🚀 تشغيل التطبيق مع Expo Tunnel (الطريقة الأسهل)

## ✅ الطريقة الأسهل - بدون ngrok!

Expo Tunnel بيعمل نفس وظيفة ngrok تلقائياً!

---

## 📋 الخطوات:

### 1️⃣ تشغيل Backend على Local Network

**Terminal 1 - Backend:**
```powershell
cd Backend
npm run dev
```

Backend هيشتغل على: `http://192.168.1.7:3000`

---

### 2️⃣ تشغيل Frontend مع Tunnel

**Terminal 2 - Frontend:**
```powershell
cd front
npx expo start --tunnel
```

**أو:**
```powershell
cd front
npm start
# ثم اضغط 't' لتفعيل tunnel
```

---

### 3️⃣ تحديث app.json (إذا لزم الأمر)

افتح `front/app.json` وتأكد من:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "http://192.168.1.7:3000/api"
    }
  }
}
```

---

## ✅ جاهز!

الآن:
- ✅ Backend يعمل على Local Network
- ✅ Frontend يعمل مع Expo Tunnel
- ✅ الموبايل يقدر يوصل للـ Backend عبر Local Network
- ✅ OAuth هيشتغل عادي!

---

## 🔧 إعداد Google OAuth للـ Local Network:

### في Google Cloud Console:

أضف Authorized redirect URIs:

```
http://192.168.1.7:3000/api/auth/google/callback
http://localhost:3000/api/auth/google/callback
```

### في Backend/.env:

```env
GOOGLE_CALLBACK_URL=http://192.168.1.7:3000/api/auth/google/callback
```

---

## 💡 ملاحظات:

### 1. Expo Tunnel vs ngrok:
- **Expo Tunnel:** أسهل، مدمج مع Expo، مجاني
- **ngrok:** أكثر مرونة، لكن محتاج setup إضافي

### 2. Local Network:
- Backend على `192.168.1.7:3000`
- الموبايل والكمبيوتر لازم يكونوا على نفس الـ WiFi

### 3. OAuth Redirect:
- Google OAuth هيرجع على `192.168.1.7:3000`
- Expo Tunnel هيوصل الطلب للتطبيق

---

## 🆘 حل المشاكل:

### 1. "Cannot connect to server"
```powershell
# تأكد من IP Address الصحيح
ipconfig
# ابحث عن IPv4 Address
```

### 2. "OAuth redirect failed"
- ✅ تأكد من إضافة `192.168.1.7:3000` في Google Console
- ✅ تأكد من تحديث `GOOGLE_CALLBACK_URL` في `.env`
- ✅ أعد تشغيل Backend

### 3. "Tunnel connection failed"
```powershell
# جرب إعادة تشغيل Expo
cd front
npx expo start --tunnel --clear
```

---

## 🎯 الخلاصة:

**بدلاً من ngrok، استخدم:**
1. Backend على Local Network (`192.168.1.7:3000`)
2. Frontend مع Expo Tunnel (`npx expo start --tunnel`)
3. OAuth redirect على Local IP

**أسهل وأسرع!** 🚀
