# 🚨 Report System - Usage Guide

## Overview

Professional reporting system for Reels, Comments, and Users with:
- ✅ Multi-language support (AR/EN)
- ✅ Haptic feedback
- ✅ Smooth animations
- ✅ Error handling
- ✅ Rate limiting protection
- ✅ Duplicate detection

---

## Quick Start

### 1. Using ReportButton (Easiest)

```tsx
import { ReportButton } from '@/components/common';

// In your component
<ReportButton
  contentType="reel"
  contentId={reel.id}
  onReportSuccess={() => {
    console.log('Report submitted!');
  }}
/>
```

### 2. Using ReportSystem Directly

```tsx
import { ReportSystem } from '@/components/common';
import { useReportSystem } from '@/hooks/useReportSystem';

function MyComponent() {
  const { isVisible, reportConfig, openReport, closeReport, handleSuccess, getToken } =
    useReportSystem({
      onSuccess: () => {
        console.log('Report submitted successfully!');
      },
    });

  return (
    <>
      <TouchableOpacity onPress={() => openReport({ contentType: 'reel', contentId: '123' })}>
        <Text>Report</Text>
      </TouchableOpacity>

      {reportConfig && (
        <ReportSystem
          visible={isVisible}
          onClose={closeReport}
          contentType={reportConfig.contentType}
          contentId={reportConfig.contentId}
          getToken={getToken}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
```

### 3. Using Convenience Hooks

```tsx
import { useReelReport, useCommentReport, useUserReport } from '@/hooks/useReportSystem';

// For Reels
function ReelComponent({ reel }) {
  const { reportReel, isVisible, reportConfig, closeReport, handleSuccess, getToken } =
    useReelReport({
      onSuccess: () => {
        Alert.alert('Success', 'Report submitted!');
      },
    });

  return (
    <>
      <TouchableOpacity onPress={() => reportReel(reel.id)}>
        <Ionicons name="flag-outline" size={24} />
      </TouchableOpacity>

      {reportConfig && (
        <ReportSystem
          visible={isVisible}
          onClose={closeReport}
          contentType={reportConfig.contentType}
          contentId={reportConfig.contentId}
          getToken={getToken}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}

// For Comments
function CommentComponent({ comment }) {
  const { reportComment, isVisible, reportConfig, closeReport, handleSuccess, getToken } =
    useCommentReport();

  return (
    <>
      <TouchableOpacity onPress={() => reportComment(comment.id)}>
        <Text>Report Comment</Text>
      </TouchableOpacity>

      {reportConfig && (
        <ReportSystem
          visible={isVisible}
          onClose={closeReport}
          contentType={reportConfig.contentType}
          contentId={reportConfig.contentId}
          getToken={getToken}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}

// For Users
function UserProfileComponent({ user }) {
  const { reportUser, isVisible, reportConfig, closeReport, handleSuccess, getToken } =
    useUserReport();

  return (
    <>
      <TouchableOpacity onPress={() => reportUser(user.id)}>
        <Text>Report User</Text>
      </TouchableOpacity>

      {reportConfig && (
        <ReportSystem
          visible={isVisible}
          onClose={closeReport}
          contentType={reportConfig.contentType}
          contentId={reportConfig.contentId}
          getToken={getToken}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
```

---

## Integration Examples

### In Reels Feed

```tsx
import { ReportButton } from '@/components/common';

function ReelItem({ reel }) {
  return (
    <View>
      {/* Reel content */}
      
      {/* Report button in top-right corner */}
      <View style={styles.topRightActions}>
        <ReportButton
          contentType="reel"
          contentId={reel.id}
          size={22}
          color="#FF3B30"
        />
      </View>
    </View>
  );
}
```

### In Comments Section

```tsx
import { ReportButton } from '@/components/common';

function CommentItem({ comment }) {
  return (
    <View style={styles.commentContainer}>
      <Text>{comment.content}</Text>
      
      {/* Report button */}
      <ReportButton
        contentType="comment"
        contentId={comment.id}
        size={18}
        color="#8E8E93"
      />
    </View>
  );
}
```

### In User Profile

```tsx
import { ReportButton } from '@/components/common';

function UserProfile({ user }) {
  return (
    <View>
      <Text>{user.username}</Text>
      
      {/* Report button in options menu */}
      <Menu>
        <MenuItem onPress={() => {}}>
          <ReportButton
            contentType="user"
            contentId={user.id}
            size={20}
          />
          <Text>Report User</Text>
        </MenuItem>
      </Menu>
    </View>
  );
}
```

---

## API Reference

### ReportSystem Props

```typescript
interface ReportSystemProps {
  visible: boolean;              // Modal visibility
  onClose: () => void;           // Close handler
  contentType: 'reel' | 'comment' | 'user';  // Content type
  contentId: string;             // Content ID
  getToken: () => Promise<string | null>;    // Token getter
  onSuccess?: () => void;        // Success callback
}
```

### ReportButton Props

