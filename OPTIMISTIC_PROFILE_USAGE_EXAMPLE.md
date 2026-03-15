# نظام التحديث الفوري للبروفايل - أمثلة الاستخدام

## 🚀 كيفية الاستخدام

### 1. استخدام الـ Hook الأساسي

```typescript
import { useOptimisticProfile } from '../hooks/useOptimisticProfile';

const MyComponent = () => {
  const { updateProfile, isUpdating, showUpdateResult } = useOptimisticProfile();

  const handleUsernameChange = async (newUsername: string) => {
    const result = await updateProfile({ username: newUsername });
    showUpdateResult(result); // يعرض رسالة نجاح أو فشل
  };

  return (
    <TouchableOpacity 
      onPress={() => handleUsernameChange('new_username')}
      disabled={isUpdating}
    >
      <Text>{isUpdating ? 'جاري التحديث...' : 'تغيير اسم المستخدم'}</Text>
    </TouchableOpacity>
  );
};
```

### 2. استخدام الـ Hooks المتخصصة

```typescript
import { useProfileFieldUpdate } from '../hooks/useOptimisticProfile';

const ProfileEditor = () => {
  const { 
    updateUsername, 
    updateDisplayName, 
    updateBio,
    updateFIFACard,
    updateSocialLinks,
    updateFavorites,
    isUpdating 
  } = useProfileFieldUpdate();

  return (
    <View>
      {/* تحديث اسم المستخدم */}
      <TouchableOpacity onPress={() => updateUsername('new_username')}>
        <Text>تغيير اسم المستخدم</Text>
      </TouchableOpacity>

      {/* تحديث الاسم المعروض */}
      <TouchableOpacity onPress={() => updateDisplayName('اسم جديد')}>
        <Text>تغيير الاسم</Text>
      </TouchableOpacity>

      {/* تحديث البايو */}
      <TouchableOpacity onPress={() => updateBio('بايو جديد')}>
        <Text>تحديث البايو</Text>
      </TouchableOpacity>

      {/* تحديث بيانات FIFA Card */}
      <TouchableOpacity onPress={() => updateFIFACard({
        position: 'RW',
        countryFlag: '🇪🇬',
        age: 25,
        height: 180,
        weight: 75,
        preferredFoot: 'Right'
      })}>
        <Text>تحديث بيانات FIFA</Text>
      </TouchableOpacity>

      {/* تحديث روابط السوشيال ميديا */}
      <TouchableOpacity onPress={() => updateSocialLinks({
        instagram: 'https://instagram.com/username',
        twitter: 'https://twitter.com/username',
        youtube: 'https://youtube.com/channel'
      })}>
        <Text>تحديث روابط السوشيال</Text>
      </TouchableOpacity>

      {/* تحديث المفضلات */}
      <TouchableOpacity onPress={() => updateFavorites({
        favoriteTeam: 'Real Madrid',
        favoriteClub: 'Barcelona',
        favoriteBrand: 'Nike'
      })}>
        <Text>تحديث المفضلات</Text>
      </TouchableOpacity>
    </View>
  );
};
```

### 3. التحديث المجمع (Batch Updates)

```typescript
import { useBatchProfileUpdate } from '../hooks/useOptimisticProfile';

const BatchUpdateExample = () => {
  const { updateMultipleFields, isUpdating } = useBatchProfileUpdate();

  const handleCompleteProfileUpdate = async () => {
    await updateMultipleFields({
      displayName: 'محمد أحمد',
      bio: 'لاعب كرة قدم محترف',
      position: 'RW',
      countryFlag: '🇪🇬',
      age: 25,
      favoriteTeam: 'Real Madrid',
      socialLinks: {
        instagram: 'https://instagram.com/mohamed',
        twitter: 'https://twitter.com/mohamed'
      }
    });
  };

  return (
    <TouchableOpacity 
      onPress={handleCompleteProfileUpdate}
      disabled={isUpdating}
    >
      <Text>تحديث البروفايل كاملاً</Text>
    </TouchableOpacity>
  );
};
```

## 🔧 كيف يعمل النظام

### 1. التحديث الفوري (Optimistic Update)
```
المستخدم يضغط "تحديث" → UI يتغير فوراً → طلب يُرسل للباك إند
```

### 2. التحقق من القيود
```
الباك إند يتحقق من:
- قيود اليوزر نيم (15 يوم)
- توفر اليوزر نيم
- صحة البيانات
```

### 3. النتيجة
```
✅ نجح: البيانات تُحفظ نهائياً
❌ فشل: UI يرجع للحالة الأصلية + رسالة خطأ
```

## 🛡️ معالجة الأخطاء

### خطأ قيود اليوزر نيم
```typescript
// إذا حاول المستخدم تغيير اليوزر نيم قبل انتهاء 15 يوم
{
  success: false,
  error: "يمكنك تغيير اسم المستخدم بعد 5 أيام",
  canRetry: false,
  nextAllowedChange: new Date('2024-01-15')
}
```

### خطأ شبكة
```typescript
{
  success: false,
  error: "مشكلة في الاتصال، يرجى المحاولة مرة أخرى",
  canRetry: true
}
```

### اليوزر نيم مأخوذ
```typescript
{
  success: false,
  error: "اسم المستخدم غير متاح",
  canRetry: false
}
```

## 📱 تجربة المستخدم

### ✅ المزايا
- **سرعة فائقة**: UI يتحدث فوراً
- **تجربة سلسة**: لا انتظار للاستجابة
- **ردود فعل واضحة**: رسائل نجاح/فشل مع haptic feedback
- **حماية من الأخطاء**: rollback تلقائي عند الفشل

### 🔄 سيناريوهات الاستخدام

#### سيناريو 1: تحديث ناجح
```
1. المستخدم يغير الاسم من "أحمد" إلى "محمد"
2. UI يعرض "محمد" فوراً
3. الباك إند يحفظ التغيير
4. رسالة نجاح + haptic feedback
```

#### سيناريو 2: فشل بسبب قيود اليوزر نيم
```
1. المستخدم يحاول تغيير اليوزر نيم
2. UI يعرض اليوزر نيم الجديد فوراً
3. الباك إند يرفض (لم تمر 15 يوم)
4. UI يرجع لليوزر نيم الأصلي
5. رسالة خطأ: "يمكنك التغيير بعد X أيام"
```

#### سيناريو 3: فشل شبكة
```
1. المستخدم يحدث البايو
2. UI يعرض البايو الجديد فوراً
3. فشل في الإرسال للباك إند
4. UI يرجع للبايو الأصلي
5. رسالة خطأ + إمكانية إعادة المحاولة
```

## 🎯 نصائح للاستخدام الأمثل

1. **استخدم الـ Hooks المتخصصة** للعمليات البسيطة
2. **استخدم Batch Updates** للتحديثات المتعددة
3. **اعتمد على showUpdateResult** لعرض النتائج
4. **لا تتجاهل isUpdating** لمنع التحديثات المتعددة
5. **اختبر سيناريوهات الفشل** للتأكد من الـ rollback

هذا النظام يوفر تجربة مستخدم ممتازة مع حماية كاملة من الأخطاء! 🚀