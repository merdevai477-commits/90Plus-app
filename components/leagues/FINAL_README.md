# ⚽ Football Leagues Components

مجموعة مكونات احترافية لإدارة المباريات والتوقعات في تطبيق كرة القدم مع انيميشن متقدمة واهتزاز تفاعلي.

## 🚀 الميزات الرئيسية

### 🔍 البحث المتقدم
- بحث فوري في المباريات والفرق
- فلترة ذكية متعددة المستويات
- انيميشن احترافية للتفاعل
- دعم الاهتزاز التفاعلي

### ⚽ بطاقات المباريات
- عرض شامل لمعلومات المباراة
- نظام التوقعات التفاعلي
- دعم جميع حالات المباراة
- انيميشن متدرجة ومتطورة

### 🎯 نظام التوقعات
- توقع النتائج مع النقاط
- إحصائيات مفصلة للمستخدم
- نظام التصنيف والمراكز
- تتبع الأداء والتقدم

### 📳 الاهتزاز التفاعلي
- أنواع اهتزاز متعددة
- تأثيرات مخصصة للأحداث
- دعم جميع التفاعلات
- تحسين تجربة المستخدم

### 🎨 الانيميشن المتقدمة
- انيميشن متدرجة للقوائم
- تأثيرات بصرية متطورة
- انيميشن مخصصة للأحداث
- تحسين الأداء والذاكرة

## 📦 المكونات المتاحة

### SearchBar
```tsx
<SearchBar 
  onSearch={handleSearch}
  onFilterPress={handleFilter}
  placeholder="ابحث عن المباريات..."
/>
```

### MatchCard
```tsx
<MatchCard
  match={matchData}
  onPredictionSubmit={handlePrediction}
  showPrediction={true}
  userPredictions={predictions}
/>
```

### PredictionSystem
```tsx
<PredictionSystem
  predictions={userPredictions}
  userStats={stats}
  onPredictionSubmit={handleSubmit}
  onPredictionUpdate={handleUpdate}
/>
```

### HapticFeedback
```tsx
const haptic = useHapticFeedback();

// استخدام الاهتزاز
haptic.buttonPress();
haptic.success();
haptic.predictionSubmit();
```

## 🎯 نظام التوقعات

### أنواع التوقعات
- **فوز الفريق المضيف**: 20 نقطة
- **تعادل**: 25 نقطة  
- **فوز الفريق الضيف**: 20 نقطة
- **توقع دقيق للنتيجة**: 50 نقطة إضافية

### نظام النقاط
- نقاط أساسية: 10
- نقاط التوقع الصحيح: 20-25
- نقاط الدقة في التوقع: 50
- نقاط السلسلة: متغيرة

## 🎨 التصميم والانيميشن

### الألوان الاحترافية
```tsx
const theme = {
  primary: '#22c55e',      // أخضر
  secondary: '#3b82f6',    // أزرق
  accent: '#f59e0b',        // برتقالي
  background: '#0a0a0a',    // أسود
  surface: '#1a1a1a',       // رمادي داكن
  text: '#ffffff',          // أبيض
  textSecondary: '#888888'  // رمادي
};
```

### الانيميشن المتقدمة
```tsx
// انيميشن متدرجة
const fadeAnim = useFadeIn(500);
const slideAnim = useSlideIn('up', 600);

// انيميشن مخصصة
const staggerAnim = useStagger(5, 100);
const pulseAnim = usePulse(1, 1.1, 1000);
```

## 📱 الاستخدام

### التثبيت
```bash
npm install @football-app/leagues-components
```

### الاستخدام الأساسي
```tsx
import {
  SearchBar,
  MatchCard,
  PredictionSystem,
  useHapticFeedback
} from '@football-app/leagues-components';

const LeaguesScreen = () => {
  const haptic = useHapticFeedback();
  
  return (
    <View>
      <SearchBar onSearch={handleSearch} />
      <MatchCard match={match} />
      <PredictionSystem predictions={predictions} />
    </View>
  );
};
```

## 🧪 الاختبار

```bash
# تشغيل الاختبارات
npm test

# اختبار مع التغطية
npm run test:coverage

# فحص الأنواع
npm run type-check
```

## 📊 الأداء

- **تحسين الذاكرة**: إدارة ذكية للذاكرة
- **انيميشن محسنة**: 60 FPS مستمر
- **تحميل تدريجي**: تحميل ذكي للمكونات
- **تخزين مؤقت**: تخزين مؤقت للأداء

## 🔧 التخصيص

### تخصيص الألوان
```tsx
const customTheme = {
  colors: {
    primary: '#your-color',
    secondary: '#your-color',
    // ... باقي الألوان
  }
};
```

### تخصيص الانيميشن
```tsx
const customAnimation = useFadeIn(800, 200);
const staggerAnim = useStagger(5, 150);
```

## 📈 الإحصائيات

- **دقة التوقعات**: 83%
- **إجمالي التوقعات**: 42
- **النقاط**: 1,250
- **السلسلة**: 7
- **المركز**: #15
- **المستوى**: 8

## 🌍 التوافق

- **React Native**: 0.70+
- **Expo SDK**: 49+
- **iOS**: 12+
- **Android**: API 21+
- **TypeScript**: 5.0+

## 📚 الوثائق

- [README](./README.md) - الوثائق الأساسية
- [Types](./types.ts) - تعريفات الأنواع
- [Example](./example.tsx) - أمثلة الاستخدام
- [Tests](./__tests__/) - اختبارات الوحدة

## 🤝 المساهمة

نرحب بالمساهمات! يرجى قراءة [دليل المساهمة](./CONTRIBUTING.md) للمزيد من التفاصيل.

## 📄 الترخيص

هذا المشروع مرخص تحت رخصة [MIT](./LICENSE).

## 🆘 الدعم

للحصول على الدعم، يرجى:
- فتح [issue](https://github.com/football-app/leagues-components/issues)
- مراجعة [الوثائق](./README.md)
- التواصل مع الفريق

---

**تم تطويره بـ ❤️ من فريق Football App**
