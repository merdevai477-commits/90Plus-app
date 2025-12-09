# 🔧 حل مشكلة البورت 3000 مستخدم

## المشكلة:
```
Error: listen EADDRINUSE: address already in use :::3000
```

## الحلول:

### ✅ الحل 1: إيقاف العملية (موصى به)

#### Windows PowerShell:
```powershell
# إيجاد العملية
Get-NetTCPConnection -LocalPort 3000

# إيقاف العملية (استبدل PID بالرقم الفعلي)
Stop-Process -Id PID -Force

# أو إيقاف جميع عمليات node
Get-Process node | Stop-Process -Force
```

#### Windows CMD:
```cmd
netstat -ano | findstr :3000
taskkill /PID [PID] /F
```

---

### ✅ الحل 2: تغيير البورت

#### 1. تحديث `.env`:
```env
PORT=3001
```

#### 2. تحديث `front/app.json`:
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

### ✅ الحل 3: استخدام سكريبت تلقائي

أنشئ ملف `kill-port.ps1`:
```powershell
$port = 3000
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($process) {
    Stop-Process -Id $process.OwningProcess -Force
    Write-Host "✅ تم إيقاف العملية على البورت $port"
} else {
    Write-Host "ℹ️ لا توجد عملية على البورت $port"
}
```

---

## 🎯 نصيحة:

قبل تشغيل Backend، استخدم:
```powershell
Get-Process node | Stop-Process -Force
```

أو أنشئ سكريبت `start-clean.ps1`:
```powershell
# إيقاف جميع عمليات node
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# بدء Backend
cd Backend
npm run dev
```

