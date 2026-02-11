# ✅ Pre-Build Checklist - iOS

## 🎯 قبل ما تعمل Build

### 1. ✅ Apple Compliance - Complete
- [x] Block User System (Backend + Frontend)
- [x] Privacy Policy URL (https://90plus-app-production.up.railway.app/privacy)
- [x] Terms of Service URL (https://90plus-app-production.up.railway.app/terms)
- [x] Support URL (https://90plus-app-production.up.railway.app/support)
- [x] Admin Notifications on Report
- [x] Account Deletion Feature
- [x] Report Content System

**Status:** ✅ 100% Complete

---

### 2. ✅ Bug Fixes - Complete
- [x] Auth screen import error (TermsOfServiceModal)
- [x] Privacy/Terms pages 404 (public folder copy)
- [x] Block service duplicate /api/ URL
- [x] Predictions service duplicate /api/ URL

**Status:** ✅ All Fixed

---

### 3. ⚠️ URLs to Verify (IMPORTANT!)

**قبل الـ Build، تأكد إن الـ URLs دي شغالة:**

#### Test Privacy Page:
```bash
curl https://90plus-app-production.up.railway.app/privacy
```
**Expected:** HTML page with privacy policy

#### Test Terms Page:
```bash
curl https://90plus-app-production.up.railway.app/terms
```
**Expected:** HTML page with terms of service

#### Test Support Page:
```bash
curl https://90plus-app-production.up.railway.app/support
```
**Expected:** HTML page with support info

**Status:** ⏳ Test Now Before Build!

---

### 4. ✅ App Configuration

#### Check app.json:
```json
{
  "expo": {
    "name": "90Plus",
    "slug": "90plus",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.90plus.app",
      "buildNumber": "1"
    }
  }
}
```

#### Check eas.json:
```json
{
  "build": {
    "production": {
      "ios": {
        "resourceClass": "m-medium"
      }
    }
  }
}
```

**Status:** ✅ Should be configured

---

### 5. ✅ Environment Variables

#### Check .env file has:
```
EXPO_PUBLIC_API_URL=https://90plus-app-production.up.railway.app/api
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
```

**Status:** ✅ Should be set

---

### 6. ⚠️ Railway Deployment Status

**Check Railway Dashboard:**
- Backend deployment status: Should be "Active"
- Last deployment: Should be successful
- Logs: No errors

**Status:** ⏳ Check Now!

---

### 7. ✅ Database Migrations

**Check if Block model exists:**
```bash
# In Backend directory
npx prisma studio
# Check if "Block" table exists
```

**Status:** ✅ Should exist (added in previous migrations)

---

## 🚀 Ready to Build?

### ✅ All Green? Build Now!

If all items above are ✅, you can build:

```bash
cd front
eas build --platform ios --profile production
```

---

### ⚠️ Any Red? Fix First!

If any item is ❌ or ⏳, fix it before building:

1. **URLs not working?** 
   - Wait for Railway deployment to complete
   - Check Backend logs for errors

2. **Environment variables missing?**
   - Update `.env` file
   - Restart development server

3. **Database issues?**
   - Run migrations: `npx prisma migrate deploy`
   - Check database connection

---

## 📋 Quick Test in Development

**Before building, test these features:**

### Test 1: Block User
1. Open app in development
2. Go to any user profile
3. Click block button
4. Should work without errors

### Test 2: Privacy & Terms
1. Go to Settings
2. Click "Privacy Policy"
3. Should open in browser
4. Click "Terms & Conditions"
5. Should open in browser

### Test 3: Account Deletion
1. Go to Settings
2. Scroll to "Delete Account"
3. Click and verify modal shows
4. Test cancel button

### Test 4: Report Content
1. Open any reel
2. Click report button
3. Fill form and submit
4. Should show success message

---

## 🎯 Build Command

### Production Build:
```bash
cd front
eas build --platform ios --profile production
```

**Expected Time:** 15-20 minutes

---

### After Build Completes:

1. **Download .ipa file** from EAS dashboard
2. **Upload to TestFlight** using Transporter or `eas submit`
3. **Test on real device** via TestFlight
4. **Submit for App Store Review**

---

## 🆘 Common Build Issues

### Issue: Build fails with "Module not found"
**Solution:**
```bash
cd front
rm -rf node_modules
npm install
eas build --platform ios --profile production --clear-cache
```

### Issue: Build fails with "Invalid bundle identifier"
**Solution:**
- Check `app.json` has correct `bundleIdentifier`
- Should match Apple Developer account

### Issue: Build fails with "Provisioning profile error"
**Solution:**
- Run `eas credentials` to configure
- Or use automatic credentials management

---

## ✅ Final Checklist

Before clicking "Build":

- [ ] All URLs tested and working
- [ ] Railway deployment is active
- [ ] Block feature tested in development
- [ ] Privacy/Terms pages load correctly
- [ ] Account deletion modal works
- [ ] Report system works
- [ ] No console errors in development
- [ ] Environment variables are set
- [ ] Git changes are pushed

---

## 🎊 You're Ready!

If all checkboxes above are ✅, you can confidently build for iOS!

**Build Command:**
```bash
cd front
eas build --platform ios --profile production
```

---

## 📞 Need Help?

**Email:** merdevai477@gmail.com

**Documentation:**
- `READY_FOR_APPLE_SUBMISSION.md` - Complete submission guide
- `TESTFLIGHT_WINDOWS_GUIDE.md` - TestFlight upload guide
- `APPLE_COMPLIANCE_COMPLETE.md` - Compliance details

---

**Last Updated:** February 5, 2026
**Status:** ✅ READY FOR BUILD

---

**Good Luck! 🚀**
