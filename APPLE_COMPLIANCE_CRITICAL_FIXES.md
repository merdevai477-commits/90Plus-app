# Apple Compliance - Critical Fixes Required

## 🚨 Critical Issues (Must Fix Before Submission)

### 1. Block User Feature (Guideline 1.2)
**Status:** ❌ Missing in Frontend
**Priority:** CRITICAL

**Backend:** ✅ Ready
- Block model exists in schema
- API endpoints ready in `user.routes.ts`

**Frontend:** ❌ Missing
- No "Block User" button in profile screen
- BlockedUsersScreen.tsx exists but empty

**Action Items:**
1. Add "Block User" button to user profile screen
2. Implement BlockedUsersScreen to show blocked users list
3. Add unblock functionality

**Files to Modify:**
- `front/app/user/[username].tsx` - Add block button
- `front/components/Settings/BlockedUsersScreen.tsx` - Implement UI
- Create `front/services/blockService.ts` - API calls

---

### 2. Admin Notifications for Reports (Guideline 1.2)
**Status:** ❌ Missing
**Priority:** CRITICAL

**Current State:**
- Report system exists (ReportContentModal)
- Reports saved to database
- **BUT:** No immediate notification to developers

**Required:**
- Email notification to admin when content is reported
- Push notification to admin dashboard (optional)

**Action Items:**
1. Add email service to backend
2. Send email on report creation
3. Include report details (type, reason, content)

**Files to Modify:**
- `Backend/src/services/admin-notification.service.ts` - Already exists!
- `Backend/src/routes/user.routes.ts` - Call notification service on report

---

### 3. Account Deletion Clarity (Guideline 5.1.1(v))
**Status:** ⚠️ Exists but needs improvement
**Priority:** HIGH

**Current State:**
- Delete account button exists in Settings
- AccountDeletionModal exists
- Backend service ready

**Issues:**
- Not clear about 30-day grace period
- Confirmation steps could be clearer
- No explanation of what data will be deleted

**Action Items:**
1. Update AccountDeletionModal with clear explanation
2. Add step-by-step confirmation
3. Show what data will be deleted
4. Explain 30-day grace period

**Files to Modify:**
- `front/components/common/AccountDeletionModal.tsx`

---

## 📋 Medium Priority Issues

### 4. Privacy Policy URL
**Status:** ❌ Missing
**Priority:** MEDIUM

**Current:**
- URL in code: `https://90plus-app-production.up.railway.app/privacy`
- **BUT:** Page doesn't exist (404)

**Action Items:**
1. Create privacy policy page on Railway
2. Or host on GitHub Pages
3. Update URL in app.json

---

### 5. Terms of Service URL
**Status:** ⚠️ File exists but not hosted
**Priority:** MEDIUM

**Current:**
- File exists: `Backend/src/data/terms-of-service-v1.0.md`
- **BUT:** No web endpoint to view it

**Action Items:**
1. Create endpoint to serve terms
2. Or host on GitHub Pages
3. Update URL in app.json

---

### 6. App Store Screenshots & Video
**Status:** ❌ Missing
**Priority:** MEDIUM

**Required:**
- 5-6 screenshots of app
- App preview video (15-30 seconds)

**Action Items:**
1. Take screenshots of key features
2. Record short demo video
3. Upload to App Store Connect

---

## ✅ What's Already Done

1. ✅ Terms of Service (EULA) - Exists in app
2. ✅ Report Content System - Working
3. ✅ Account Deletion Backend - Ready
4. ✅ Support URL - Working
5. ✅ Moderation System - Complete
6. ✅ Strike System - Complete

---

## 🎯 Immediate Action Plan

### Day 1: Block User Feature
1. Add block button to profile
2. Implement BlockedUsersScreen
3. Test blocking/unblocking

### Day 2: Admin Notifications
1. Configure email service
2. Add notification on report
3. Test email delivery

### Day 3: Polish & Test
1. Improve AccountDeletionModal
2. Create Privacy Policy page
3. Host Terms of Service
4. Final testing

### Day 4: Metadata
1. Take screenshots
2. Record demo video
3. Prepare App Store listing

---

## 📝 Notes

- All backend infrastructure is ready
- Most issues are frontend UI/UX
- Can be fixed in 3-4 days
- No major architectural changes needed

---

**Last Updated:** February 5, 2026
**Status:** Ready for implementation
