# إصلاح مشكلة الشروط والأحكام - Checkbox بدلاً من WebView

## المشكلة السابقة ❌

كان التطبيق يستخدم `TermsOfServiceModal` مع WebView لعرض الشروط والأحكام:
- **مشاكل WebView**: أخطاء في التحميل، GET /api/terms 404، GET /favicon.ico 404
- **تعقيد غير ضروري**: Modal كامل مع scroll tracking وتحقق من القراءة
- **رفض Apple**: المشاكل التقنية في WebView سببت رفض من Apple

## الحل الجديد ✅

### 1. Checkbox بسيط + لينك للمتصفح

بدلاً من WebView Modal معقد، الآن:
- ✅ Checkbox صغير قابل للنقر
- ✅ نص "أوافق على الشروط والأحكام"
- ✅ لينك "الشروط والأحكام" يفتح في المتصفح (Safari/Chrome)
- ✅ لا يمكن التسجيل بدون الموافقة

### 2. التغييرات المطبقة

#### في `front/app/auth/index.tsx`:

**أ. إزالة:**
- ❌ `TermsOfServiceModal` component
- ❌ `termsModalVisible` state
- ❌ `pendingSignupData` state
- ❌ `handleAcceptTerms` function

**ب. إضافة:**
- ✅ `termsAccepted` state (boolean)
- ✅ `handleOpenTerms()` - يفتح الشروط في المتصفح
- ✅ Checkbox UI في صفحة التسجيل
- ✅ التحقق من الموافقة قبل التسجيل

### 3. كيف يعمل الآن؟

```typescript
// 1. المستخدم يضغط على checkbox
<TouchableOpacity onPress={() => setTermsAccepted(!termsAccepted)}>
  <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
    {termsAccepted && <Text>✓</Text>}
  </View>
  <Text>
    أوافق على{' '}
    <Text onPress={handleOpenTerms}>الشروط والأحكام</Text>
  </Text>
</TouchableOpacity>

// 2. لو ضغط على "الشروط والأحكام" - يفتح في المتصفح
const handleOpenTerms = async () => {
  const termsUrl = `${getApiUrl()}/terms`;
  await Linking.openURL(termsUrl);
};

// 3. عند التسجيل - يتحقق من الموافقة
if (!termsAccepted) {
  Alert.alert('خطأ', 'يجب الموافقة على الشروط والأحكام للمتابعة');
  return;
}
```

### 4. المميزات

✅ **بسيط**: لا WebView، لا Modal معقد
✅ **سريع**: لا انتظار لتحميل HTML
✅ **قانوني**: المستخدم يوافق بوضوح قبل التسجيل
✅ **متوافق مع Apple**: لا مشاكل تقنية
✅ **تجربة أفضل**: يفتح في المتصفح المفضل للمستخدم

### 5. الشكل النهائي

```
┌─────────────────────────────────┐
│  [الاسم الكامل]                 │
│  [البريد الإلكتروني]            │
│  [كلمة المرور]                  │
│                                 │
│  ☑ أوافق على الشروط والأحكام   │
│     (الشروط والأحكام مسطر)      │
│                                 │
│  [زر التسجيل]                   │
└─────────────────────────────────┘
```

### 6. ملاحظات مهمة

- الـ checkbox يظهر فقط في صفحة التسجيل (Sign Up)
- لا يظهر في صفحة تسجيل الدخول (Login)
- الضغط على "الشروط والأحكام" يفتح: `https://90plus-app-production.up.railway.app/terms`
- لا يمكن التسجيل بدون تفعيل الـ checkbox

## الملفات المعدلة

- ✅ `front/app/auth/index.tsx` - إضافة checkbox وإزالة modal
- ℹ️ `front/components/common/TermsOfServiceModal.tsx` - لم يعد مستخدم (يمكن حذفه لاحقاً)

## الخطوة التالية

جرب التطبيق:
```bash
cd front
npx expo start --tunnel
```

ثم جرب التسجيل وتأكد من:
1. الـ checkbox يظهر في صفحة التسجيل
2. الضغط على "الشروط والأحكام" يفتح المتصفح
3. لا يمكن التسجيل بدون تفعيل الـ checkbox
4. بعد التفعيل، التسجيل يعمل بشكل طبيعي

## جاهز للـ Build 8 ✅

هذا الحل:
- ✅ يحل مشكلة WebView
- ✅ يحل مشكلة GET /api/terms 404
- ✅ متوافق مع Apple Guidelines
- ✅ قانوني وواضح للمستخدم
- ✅ بسيط وسريع
