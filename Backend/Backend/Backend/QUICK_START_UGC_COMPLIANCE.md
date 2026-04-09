# 🚀 Quick Start: Apple UGC Compliance Integration

## ⏱️ Estimated Time: 2-3 hours

This guide will help you integrate all Apple UGC compliance features into your 90Plus app.

---

## Step 1: Install Dependencies (5 minutes)

```bash
# Backend
cd Backend
npm install bad-words

# Frontend (if needed)
cd ../front
npm install
```

---

## Step 2: Integrate EULA Guard (15 minutes)

### Edit `front/app/_layout.tsx`

Add the EULA guard to your root layout:

```typescript
import { useEULAGuard } from '../hooks/useEULAGuard';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const { isChecking, eulaAccepted } = useEULAGuard();
  
  // Show loading while checking EULA status
  if (isChecking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0E27' }}>
        <ActivityIndicator size="large" color="#00D9FF" />
      </View>
    );
  }
  
  // If EULA not accepted, user will be redirected by the hook
  // Continue with your normal layout
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="eula" options={{ headerShown: false, presentation: 'modal' }} />
      {/* ... rest of your screens */}
    </Stack>
  );
}
```

---

## Step 3: Apply Content Filtering (30 minutes)

### Edit Backend Routes

#### 1. Reels Routes (`Backend/src/routes/reels.routes.ts`)

```typescript
import { filterUGCContent, filterField } from '../middleware/filter-content.middleware';

// Apply to create and update endpoints
router.post('/', clerkMiddleware, filterUGCContent, createReel);
router.patch('/:id', clerkMiddleware, filterUGCContent, updateReel);
```

#### 2. Comments Routes (`Backend/src/routes/comments.routes.ts`)

```typescript
import { filterField } from '../middleware/filter-content.middleware';

router.post('/', clerkMiddleware, filterField('content'), createComment);
router.patch('/:id', clerkMiddleware, filterField('content'), updateComment);
```

#### 3. User Routes (`Backend/src/routes/user.routes.ts`)

```typescript
import { filterContentMiddleware } from '../middleware/filter-content.middleware';

router.patch('/profile', clerkMiddleware, filterContentMiddleware({
  fields: ['bio', 'displayName'],
  strict: true
}), updateProfile);
```

---

## Step 4: Test Locally (30 minutes)

### Test EULA Flow

1. Clear app data (uninstall and reinstall)
2. Sign up with new account
3. Verify EULA screen appears
4. Try to decline → should logout
5. Scroll to bottom → Accept button enables
6. Accept → should enter app
7. Close and reopen app → should NOT show EULA again

### Test Content Filtering

```bash
# Test with curl or Postman
curl -X POST http://localhost:3000/api/reels \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"caption": "This is a f**king test"}'

# Should return 400 error with message about community guidelines
```

### Test Report System

1. Long-press on any reel
2. Tap "Report"
3. Select reason
4. Add details (optional)
5. Submit
6. Verify success message

### Test Block System

1. Go to any user profile
2. Tap 3-dot menu
3. Tap "Block User"
4. Confirm
5. Verify user's content disappears from feed
6. Check blocked users list in settings

---

## Step 5: Deploy Backend (15 minutes)

```bash
cd Backend

# Commit changes
git add .
git commit -m "feat: Apple UGC compliance - EULA + content filtering"

# Push to Railway (or your hosting)
git push origin main

# Verify deployment
curl https://your-api.railway.app/health
```

---

## Step 6: Build and Test iOS (30 minutes)

```bash
cd front

# Build for iOS
eas build --platform ios --profile preview

# Or run locally on device
npm start
# Then scan QR code with iOS device
```

### Test on Physical Device

1. Install build on iPhone/iPad
2. Test all 3 flows:
   - EULA flow (fresh install)
   - Report flow
   - Block flow
3. Verify everything works smoothly

---

## Step 7: Record Screen Flows (30 minutes)

### Recording Checklist

