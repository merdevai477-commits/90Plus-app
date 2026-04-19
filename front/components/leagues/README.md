# Leagues Components

مجموعة مكونات احترافية لإدارة المباريات والتوقعات في تطبيق كرة القدم.

## المكونات المتاحة

### 1. SearchBar
مكون البحث المتقدم مع انيميشن وتفاعل احترافي.

**الميزات:**
- بحث فوري مع انيميشن
- فلترة سريعة
- تأثيرات بصرية متقدمة
- دعم الاهتزاز

**الاستخدام:**
```tsx
<SearchBar 
  onSearch={handleSearch}
  onFilterPress={handleFilter}
  placeholder="ابحث عن المباريات..."
/>
```

### 2. MatchCard
بطاقة المباراة الاحترافية مع نظام التوقعات المتقدم.

**الميزات:**
- عرض معلومات المباراة
- نظام التوقعات التفاعلي
- انيميشن متقدم
- دعم جميع حالات المباراة (مباشر، انتهت، قادمة)
- نظام النقاط

**الاستخدام:**
```tsx
<MatchCard
  match={matchData}
  onPredictionSubmit={handlePrediction}
  showPrediction={true}
  userPredictions={predictions}
/>
```

### 3. PredictionSystem
نظام التوقعات الشامل مع الإحصائيات.

**الميزات:**
- عرض إحصائيات المستخدم
- فلترة التوقعات
- نظام النقاط المتقدم
- انيميشن متدرج

**الاستخدام:**
```tsx
<PredictionSystem
  predictions={userPredictions}
  userStats={stats}
  onPredictionSubmit={handleSubmit}
  onPredictionUpdate={handleUpdate}
/>
```

### 4. HapticFeedback
نظام الاهتزاز المتقدم للتفاعل مع المستخدم.

**الميزات:**
- أنواع اهتزاز متعددة
- تأثيرات مخصصة
- دعم جميع التفاعلات

**الاستخدام:**
```tsx
const haptic = useHapticFeedback();

// استخدام الاهتزاز
haptic.buttonPress();
haptic.success();
haptic.predictionSubmit();
```

### 5. Animations
مجموعة شاملة من الانيميشن المتقدمة.

**الميزات:**
- انيميشن متدرجة
- تأثيرات بصرية متقدمة
- انيميشن مخصصة
- تحسين الأداء

**الاستخدام:**
```tsx
import { useFadeIn, useSlideIn, useStagger } from './Animations';

const fadeAnim = useFadeIn(500);
const slideAnim = useSlideIn('up', 600);
```

## نظام التوقعات

### أنواع التوقعات
1. **فوز الفريق المضيف** - 20 نقطة
2. **تعادل** - 25 نقطة  
3. **فوز الفريق الضيف** - 20 نقطة
4. **توقع دقيق للنتيجة** - 50 نقطة إضافية

### نظام النقاط
- نقاط أساسية: 10
- نقاط التوقع الصحيح: 20-25
- نقاط الدقة في التوقع: 50
- نقاط السلسلة: متغيرة

## الميزات المتقدمة

### الانيميشن
- انيميشن متدرجة للقوائم
- تأثيرات بصرية للتفاعل
- انيميشن مخصصة للأحداث
- تحسين الأداء

### الاهتزاز
- اهتزاز خفيف للتفاعلات البسيطة
- اهتزاز متوسط للأحداث المهمة
- اهتزاز قوي للإنجازات
- أنماط مخصصة للأحداث الخاصة

### التصميم
- ألوان احترافية
- تدرجات متقدمة
- ظلال وتأثيرات
- تصميم متجاوب

## الاستخدام المتقدم

### تخصيص الألوان
```tsx
const customStyles = {
  primaryColor: '#22c55e',
  secondaryColor: '#3b82f6',
  accentColor: '#f59e0b',
  backgroundColor: '#1a1a1a',
  textColor: '#fff'
};
```

### تخصيص الانيميشن
```tsx
const customAnimation = useFadeIn(800, 200);
const staggerAnim = useStagger(5, 150);
```

### إدارة الحالة
```tsx
const [predictions, setPredictions] = useState([]);
const [userStats, setUserStats] = useState(defaultStats);
```

## الأداء

- تحسين الذاكرة
- انيميشن محسنة
- تحميل تدريجي
- تخزين مؤقت ذكي

## التوافق

- React Native 0.70+
- Expo SDK 49+
- iOS 12+
- Android API 21+

## الترخيص

هذا المشروع مرخص تحت رخصة MIT.