```typescript
interface ReportButtonProps {
  contentType: 'reel' | 'comment' | 'user';  // Content type
  contentId: string;             // Content ID
  size?: number;                 // Icon size (default: 24)
  color?: string;                // Icon color (default: '#FF3B30')
  style?: ViewStyle;             // Custom styles
  onReportSuccess?: () => void;  // Success callback
}
```

### useReportSystem Hook

```typescript
const {
  isVisible,        // Modal visibility state
  reportConfig,     // Current report configuration
  openReport,       // Open report modal
  closeReport,      // Close report modal
  handleSuccess,    // Success handler
  handleError,      // Error handler
  getToken,         // Token getter
} = useReportSystem({
  onSuccess?: () => void;
  onError?: (error: Error) => void;
});
```

---

## Report Reasons

The system supports these report reasons:

| ID | Arabic | English |
|----|--------|---------|
| `spam` | سبام أو محتوى متكرر | Spam or Repetitive Content |
| `harassment` | تحرش أو تنمر | Harassment or Bullying |
| `inappropriate` | محتوى غير لائق | Inappropriate Content |
| `violence` | عنف أو تهديدات | Violence or Threats |
| `hate` | خطاب كراهية | Hate Speech |
| `copyright` | انتهاك حقوق النشر | Copyright Violation |
| `misinformation` | معلومات مضللة | False Information |
| `other` | أسباب أخرى | Other Reasons |

---

## Error Handling

The system handles these error cases:

### 429 - Rate Limit
```
AR: "لقد وصلت للحد الأقصى من البلاغات اليومية"
EN: "You have reached the daily report limit"
```

### 409 - Duplicate Report
```
AR: "لقد أبلغت عن هذا المحتوى مسبقاً"
EN: "You have already reported this content"
```

### 401 - Unauthorized
```
AR: "يجب تسجيل الدخول أولاً"
EN: "Authentication required"
```

---

## Styling

### Custom Colors

```tsx
<ReportButton
  contentType="reel"
  contentId={reel.id}
  color="#FF0000"  // Custom red
/>
```

### Custom Size

```tsx
<ReportButton
  contentType="reel"
  contentId={reel.id}
  size={32}  // Larger icon
/>
```

### Custom Container Style

```tsx
<ReportButton
  contentType="reel"
  contentId={reel.id}
  style={{
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 12,
  }}
/>
```

---

## Best Practices

### 1. Always Provide Success Callback

```tsx
<ReportButton
  contentType="reel"
  contentId={reel.id}
  onReportSuccess={() => {
    // Refresh content
    // Show toast
    // Update UI
  }}
/>
```

### 2. Handle Errors Gracefully

```tsx
const { openReport } = useReportSystem({
  onSuccess: () => {
    Toast.show('Report submitted successfully');
  },
  onError: (error) => {
    Toast.show(error.message);
  },
});
```

### 3. Use Appropriate Content Types

```tsx
// ✅ Correct
<ReportButton contentType="reel" contentId={reel.id} />

// ❌ Wrong
<ReportButton contentType="comment" contentId={reel.id} />
```

### 4. Provide Context to Users

```tsx
<TouchableOpacity onPress={() => openReport({ contentType: 'reel', contentId: reel.id })}>
  <Ionicons name="flag-outline" size={24} />
  <Text>Report inappropriate content</Text>
</TouchableOpacity>
```

---

## Testing

### Test Report Submission

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ReportButton } from '@/components/common';

test('submits report successfully', async () => {
  const onSuccess = jest.fn();
  
  const { getByRole } = render(
    <ReportButton
      contentType="reel"
      contentId="123"
      onReportSuccess={onSuccess}
    />
  );
  
  fireEvent.press(getByRole('button'));
  
  // Select reason
  fireEvent.press(getByText('Spam or Repetitive Content'));
  
  // Submit
  fireEvent.press(getByText('Submit Report'));
  
  await waitFor(() => {
    expect(onSuccess).toHaveBeenCalled();
  });
});
```

---

## Troubleshooting

### Report Not Submitting

1. Check authentication token
2. Verify content ID is valid
3. Check network connection
4. Review API endpoint configuration

### Modal Not Showing

1. Ensure `visible` prop is true
2. Check z-index conflicts
3. Verify modal is not behind other views

### Haptics Not Working

1. Check device supports haptics
2. Verify haptics permissions
3. Test on physical device (not simulator)

---

## Migration from Old System

### Before (Old ReportModal)

```tsx
import { ReportModal } from '@/components/Matches/ReportModal';

<ReportModal
  visible={showReport}
  onClose={() => setShowReport(false)}
  reelId={reel.id}
  onReport={(reason) => {
    // Handle report
  }}
/>
```

### After (New ReportSystem)

```tsx
import { ReportButton } from '@/components/common';

<ReportButton
  contentType="reel"
  contentId={reel.id}
  onReportSuccess={() => {
    // Handle success
  }}
/>
```

---

## Support

For issues or questions:
1. Check this documentation
2. Review example implementations
3. Check console logs for errors
4. Contact development team

---

**Last Updated:** April 1, 2026  
**Version:** 1.0.0