1. **Setup**
   - Uninstall app completely
   - Enable Screen Recording in Control Center
   - Prepare to record in one take

2. **Start Recording**
   - Open Control Center
   - Tap Screen Recording button
   - Wait for 3-second countdown

3. **Flow 1: EULA**
   - Open app (fresh install)
   - EULA screen appears
   - Scroll to bottom slowly
   - Tap "Accept & Continue"
   - Enter main app

4. **Flow 2: Report**
   - Navigate to reels feed
   - Long-press on a reel
   - Tap "Report"
   - Select reason (e.g., "Spam")
   - Add details: "Testing report system"
   - Tap "Submit Report"
   - Show success message

5. **Flow 3: Block**
   - Navigate to a user profile
   - Tap 3-dot menu
   - Tap "Block User"
   - Confirm block
   - Go back to feed
   - Show that user's content is gone

6. **Stop Recording**
   - Open Control Center
   - Tap Screen Recording button
   - Video saved to Photos

7. **Upload**
   - Export video from Photos
   - Upload to cloud (Dropbox, Google Drive, etc.)
   - Get shareable link

---

## Step 8: Submit to App Store (15 minutes)

### Update App Version

```json
// front/app.json
{
  "expo": {
    "version": "1.0.1", // Increment version
    "ios": {
      "buildNumber": "2" // Increment build number
    }
  }
}
```

### Build for Production

```bash
cd front
eas build --platform ios --profile production
```

### Submit

```bash
eas submit --platform ios
```

### Add Review Notes

In App Store Connect → App Review Information → Notes:

```
Apple UGC Compliance - Guideline 1.2

We have implemented all required safety features:

1. EULA/Terms of Use Screen
   - Shown before accessing any UGC content
   - User must scroll to bottom and accept
   - Includes zero tolerance policy
   - Includes content removal rights

2. Content Filtering
   - Automatic profanity detection
   - Rejects inappropriate content
   - Supports English and Arabic

3. Report System
   - Report button on all UGC (reels, comments, profiles)
   - Multiple report reasons
   - 24-hour review commitment
   - Admin notification system

4. Block System
   - Block button on all user profiles
   - Instant content removal from feed
   - Admin notification on block

5. Admin Dashboard
   - Report management
   - User ban/suspend system
   - Audit logging

Screen Recording: [YOUR_VIDEO_LINK_HERE]

All features have been tested on physical iOS devices.
```

---

## ✅ Final Checklist

Before submitting, verify:

- [ ] bad-words installed in Backend
- [ ] EULA guard integrated in root layout
- [ ] Content filtering applied to all UGC routes
- [ ] EULA flow tested on fresh install
- [ ] Content filter rejects profanity
- [ ] Report system works end-to-end
- [ ] Block system removes content instantly
- [ ] Screen recording completed (all 3 flows)
- [ ] Screen recording uploaded and link added to review notes
- [ ] App version incremented
- [ ] Build created and submitted

---

## 🐛 Troubleshooting

### EULA Screen Not Showing

- Check if `useEULAGuard` is called in root layout
- Clear AsyncStorage: `AsyncStorage.clear()`
- Check backend `/api/eula/status` endpoint

### Content Filter Not Working

- Verify bad-words is installed: `npm list bad-words`
- Check middleware is applied to routes
- Test with curl/Postman first
- Check backend logs for errors

### Report System Not Working

- Verify token is valid
- Check network requests in React Native Debugger
- Verify backend endpoint is accessible
- Check admin routes are protected

### Block System Not Working

- Verify Block model exists in database
- Check if migration was run
- Test block endpoint with curl
- Verify feed queries filter blocked users

---

## 📞 Need Help?

If you encounter issues:

1. Check backend logs: `railway logs`
2. Check frontend logs: React Native Debugger
3. Test endpoints with curl/Postman
4. Review Apple's rejection feedback
5. Verify all files were created correctly

---

**Status:** Ready for Integration  
**Priority:** CRITICAL  
**Next Action:** Start with Step 1

Good luck with your App Store submission! 🚀
