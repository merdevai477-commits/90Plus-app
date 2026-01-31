# ⚡ Quick Integration Guide - Apple Compliance

## 🎯 3 Steps to Complete

### Step 1: Settings Screen (5 mins)

**File**: `front/app/(tabs)/settings.tsx`

Add at the top:
```typescript
import AccountDeletionModal from '../../components/common/AccountDeletionModal';
import { AccountDeletionService } from '../../services/accountDeletionService';
```

Add state (after other useState):
```typescript
const [deletionModalVisible, setDeletionModalVisible] = useState(false);
```

Replace `handleDeleteAccount` function:
```typescript
const handleDeleteAccount = () => {
  setDeletionModalVisible(true);
};

const handleConfirmDeletion = async () => {
  try {
    await AccountDeletionService.deleteAccount();
    
    // Clear all data (existing code)
    await clearVideos();
    await signOut();
    await globalState.logout();
    // ... rest of cleanup
    
    router.replace('/auth');
  } catch (error) {
    Alert.alert(t.common.error, 'Failed to delete account');
  }
};
```

Add modal before closing `</View>` (at the end):
```typescript
<AccountDeletionModal
  visible={deletionModalVisible}
  onClose={() => setDeletionModalVisible(false)}
  onConfirm={handleConfirmDeletion}
/>
```

---

### Step 2: Signup Flow (10 mins)

**File**: `front/app/auth/index.tsx`

Add at the top:
```typescript
import TermsOfServiceModal from '../../components/common/TermsOfServiceModal';
import { TermsService } from '../../services/termsService';
```

Add state:
```typescript
const [termsModalVisible, setTermsModalVisible] = useState(false);
```

Before creating account, show terms:
```typescript
const handleSignup = async () => {
  // Show terms first
  setTermsModalVisible(true);
};

const handleAcceptTerms = async () => {
  try {
    const terms = await TermsService.getLatestTerms();
    await TermsService.acceptTerms(terms.version);
    setTermsModalVisible(false);
    
    // Now proceed with account creation
    // ... your existing signup code
  } catch (error) {
    Alert.alert('Error', 'Failed to accept terms');
  }
};
```

Add modal:
```typescript
<TermsOfServiceModal
  visible={termsModalVisible}
  onAccept={handleAcceptTerms}
  onDecline={() => setTermsModalVisible(false)}
  required={true}
/>
```

---

### Step 3: Report Routes (5 mins)

**File**: `Backend/src/routes/reports.routes.ts` (NEW FILE)

```typescript
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/clerk.middleware';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/reports/reel/:reelId
router.post('/reel/:reelId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { reelId } = req.params;
    const { reason, additionalInfo } = req.body;
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) {
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) {
      res.status(404).json({ status: 'ERROR', message: 'User not found' });
      return;
    }

    // Get reel owner
    const reel = await prisma.reel.findUnique({
      where: { id: reelId },
      select: { userId: true },
    });

    if (!reel) {
      res.status(404).json({ status: 'ERROR', message: 'Reel not found' });
      return;
    }

    // Map reason to ReportType
    const reasonToType: Record<string, string> = {
      'spam': 'SPAM',
      'harassment': 'HARASSMENT',
      'inappropriate': 'INAPPROPRIATE',
      'violence': 'INAPPROPRIATE',
      'hate': 'HARASSMENT',
      'copyright': 'COPYRIGHT',
      'other': 'OTHER',
    };

    const reportType = reasonToType[reason] || 'OTHER';

    // Create report
    await prisma.report.create({
      data: {
        reporterId: user.id,
        reportedReelId: reelId,
        reportedUserId: reel.userId,
        type: reportType as any,
        reason: additionalInfo || reason,
        status: 'PENDING',
      },
    });

    logger.info(`User ${user.id} reported reel ${reelId} for: ${reason}`);

    res.json({
      status: 'SUCCESS',
      message: 'Report submitted successfully',
    });
  } catch (error: any) {
    logger.error('Report reel error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message || 'Internal server error',
    });
  }
});

// POST /api/reports/comment/:commentId
router.post('/comment/:commentId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { commentId } = req.params;
    const { reason, additionalInfo } = req.body;
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) {
      res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) {
      res.status(404).json({ status: 'ERROR', message: 'User not found' });
      return;
    }

    // Get comment owner
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });

    if (!comment) {
      res.status(404).json({ status: 'ERROR', message: 'Comment not found' });
      return;
    }

    const reasonToType: Record<string, string> = {
      'spam': 'SPAM',
      'harassment': 'HARASSMENT',
      'inappropriate': 'INAPPROPRIATE',
      'violence': 'INAPPROPRIATE',
      'hate': 'HARASSMENT',
      'copyright': 'COPYRIGHT',
      'other': 'OTHER',
    };

    const reportType = reasonToType[reason] || 'OTHER';

    await prisma.report.create({
      data: {
        reporterId: user.id,
        reportedCommentId: commentId,
        reportedUserId: comment.userId,
        type: reportType as any,
        reason: additionalInfo || reason,
        status: 'PENDING',
      },
    });

    logger.info(`User ${user.id} reported comment ${commentId} for: ${reason}`);

    res.json({
      status: 'SUCCESS',
      message: 'Report submitted successfully',
    });
  } catch (error: any) {
    logger.error('Report comment error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message || 'Internal server error',
    });
  }
});

export default router;
```

**File**: `Backend/src/main.ts`

Add import:
```typescript
import reportsRoutes from './routes/reports.routes';
```

Add route (after other routes):
```typescript
app.use(`${API_PREFIX}/reports`, reportsRoutes);
```

---

## ✅ That's It!

Now test:
1. Delete account from Settings
2. Accept terms during signup
3. Report a reel/comment

Then deploy and submit to Apple! 🚀
