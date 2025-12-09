# 📋 خطوات إضافة Redirect URLs في Clerk Dashboard

## 🎯 الهدف:
إضافة Redirect URLs عشان OAuth يشتغل

---

## 📝 الخطوات بالتفصيل:

### 1️⃣ افتح Clerk Dashboard

في المتصفح، اذهب إلى:
```
https://dashboard.clerk.com
```

سجل دخول بحسابك

---

### 2️⃣ اختر المشروع

إذا عندك أكثر من مشروع، اختار:
```
glowing-thrush-12
```
(أو المشروع اللي بتستخدمه)

---

### 3️⃣ اذهب إلى Configure

من القائمة الجانبية على الشمال:
```
Configure
```

---

### 4️⃣ اختر Paths

من قائمة Configure:
```
Paths
```

---

### 5️⃣ ابحث عن Allowed redirect URLs

في الصفحة، هتلاقي قسم اسمه:
```
Allowed redirect URLs
```

---

### 6️⃣ أضف الـ URLs

في الـ text box، أضف:

**URL 1:**
```
footballproapp://
```

اضغط Enter أو Add

**URL 2:**
```
exp://192.168.1.7:8081
```

اضغط Enter أو Add

---

### 7️⃣ احفظ التغييرات

اضغط على زر:
```
Save
```
أو
```
Update
```

---

### 8️⃣ تأكد من الحفظ

المفروض تشوف رسالة:
```
✅ Settings saved successfully
```

---

## ✅ النتيجة النهائية:

في قسم **Allowed redirect URLs**، المفروض تشوف:

```
┌─────────────────────────────────────┐
│ footballproapp://                   │
│ ✓ Added                             │
├─────────────────────────────────────┤
│ exp://192.168.1.7:8081             │
│ ✓ Added                             │
└─────────────────────────────────────┘
```

---

## 🔄 بعد الحفظ:

### 1. أعد تشغيل Expo:
```bash
# أوقف Expo (Ctrl+C)
cd front
npm start --clear
```

### 2. جرب OAuth:
- افتح التطبيق
- اضغط Google
- **هيشتغل!** ✅

---

## 🆘 لو مش لاقي "Paths":

### جرب:
1. **Configure** → **Settings** → **Paths**
2. أو ابحث في الـ search bar عن: `redirect`
3. أو اذهب مباشرة إلى:
   ```
   https://dashboard.clerk.com/apps/[YOUR_APP_ID]/paths
   ```

---

## 📱 ملاحظات مهمة:

### IP Address:
- لازم يكون نفس IP الكمبيوتر
- لو IP اتغير، حدث الـ URL في Clerk

### Port:
- Expo بيستخدم port `8081` (default)
- لو بتستخدم port تاني، غيره في الـ URL

### Scheme:
- `footballproapp://` لازم يكون نفس الـ scheme في `app.json`

---

## ✅ Checklist:

- [ ] فتحت Clerk Dashboard
- [ ] اخترت المشروع الصحيح
- [ ] دخلت على Configure → Paths
- [ ] أضفت `footballproapp://`
- [ ] أضفت `exp://192.168.1.7:8081`
- [ ] حفظت التغييرات
- [ ] أعدت تشغيل Expo
- [ ] جربت OAuth

---

**بعد ما تخلص الخطوات دي، OAuth هيشتغل 100%!** 🚀
