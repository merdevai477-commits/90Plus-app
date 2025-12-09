# ⚡ حل سريع - البورت 3000 مستخدم

## 🚀 الحل السريع (أفضل طريقة):

```powershell
cd Backend
.\start-clean.ps1
```

هذا السكريبت سيقوم بـ:
- ✅ إيقاف جميع عمليات node على البورت 3000
- ✅ تشغيل Backend تلقائياً

---

## 🔧 حل يدوي:

### Windows PowerShell:
```powershell
# إيقاف جميع عمليات node
taskkill /F /IM node.exe

# أو
Get-Process node | Stop-Process -Force
```

### ثم شغّل Backend:
```powershell
cd Backend
npm run dev
```

---

## ⚠️ إذا استمرت المشكلة:

### الحل 1: انتظر 5-10 ثوان
البورت قد يكون في حالة `TIME_WAIT` وسيختفي تلقائياً.

### الحل 2: غيّر البورت
في `Backend/.env`:
```env
PORT=3001
```

ثم في `front/app.json`:
```json
{
  "expo": {
    "extra": {
      "apiUrl": "http://192.168.1.7:3001/api"
    }
  }
}
```

---

## 💡 نصيحة:

استخدم `.\start-clean.ps1` دائماً لتجنب هذه المشكلة!

