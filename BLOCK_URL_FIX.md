# 🔧 Block Service URL Fix

## ❌ Problem

Block endpoints were returning 404 because of duplicate `/api/` in the URL:

```
❌ Wrong: /api/api/users/block/a902037d-006a-44c6-8dbd-25a0987380774043
✅ Correct: /api/users/block/a902037d-006a-44c6-8dbd-25a0987380774043
```

**Root Cause:** 
- `getApiUrl()` returns: `https://90plus-app-production.up.railway.app/api`
- Services were adding `/api/` again: `${API_URL}/api/users/...`
- Result: `/api/api/users/...` ❌

---

## ✅ Solution

### 1. Fixed blockService.ts

**Before:**
```typescript
const response = await fetch(`${API_URL}/api/users/block/${userId}`, {
```

**After:**
```typescript
const response = await fetch(`${API_URL}/users/block/${userId}`, {
```

**Changes:**
- ✅ Removed `/api/` from all 4 endpoints:
  - `POST /users/block/:userId` - Block user
  - `DELETE /users/block/:userId` - Unblock user
  - `GET /users/blocked` - Get blocked users
  - `GET /users/block/:userId/status` - Check block status

---

### 2. Fixed predictions.service.ts

**Before:**
```typescript
const getAPIUrl = () => {
  const apiUrl = getApiUrl();
  return apiUrl.replace(/\/api$/, ''); // Workaround
};

const response = await fetch(`${API_URL}/api/predictions/remaining`, {
```

**After:**
```typescript
const API_URL = getApiUrl(); // Already includes /api

const response = await fetch(`${API_URL}/predictions/remaining`, {
```

**Changes:**
- ✅ Removed workaround function `getAPIUrl()`
- ✅ Removed `/api/` from all 4 endpoints:
  - `GET /predictions/remaining` - Get remaining predictions
  - `POST /predictions` - Submit prediction
  - `GET /predictions/user` - Get user predictions
  - `GET /predictions/match/:id/count` - Get match prediction count

---

## 📊 Services Status

### ✅ Correct Services (No Changes Needed)
- ✅ `reportService.ts` - Uses `${API_URL}/reports/...`
- ✅ `accountDeletionService.ts` - Uses `${API_URL}/users/me`
- ✅ `termsService.ts` - Uses `${API_URL}/terms/...`

### ✅ Fixed Services
- ✅ `blockService.ts` - Fixed all 4 endpoints
- ✅ `predictions.service.ts` - Fixed all 4 endpoints

---

## 🧪 Testing

### Test Block Functionality

1. **Block User:**
```bash
# Should call: /api/users/block/:userId
# Not: /api/api/users/block/:userId
```

2. **Unblock User:**
```bash
# Should call: /api/users/block/:userId (DELETE)
```

3. **Get Blocked Users:**
```bash
# Should call: /api/users/blocked
```

4. **Check Block Status:**
```bash
# Should call: /api/users/block/:userId/status
```

### Test Predictions Functionality

1. **Get Remaining:**
```bash
# Should call: /api/predictions/remaining
```

2. **Submit Prediction:**
```bash
# Should call: /api/predictions
```

3. **Get User Predictions:**
```bash
# Should call: /api/predictions/user
```

4. **Get Match Count:**
```bash
# Should call: /api/predictions/match/:id/count
```

---

## 📝 Commit Details

### Frontend (front submodule)
**Commit:** `eaaa819b`
**Message:** "fix: Remove duplicate /api/ in blockService and predictions.service URLs"

**Files Changed:**
- ✅ `front/services/blockService.ts`
- ✅ `front/services/predictions.service.ts`

### Root Repository
**Commit:** `9cc5204`
**Message:** "fix: Update front submodule - Fix duplicate /api/ in URLs"

---

## 🎯 How to Prevent This

### Rule for All Services:

**✅ DO:**
```typescript
const API_URL = getApiUrl(); // Returns: https://...railway.app/api

// Use directly without adding /api/
fetch(`${API_URL}/users/block/${userId}`)
// Result: https://...railway.app/api/users/block/123 ✅
```

**❌ DON'T:**
```typescript
const API_URL = getApiUrl();

// Don't add /api/ again
fetch(`${API_URL}/api/users/block/${userId}`)
// Result: https://...railway.app/api/api/users/block/123 ❌
```

---

## 📚 API URL Structure

### getApiUrl() Returns:
```
Development:   http://localhost:3000/api
Production:    https://90plus-app-production.up.railway.app/api
```

### Service Endpoints Should Be:
```typescript
// ✅ Correct
`${API_URL}/users/block/${userId}`
`${API_URL}/predictions/remaining`
`${API_URL}/reports/reel/${reelId}`

// ❌ Wrong
`${API_URL}/api/users/block/${userId}`
`${API_URL}/api/predictions/remaining`
`${API_URL}/api/reports/reel/${reelId}`
```

---

## 🔍 How to Check Other Services

### Search for Duplicate /api/:
```bash
# In front/services/ directory
grep -r "API_URL.*\/api\/" .
```

### Expected Result:
```
No matches found ✅
```

If you find matches, fix them by removing the `/api/` part.

---

## ✅ Verification Checklist

After deploying:

- [ ] Block user works (no 404)
- [ ] Unblock user works
- [ ] Blocked users list loads
- [ ] Block status check works
- [ ] Submit prediction works
- [ ] Get predictions works
- [ ] Get remaining predictions works
- [ ] Get match prediction count works

---

## 🆘 Troubleshooting

### Issue: Still getting /api/api/ in URLs
**Solution:**
1. Clear app cache
2. Restart app
3. Check if you're using latest code
4. Verify `getApiUrl()` returns correct URL

### Issue: 404 on block endpoints
**Solution:**
1. Check Railway logs
2. Verify backend routes are registered
3. Test endpoint directly with curl
4. Check authentication token

---

## 📊 Summary

**Problem:** Duplicate `/api/` in URLs causing 404 errors
**Solution:** Removed `/api/` from service endpoints
**Files Fixed:** 2 (blockService.ts, predictions.service.ts)
**Status:** ✅ Fixed and deployed

---

**Last Updated:** February 5, 2026
**Status:** ✅ FIXED
**Commits:** eaaa819b (front), 9cc5204 (root)

---

**Made with ❤️ for 90Plus**
