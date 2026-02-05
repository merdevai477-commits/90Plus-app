# ⚡ Apple Compliance - Quick Integration Guide (15 Minutes)

## 🎯 الهدف: إضافة Report & Block Buttons في UI

---

## 1️⃣ إضافة Report Button في Reels (5 دقائق)

### الملف: `front/components/reels/` (أي ملف فيه Reel three-dot menu)

```typescript
// 1. Import
import { ReportContentModal } from '../common/ReportContentModal';
import { useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';

// 2. State
const [reportModalVisible, setReportModalVisible] = useState(false);
const { getToken } = useAuth();

// 3. في three-dot menu (أضف هذا الخيار)
<TouchableOpacity 
  style={styles.menuItem}
  onPress={() => {
    setMenuVisible(false); // أغلق القائمة
    setReportModalVisible(true); // افتح Report Modal
  }}
>
  <Ionicons name="flag-outline" size={20} color={COLORS.error} />
  <Text style={styles.menuText}>Report</Text>
</TouchableOpacity>

// 4. Modal (أضف في نهاية الـ component)
<ReportContentModal
  visible={reportModalVisible}
  onClose={() => setReportModalVisible(false)}
  contentType="reel"
  contentId={reel.id}
  getToken={getToken}
/>
```

---

## 2️⃣ إضافة Report Button في Comments (5 دقائق)

### الملف: `front/components/common/CommentsModal.tsx`

```typescript
// 1. Import
import { ReportContentModal } from './ReportContentModal';

// 2. State
const [reportModalVisible, setReportModalVisible] = useState(false);
const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);

// 3. في comment long-press menu
const handleReportComment = (commentId: string) => {
  setSelectedCommentId(commentId);
  setReportModalVisible(true);
};

// في menu options
<TouchableOpacity onPress={() => handleReportComment(comment.id)}>
  <Ionicons name="flag-outline" size={20} color={COLORS.error} />
  <Text>Report</Text>
</TouchableOpacity>

// 4. Modal
<ReportContentModal
  visible={reportModalVisible}
  onClose={() => {
    setReportModalVisible(false);
    setSelectedCommentId(null);
  }}
  contentType="comment"
  contentId={selectedCommentId || ''}
  getToken={getToken}
/>
```

---

## 3️⃣ إضافة Block Button في User Profile (3 دقائق)

### الملف: `front/app/user/[username].tsx`

```typescript
// 1. Import
import { Alert } from 'react-native';
import { getApiUrl } from '../../config/api.config';

// 2. Handler
const handleBlockUser = async () => {
  Alert.alert(
    'Block User',
    `Are you sure you want to block @${username}?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await getToken();
            const response = await fetch(`${getApiUrl()}/users/block/${userId}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            });
            
            const data = await response.json();
            if (data.status === 'SUCCESS') {
              Alert.alert('Success', 'User blocked successfully');
              router.back();
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to block user');
          }
        },
      },
    ]
  );
};

// 3. في profile header (three-dot menu)
<TouchableOpacity onPress={handleBlockUser}>
  <Ionicons name="ban-outline" size={20} color={COLORS.error} />
  <Text>Block User</Text>
</TouchableOpacity>
```

---

## 4️⃣ إضافة Blocked Users في Settings (2 دقيقة)

### الملف: `front/app/(tabs)/settings.tsx`

```typescript
// 1. في Privacy & Security section (ابحث عن "Privacy" أو "Security")
<TouchableOpacity 
  style={styles.settingItem}
  onPress={() => router.push('/blocked-users')}
>
  <View style={styles.settingLeft}>
    <Ionicons name="ban-outline" size={22} color={COLORS.primary} />
    <Text style={styles.settingText}>Blocked Users</Text>
  </View>
  <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
</TouchableOpacity>
```

### إنشاء Route: `front/app/blocked-users.tsx`

```typescript
import React from 'react';
import { Stack } from 'expo-router';
import { BlockedUsersScreen } from '../components/Settings/BlockedUsersScreen';
import { COLORS } from '../components/reels/constants';

export default function BlockedUsersPage() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Blocked Users',
          headerStyle: { backgroundColor: COLORS.background },
          headerTintColor: COLORS.white,
          headerShadowVisible: false,
        }}
      />
      <BlockedUsersScreen />
    </>
  );
}
```

---

## ✅ Checklist

### Integration:
- [ ] Report button في Reels
- [ ] Report button في Comments
- [ ] Block button في User Profile
- [ ] Blocked Users في Settings
- [ ] Blocked Users route

### Testing:
- [ ] Report Reel يعمل
- [ ] Report Comment يعمل
- [ ] Block User يعمل
- [ ] Unblock User يعمل
- [ ] Blocked Users list يظهر

### Final:
- [ ] Test على Device
- [ ] Build للـ TestFlight
- [ ] Submit to Apple

---

## 🚀 بعد الإكمال

```bash
# 1. Test everything
npm run dev

# 2. Build for iOS
cd front
eas build --platform ios --profile production

# 3. Submit to TestFlight
eas submit --platform ios

# 4. Submit to Apple for Review
# من App Store Connect
```

---

## 📝 ملاحظات

- كل الـ Components جاهزة ✅
- كل الـ Backend APIs جاهزة ✅
- فقط محتاج تضيف الـ buttons في UI ⚡
- الوقت المتوقع: **15 دقيقة** ⏱️

---

## 🎉 Done!

بعد ما تخلص الـ 4 خطوات دول، التطبيق يكون **100% متوافق** مع Apple Guidelines! 🚀
