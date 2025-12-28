# 👤 صفحة البروفايل (Profile) - دليل شامل

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [معلومات المستخدم](#معلومات-المستخدم)
3. [الإحصائيات](#الإحصائيات)
4. [التبويبات](#التبويبات)
5. [بطاقة الفيفا](#بطاقة-الفيفا)
6. [الإنجازات](#الإنجازات)
7. [الواجهة والتصميم](#الواجهة-والتصميم)
8. [التفاصيل التقنية](#التفاصيل-التقنية)

---

## 🎯 نظرة عامة

صفحة البروفايل هي الهوية الرقمية للمستخدم حيث يمكنه:
- 👤 **عرض معلوماته** الشخصية
- 📊 **متابعة إحصائياته** وإنجازاته
- 🎴 **إنشاء بطاقة FIFA** احترافية
- 🏆 **عرض الإنجازات** والشارات
- 📹 **مشاركة الفيديوهات**
- ⚙️ **إدارة الحساب**

### المسار
```
app/(tabs)/profile.tsx
components/FifaCard.tsx
```

---

## 👤 معلومات المستخدم

### البيانات الأساسية

```typescript
interface UserProfile {
  id: string;
  name: string;              // الاسم
  username: string;          // اسم المستخدم
  avatar: string;            // الصورة الشخصية
  coverImage?: string;       // صورة الغلاف
  bio?: string;              // النبذة
  location?: string;         // الموقع
  joinDate: Date;            // تاريخ الانضمام
  verified: boolean;         // حساب موثق
  
  // Social
  followers: number;         // المتابعون
  following: number;         // المتابَعون
  
  // Stats
  level: number;             // المستوى
  rank: number;              // الترتيب
  totalPoints: number;       // إجمالي النقاط
  goldCoins: number;         // العملات الذهبية
}
```

### Header البروفايل

```
┌─────────────────────────────────────┐
│  [صورة الغلاف]                      │
│                                     │
│     [الصورة الشخصية]                │
│                                     │
│     أحمد محمد ✓                     │
│     @ahmed_mohamed                  │
│     🇪🇬 القاهرة، مصر                │
│                                     │
│  📊 المستوى 25  🏆 الترتيب #142    │
│                                     │
│  👥 1.2K متابع  👤 340 متابَع       │
└─────────────────────────────────────┘
```

---

## 📊 الإحصائيات

### Stats Cards

```
┌─────────────────────────────────────┐
│  ┌──────────┬──────────┬──────────┐ │
│  │ 🎯 التوقعات│ 📊 الدقة │ 🧠 الكويز│ │
│  │    156    │   78%   │   1,250  │ │
│  └──────────┴──────────┴──────────┘ │
│                                     │
│  ┌──────────┬──────────┬──────────┐ │
│  │ 🏆 الإنجازات│ 📹 الفيديوهات│ 💰 العملات│ │
│  │     24    │    12   │   450   │ │
│  └──────────┴──────────┴──────────┘ │
└─────────────────────────────────────┘
```

### الإحصائيات التفصيلية

```typescript
interface UserStats {
  // التوقعات
  totalPredictions: number;      // إجمالي التوقعات
  correctPredictions: number;    // التوقعات الصحيحة
  predictionAccuracy: number;    // نسبة الدقة
  bestStreak: number;            // أفضل سلسلة
  currentStreak: number;         // السلسلة الحالية
  
  // الكويز
  quizScore: number;             // نقاط الكويز
  quizAccuracy: number;          // دقة الكويز
  totalQuizzes: number;          // إجمالي الألعاب
  
  // التفاعل
  totalViews: number;            // المشاهدات
  totalLikes: number;            // الإعجابات
  totalComments: number;         // التعليقات
  totalShares: number;           // المشاركات
  
  // الإنجازات
  achievements: number;          // عدد الإنجازات
  badges: Badge[];               // الشارات
  
  // المحتوى
  videos: number;                // عدد الفيديوهات
  posts: number;                 // عدد المنشورات
}
```

---

## 📑 التبويبات

### 1. البروفايلات (Profiles)

**بطاقة FIFA:**
```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐   │
│  │  [بطاقة FIFA احترافية]     │   │
│  │                             │   │
│  │  أحمد محمد                  │   │
│  │  85 OVR                     │   │
│  │                             │   │
│  │  PAC 88  SHO 85            │   │
│  │  PAS 82  DRI 87            │   │
│  │  DEF 45  PHY 78            │   │
│  └─────────────────────────────┘   │
│                                     │
│  [إنشاء بطاقة]  [مشاركة]  [QR]    │
└─────────────────────────────────────┘
```

**الميزات:**
- 🎴 تصميم بطاقة FIFA أصلي
- 📊 إحصائيات قابلة للتخصيص
- 🎨 ألوان وتدرجات احترافية
- 📱 مشاركة كصورة
- 📲 QR Code للمشاركة السريعة

### 2. فيديوهاتي (My Videos)

**Grid View:**
```
┌─────────────────────────────────────┐
│  ┌────┬────┬────┐                   │
│  │ 📹 │ 📹 │ 📹 │                   │
│  │ 1K │ 2K │ 500│                   │
│  ├────┼────┼────┤                   │
│  │ 📹 │ 📹 │ 📹 │                   │
│  │ 3K │ 1K │ 800│                   │
│  └────┴────┴────┘                   │
└─────────────────────────────────────┘
```

**معلومات الفيديو:**
- 📹 Thumbnail
- 👁️ عدد المشاهدات
- ❤️ عدد الإعجابات
- 💬 عدد التعليقات
- ⏱️ المدة

### 3. إنجازاتي (My Achievements)

**عرض الإنجازات:**
```
┌─────────────────────────────────────┐
│  🏆 الإنجازات المفتوحة (24)        │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  🥇 العبقري                 │   │
│  │  20/20 في الكويز            │   │
│  │  تم الفتح: 15 نوفمبر 2024  │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  🔥 الملك                   │   │
│  │  سلسلة 10+ متتالية          │   │
│  │  تم الفتح: 18 نوفمبر 2024  │   │
│  └─────────────────────────────┘   │
│                                     │
│  🔒 الإنجازات المقفلة (12)         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  🎯 الخبير                  │   │
│  │  100 توقع صحيح              │   │
│  │  التقدم: 67/100             │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 4. التفاعلات (Interactions)

**أنواع التفاعل:**
- ❤️ الإعجابات
- 💬 التعليقات
- 🔄 المشاركات
- 👥 المتابعون الجدد
- 🔔 الإشعارات

### 5. النشاط (Activity)

**سجل النشاط:**
```
┌─────────────────────────────────────┐
│  📅 اليوم                            │
│  ✅ توقع صحيح على مباراة ريال مدريد │
│  ⏰ منذ ساعتين                      │
│                                     │
│  🎮 أكمل كويز بنتيجة 18/20         │
│  ⏰ منذ 4 ساعات                     │
│                                     │
│  📅 أمس                             │
│  ❤️ أعجب بـ 5 فيديوهات             │
│  ⏰ منذ يوم                         │
└─────────────────────────────────────┘
```

---

## 🎴 بطاقة الفيفا (FIFA Card)

### التصميم

```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐   │
│  │ [Gradient Background]       │   │
│  │                             │   │
│  │  85                         │   │
│  │  OVR                        │   │
│  │                             │   │
│  │  [صورة اللاعب]              │   │
│  │                             │   │
│  │  أحمد محمد                  │   │
│  │  مهاجم                      │   │
│  │                             │   │
│  │  PAC 88    DRI 87          │   │
│  │  SHO 85    DEF 45          │   │
│  │  PAS 82    PHY 78          │   │
│  │                             │   │
│  │  [شعار النادي]              │   │
│  │  [علم الدولة]               │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### المكونات

**1. Overall Rating (OVR)**
- 🎯 التقييم الإجمالي (0-99)
- 🎨 لون حسب التقييم:
  - 🟤 Bronze (0-64)
  - 🥈 Silver (65-74)
  - 🥇 Gold (75-99)

**2. الإحصائيات الستة**
```typescript
{
  PAC: number;  // السرعة (Pace)
  SHO: number;  // التسديد (Shooting)
  PAS: number;  // التمرير (Passing)
  DRI: number;  // المراوغة (Dribbling)
  DEF: number;  // الدفاع (Defending)
  PHY: number;  // القوة البدنية (Physical)
}
```

**3. المعلومات الإضافية**
- 📝 الاسم
- ⚽ المركز
- 🏟️ النادي
- 🌍 الجنسية

### التخصيص

**خيارات التخصيص:**
```typescript
interface CardCustomization {
  cardType: 'gold' | 'silver' | 'bronze' | 'special';
  background: string;        // لون الخلفية
  playerImage: string;       // صورة اللاعب
  clubLogo: string;          // شعار النادي
  countryFlag: string;       // علم الدولة
  stats: PlayerStats;        // الإحصائيات
}
```

### المشاركة

**خيارات المشاركة:**
- 📱 حفظ كصورة
- 🔗 مشاركة الرابط
- 📲 QR Code
- 📧 إرسال بالبريد
- 💬 مشاركة على وسائل التواصل

---

## 🏆 الإنجازات

### أنواع الإنجازات

**1. إنجازات التوقعات**
```typescript
{
  id: 'prediction_master',
  title: 'سيد التوقعات',
  description: '100 توقع صحيح',
  icon: '🎯',
  requirement: 100,
  reward: 500, // عملات ذهبية
}
```

**2. إنجازات الكويز**
```typescript
{
  id: 'quiz_genius',
  title: 'العبقري',
  description: '20/20 في الكويز',
  icon: '🧠',
  requirement: 1,
  reward: 1000,
}
```

**3. إنجازات التفاعل**
```typescript
{
  id: 'social_butterfly',
  title: 'الفراشة الاجتماعية',
  description: '1000 تفاعل',
  icon: '🦋',
  requirement: 1000,
  reward: 300,
}
```

**4. إنجازات السلسلة**
```typescript
{
  id: 'streak_king',
  title: 'ملك السلسلة',
  description: 'سلسلة 10+ متتالية',
  icon: '🔥',
  requirement: 10,
  reward: 750,
}
```

### Progress Tracking

```
┌─────────────────────────────────────┐
│  🎯 سيد التوقعات                    │
│  100 توقع صحيح                      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ████████████░░░░░░░░ 67%    │   │
│  └─────────────────────────────┘   │
│  67/100                             │
│                                     │
│  💰 المكافأة: 500 عملة ذهبية       │
└─────────────────────────────────────┘
```

---

## 🎨 الواجهة والتصميم

### Color Scheme

**Primary Colors:**
- 🟢 Primary: `#22c55e` (أخضر)
- 🔵 Secondary: `#3b82f6` (أزرق)
- 🟡 Accent: `#f59e0b` (برتقالي)

**Background:**
- ⚫ Dark: `#0a0a0a`
- 🌑 Card: `#1a1a1a`
- 🌫️ Border: `#333`

### Animations

**1. Profile Load**
```typescript
Animated.parallel([
  Animated.timing(fadeAnim, {
    toValue: 1,
    duration: 600,
  }),
  Animated.spring(slideAnim, {
    toValue: 0,
    tension: 50,
  }),
]).start();
```

**2. Stats Cards**
```typescript
Animated.stagger(100, [
  Animated.spring(card1Anim, { toValue: 1 }),
  Animated.spring(card2Anim, { toValue: 1 }),
  Animated.spring(card3Anim, { toValue: 1 }),
]).start();
```

**3. Achievement Unlock**
```typescript
Animated.sequence([
  Animated.spring(scaleAnim, {
    toValue: 1.2,
    tension: 50,
  }),
  Animated.spring(scaleAnim, {
    toValue: 1,
    tension: 100,
  }),
]).start();
```

---

## ⚙️ الإعدادات والإجراءات

### قائمة الإجراءات

```
┌─────────────────────────────────────┐
│  ⚙️ الإعدادات                       │
│  🔔 الإشعارات                       │
│  🌍 اللغة                           │
│  🎨 المظهر                          │
│  📊 الإحصائيات                      │
│  🔒 الخصوصية                        │
│  ❓ المساعدة                        │
│  🚪 تسجيل الخروج                    │
└─────────────────────────────────────┘
```

### تعديل البروفايل

**الحقول القابلة للتعديل:**
- 📸 الصورة الشخصية
- 🖼️ صورة الغلاف
- 📝 الاسم
- 👤 اسم المستخدم
- 📄 النبذة
- 📍 الموقع
- 🔗 الروابط الاجتماعية

---

## 🔧 التفاصيل التقنية

### State Management

```typescript
const [profile, setProfile] = useState<UserProfile | null>(null);
const [stats, setStats] = useState<UserStats | null>(null);
const [achievements, setAchievements] = useState<Achievement[]>([]);
const [videos, setVideos] = useState<Video[]>([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [activeTab, setActiveTab] = useState('profiles');
```

### Data Loading

```typescript
const loadProfile = async () => {
  try {
    setLoading(true);
    
    const [profileData, statsData, achievementsData, videosData] = 
      await Promise.all([
        fetchProfile(userId),
        fetchStats(userId),
        fetchAchievements(userId),
        fetchVideos(userId),
      ]);
    
    setProfile(profileData);
    setStats(statsData);
    setAchievements(achievementsData);
    setVideos(videosData);
  } catch (error) {
    console.error('Error loading profile:', error);
  } finally {
    setLoading(false);
  }
};
```

### Pull to Refresh

```typescript
const onRefresh = async () => {
  setRefreshing(true);
  await loadProfile();
  setRefreshing(false);
};
```

---

## 📱 الأداء

### Optimization

**1. Image Optimization**
```typescript
<Image
  source={{ uri: avatar }}
  style={styles.avatar}
  resizeMode="cover"
  loadingIndicatorSource={placeholder}
/>
```

**2. Lazy Loading**
```typescript
<FlatList
  data={videos}
  renderItem={renderVideo}
  initialNumToRender={6}
  maxToRenderPerBatch={6}
  windowSize={5}
/>
```

**3. Memoization**
```typescript
const StatsCard = React.memo(({ stat }) => {
  // Component logic
});
```

---

## 🌍 الترجمة

### النصوص المترجمة

```typescript
t.profile.title
t.profile.myProfile
t.profile.editProfile
t.profile.shareProfile
t.profile.viewQR
t.profile.settings
t.profile.notifications
t.profile.level
t.profile.rank
t.profile.followers
t.profile.following
t.profile.totalPredictions
t.profile.accuracy
t.profile.quizScore
t.profile.achievements
t.profile.videos
t.profile.profiles
t.profile.myVideos
t.profile.myAchievements
t.profile.interactions
t.profile.activity
```

---

## 📊 الإحصائيات النهائية

### الكود
- **~800 سطر** من الكود
- **5 تبويبات** رئيسية
- **100% TypeScript**

### الميزات
- ✅ **بطاقة FIFA** احترافية
- ✅ **نظام إنجازات** كامل
- ✅ **إحصائيات** تفصيلية
- ✅ **تبويبات** متعددة
- ✅ **Animations** سلسة
- ✅ **QR Code** للمشاركة
- ✅ **Performance optimized**

---

**تم التوثيق بواسطة:** MrDev
**التاريخ:** 20 نوفمبر 2024
**الإصدار:** 1.0.0
**الحالة:** ✅ مكتمل ومختبر
