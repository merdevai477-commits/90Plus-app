# 🚀 TASK 1 - Integration Guide
## How to Integrate the Fixed Profile Completion Hook

---

## 📦 Step 1: Update profile.tsx

Replace the disabled hook with the new one:

```typescript
// ❌ OLD CODE (Remove this)
// TEMPORARILY DISABLED: Profile completion hook causing infinite loop
const completionStatus = null;
const isCompletionLoading = false;
const completionError = null;
const markStepCompleted = () => Promise.resolve(false);

// ✅ NEW CODE (Add this)
import { useProfileCompletion } from '../../hooks/useProfileCompletion';
import ProfileErrorBoundary from '../../components/common/ProfileErrorBoundary';

// Inside ProfileScreen component:
const {
  completionStatus,
  isLoading: isCompletionLoading,
  error: completionError,
  refresh: refreshCompletion,
  markStepCompleted,
} = useProfileCompletion();
```

---

## 📦 Step 2: Wrap ProfileScreen with Error Boundary

In `front/app/(tabs)/_layout.tsx` or directly in `profile.tsx`:

```typescript
import ProfileErrorBoundary from '../../../components/common/ProfileErrorBoundary';

// Wrap the entire ProfileScreen
export default function ProfileScreen() {
  return (
    <ProfileErrorBoundary
      maxRenderCount={50}
      onError={(error, errorInfo) => {
        // Optional: Send to error tracking service
        console.error('[ProfileScreen] Error:', error);
      }}
    >
      <ProfileScreenContent />
    </ProfileErrorBoundary>
  );
}

// Move all existing code to ProfileScreenContent
function ProfileScreenContent() {
  // ... existing ProfileScreen code
}
```

---

## 📦 Step 3: Add ProfileCompletionCard

Replace the old card with the new fixed one:

```typescript
// ❌ OLD CODE (Remove if exists)
// import { ProfileCompletionCard } from '../../components/profile/ProfileCompletionCard';

// ✅ NEW CODE (Add this)
import ProfileCompletionCard from '../../components/profile/ProfileCompletionCardFixed';

// Inside ProfileScreen render:
{completionStatus && (
  <ProfileCompletionCard
    onStepPress={(stepId) => {
      // Handle step press (open appropriate modal)
      switch (stepId) {
        case 'avatar':
          handleImageUpload();
          break;
        case 'country':
          setIsCountryModalVisible(true);
          break;
        case 'club':
          setIsClubModalVisible(true);
          break;
        case 'bio':
          setIsEditProfileModalVisible(true);
          break;
        case 'position':
          setIsPositionModalVisible(true);
          break;
        case 'cardData':
          setIsStatsModalVisible(true);
          break;
        case 'brand':
          setIsBrandModalVisible(true);
          break;
        case 'socialLinks':
          setIsEditProfileModalVisible(true);
          break;
      }
    }}
  />
)}
```

---

## 📦 Step 4: Track Profile Updates

When user updates profile fields, mark steps as completed:

```typescript
// After successful avatar upload:
await markStepCompleted('avatar');

// After country selection:
await markStepCompleted('country');

// After club selection:
await markStepCompleted('club');

// After bio update:
if (bio && bio.trim() !== '') {
  await markStepCompleted('bio');
}

// After position selection:
await markStepCompleted('position');

// After stats update (all fields filled):
if (age && height && weight && foot) {
  await markStepCompleted('cardData');
}

// After brand selection:
await markStepCompleted('brand');

// After social links update:
if (socialLinks && Object.keys(socialLinks).length > 0) {
  await markStepCompleted('socialLinks');
}
```

---

## 📦 Step 5: Enforce Video Upload Restriction

Check if user can upload video:

```typescript
import { canUploadVideo } from '../../hooks/useProfileCompletion';

// In handleUploadVideo function:
const handleUploadVideo = async (newVideo: any) => {
  // Check if profile is complete enough
  if (!canUploadVideo(completionStatus)) {
    toastManager.showWarning(
      'أكمل بروفايلك',
      'يجب إكمال 3 خطوات على الأقل لرفع الفيديوهات'
    );
    return;
  }
  
  // ... rest of upload logic
};
```

---

## 📦 Step 6: Run Tests

