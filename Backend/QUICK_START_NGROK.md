# ⚡ تشغيل سريع - ngrok مع Expo Go

## 🚀 خطوة واحدة فقط!

```powershell
cd Backend
.\start-ngrok-expo.ps1
```

---

## 📝 ماذا يحدث:

1. ✅ يبدأ ngrok تلقائياً
2. ✅ يعرض ngrok URL
3. ✅ ينتظرك لتحديث `app.json`
4. ✅ يبدأ Backend server

---

## 🔄 بعد الحصول على ngrok URL:

### 1. افتح `front/app.json`

### 2. غيّر `apiUrl`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://YOUR_NGROK_URL.ngrok-free.app/api"
    }
  }
}
```

### 3. أعد تشغيل Expo:

```powershell
cd front
npm start
# ثم اضغط 'r' لإعادة التحميل
```

---

## ✅ جاهز!

الآن التطبيق في Expo Go سيتصل بالباك إند عبر ngrok!

---

## 💡 نصيحة:

- افتح http://localhost:4040 لمراقبة الطلبات
- ngrok URL يتغير في كل مرة (Free plan)
- للحصول على URL ثابت: سجل حساب ngrok مجاني

