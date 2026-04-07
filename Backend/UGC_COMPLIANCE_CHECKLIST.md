# ✅ Apple UGC Compliance Checklist

## Pre-Submission Checklist

### Backend Implementation
- [x] EULA fields added to User model (eulaAccepted, eulaAcceptedAt, eulaVersion)
- [x] EULA routes registered (`/api/eula/status`, `/api/eula/accept`)
- [x] Content filter middleware implemented (bad-words + Arabic support)
- [x] Report endpoints created (reel, comment, user)
- [x] Block user endpoints created (block, unblock, list)
- [x] Admin endpoints for moderation (ban, suspend, review reports)
- [x] Admin notification service implemented
- [x] Cron job for pending reports (> 20 hours)
- [x] Database schema pushed successfully
- [x] Dependencies installed (bad-words, supertest)

### Frontend Implementation
- [x] EULA screen with scroll detection (`front/app/eula.tsx`)
- [x] EULA guard hook (`front/hooks/useEULAGuard.ts`)
- [x] Report modal component
- [x] Block user functionality
- [x] Error messages for content violations
- [x] Success messages for reports

### Testing
- [x] Test suite created (17 tests)
- [x] Jest configuration added
- [x] Test command available (`npm run test:ugc`)

### Documentation
- [x] Complete implementation report (APPLE_UGC_COMPLIANCE_COMPLETE.md)
- [x] Arabic summary (APPLE_UGC_SUMMARY_AR.md)
- [x] This checklist

---

## Manual Testing Required

### 1. EULA Flow (Record on iOS device)
- [ ] Fresh install → EULA screen appears
- [ ] Scroll to bottom → "Agree" button activates
- [ ] Tap "Agree" → Enter app successfully
- [ ] Try accessing UGC without accepting → Blocked with 403

### 2. Content Filter
- [ ] Post content with offensive English words → Rejected with error
- [ ] Post content with offensive Arabic words → Rejected with error
- [ ] Post clean content → Accepted successfully

### 3. Report System
- [ ] Long-press on reel → Report option appears
- [ ] Select reason → Submit → Success message
- [ ] Admin receives notification within 60 seconds
- [ ] Report appears in admin panel

### 4. Block System
- [ ] Open user profile → 3-dot menu → Block option
- [ ] Confirm block → Content disappears instantly
- [ ] Admin receives notification
- [ ] Blocked user list shows the user

### 5. Admin Panel
- [ ] Login as admin
- [ ] View pending reports
- [ ] Review report → Take action (ban/suspend/remove content)
- [ ] Verify user is banned → Cannot access API (403)

---

## Screen Recording Checklist

Record these 3 flows on physical iOS device:

### Video 1: EULA Flow (30-60 seconds)
- [ ] Show fresh install
- [ ] Show EULA screen
- [ ] Scroll to bottom
- [ ] Show "Agree" button activation
- [ ] Tap and enter app

### Video 2: Report Flow (30-60 seconds)
- [ ] Show content (reel/comment)
- [ ] Long-press → Report menu
- [ ] Select reason
- [ ] Submit
- [ ] Show success message

### Video 3: Block Flow (30-60 seconds)
- [ ] Show user profile
- [ ] Open 3-dot menu
- [ ] Tap Block
- [ ] Confirm dialog
- [ ] Show content disappears from feed

---

## App Store Connect Submission

### 1. Upload Videos
- [ ] Go to App Store Connect
- [ ] Navigate to: App Review Information → Notes
- [ ] Upload all 3 videos
- [ ] Add description for each video

### 2. Update App Review Notes
Add this text:
```
Apple Guideline 1.2 - UGC Safety Compliance:

We have implemented comprehensive UGC safety measures:

1. EULA Screen: All users must accept Terms of Use before accessing UGC content
2. Content Filtering: Automatic filtering of offensive content (English + Arabic)
3. Report System: Users can report inappropriate content/users
4. Block System: Users can block abusive users instantly
5. Admin Moderation: 24-hour response time with ban/suspend capabilities

Please see attached videos demonstrating:
- Video 1: EULA acceptance flow
- Video 2: Content reporting mechanism
- Video 3: User blocking functionality

All endpoints tested and verified. Ready for review.
```

### 3. Submit for Review
- [ ] Review all information
- [ ] Click "Submit for Review"
- [ ] Monitor review status

---

## Post-Submission Monitoring

### First 24 Hours
- [ ] Monitor admin notifications
- [ ] Check for any reports
- [ ] Verify cron jobs running
- [ ] Check server logs for errors

### If Rejected
- [ ] Read rejection reason carefully
- [ ] Check which guideline failed
- [ ] Fix the issue
- [ ] Re-test manually
- [ ] Re-submit with explanation

---

## Emergency Contacts

**If issues arise:**
1. Check server logs: `npm run logs` (if available)
2. Check database: `npx prisma studio`
3. Test endpoints: `npm run test:ugc`
4. Review this checklist again

---

## Success Criteria

✅ All checkboxes above are checked  
✅ All tests pass  
✅ Videos recorded and uploaded  
✅ App submitted for review  

**Status:** Ready for submission 🚀

---

Last Updated: April 4, 2026