```bash
# Run unit tests
npm test -- useProfileCompletion.test.ts

# Run all tests
npm test

# Run with coverage
npm test -- --coverage
```

---

## 📦 Step 7: Manual Testing Checklist

### Test Scenarios:

1. **Initial Load**
   - [ ] Open ProfileScreen
   - [ ] Check completion card appears
   - [ ] Check percentage is correct
   - [ ] Check no console errors
   - [ ] Check no infinite loop

2. **Expand/Collapse**
   - [ ] Tap on completion card
   - [ ] Check steps list expands smoothly
   - [ ] Tap again to collapse
   - [ ] Check animation is smooth

3. **Complete Steps**
   - [ ] Upload avatar → Check step marked complete
   - [ ] Select country → Check step marked complete
   - [ ] Select club → Check step marked complete
   - [ ] Update bio → Check step marked complete
   - [ ] Select position → Check step marked complete
   - [ ] Update stats → Check step marked complete
   - [ ] Select brand → Check step marked complete
   - [ ] Add social links → Check step marked complete

4. **Video Upload Restriction**
   - [ ] Try to upload video with <3 steps complete
   - [ ] Check warning message appears
   - [ ] Complete 3 required steps
   - [ ] Try to upload video again
   - [ ] Check upload works

5. **Refresh**
   - [ ] Pull to refresh ProfileScreen
   - [ ] Check completion status updates
   - [ ] Check no duplicate API calls

6. **Error Handling**
   - [ ] Disconnect internet
   - [ ] Open ProfileScreen
   - [ ] Check error message appears
   - [ ] Tap retry button
   - [ ] Check retry works

7. **App State Changes**
   - [ ] Open ProfileScreen
   - [ ] Go to background (home button)
   - [ ] Return to app
   - [ ] Check completion status refreshes

8. **Unmount/Remount**
   - [ ] Open ProfileScreen
   - [ ] Navigate away
   - [ ] Navigate back
   - [ ] Check no errors in console
   - [ ] Check no memory leaks

---

## 🐛 Troubleshooting

### Issue: Hook still causing infinite loop

**Solution:**
1. Check you're using the NEW hook from `front/hooks/useProfileCompletion.ts`
2. Check no other code is calling `refresh()` in a loop
3. Check Error Boundary is wrapping the component
4. Check console for loop safeguard messages

### Issue: Completion status not updating

**Solution:**
1. Check `markStepCompleted()` is being called after updates
2. Check API endpoint is working: `GET /api/profile/completion`
3. Check authentication token is valid
4. Check network tab for API responses

### Issue: Error boundary not catching errors

**Solution:**
1. Check Error Boundary is wrapping the component correctly
2. Check `maxRenderCount` is set (default: 50)
3. Check error is being thrown in render phase (not in event handlers)

### Issue: Tests failing

**Solution:**
1. Run `npm install` to ensure all dependencies are installed
2. Check Jest configuration is correct
3. Check mocks are properly set up
4. Run tests with `--verbose` flag for more details

---

## 📊 Monitoring

### What to Monitor:

1. **API Calls**
   - Monitor `/api/profile/completion` endpoint
   - Should be called max 1-2 times per minute per user
   - Check for rate limiting issues

2. **Error Rates**
   - Monitor error boundary triggers
   - Check for infinite loop errors
   - Track retry counts

3. **Performance**
   - Monitor render counts
   - Check memory usage
   - Track API response times

4. **User Behavior**
   - Track completion percentage distribution
   - Monitor which steps are completed most/least
   - Track time to complete profile

---

## 🎯 Success Criteria

✅ **Hook is working correctly if:**
- No infinite loops
- No console errors
- API called only once on mount
- Completion status updates correctly
- Steps can be marked as completed
- Error boundary catches errors
- All tests pass
- No memory leaks

✅ **Ready for production if:**
- All manual tests pass
- All unit tests pass
- Performance is acceptable
- Error handling works
- Documentation is complete
- Code review approved

---

## 📞 Support

If you encounter any issues:

1. Check this guide first
2. Check the completion report: `TASK_1_COMPLETION_REPORT.md`
3. Check the code comments in the hook
4. Check the unit tests for examples
5. Contact the development team

---

**Last Updated**: March 30, 2026  
**Version**: 1.0  
**Author**: Kiro AI Assistant
