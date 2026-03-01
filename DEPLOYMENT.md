# 90Plus - Deployment Guide

This guide explains how to deploy the 90Plus app to production after fixing Apple Review issues.

---

## 📋 Pre-Deployment Checklist

### 1. Code Quality
- [ ] All tests passing (bug exploration + preservation)
- [ ] No console.log statements (use logger instead)
- [ ] No hardcoded secrets or API keys
- [ ] TypeScript errors resolved
- [ ] ESLint warnings addressed

### 2. Apple Review Fixes
- [ ] ✅ Copycat content removed (COMPLETE)
- [ ] ⏳ Performance issues fixed (IN PROGRESS)
- [ ] ❌ Demo account implemented (PENDING)
- [ ] ❌ Compliance requirements met (PENDING)

### 3. Testing
- [ ] Manual testing on iPad Air 11-inch (M3)
- [ ] Manual testing on iPhone 15 Pro
- [ ] Load testing (100+ concurrent users)
- [ ] Cache failure scenarios tested
- [ ] Demo account tested

### 4. Documentation
- [ ] README updated
- [ ] Environment variables documented
- [ ] API documentation updated
- [ ] Privacy policy updated
- [ ] Terms of service finalized

---

## 🚀 Deployment Steps

### Step 1: Backend Deployment (Railway)

#### 1.1 Database Migrations
```bash
cd Backend

# Run migrations on production
npm run prisma:migrate deploy

# Verify migration success
npm run prisma:studio
```

#### 1.2 Environment Variables
Ensure all required environment variables are set in Railway:
- `DATABASE_URL` - PostgreSQL connection string
- `DATABASE_CONNECTION_POOL_SIZE` - Set to 10 (new)
- `REDIS_URL` - Redis connection string
- `CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key
- `SUPABASE_URL` - Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase key
- `NODE_ENV` - Set to "production"

#### 1.3 Deploy Backend
Railway auto-deploys from the main branch. To trigger deployment:

```bash
# Commit and push changes
./deploy-git.sh   # Linux/Mac
# OR
.\deploy-git.ps1  # Windows

# Monitor deployment in Railway dashboard
# https://railway.app/dashboard
```

#### 1.4 Verify Backend
```bash
# Test API health
curl https://your-backend-url.railway.app/health

# Test critical endpoints
curl https://your-backend-url.railway.app/api/football/fixtures
curl https://your-backend-url.railway.app/api/clerk/me
```

---

### Step 2: Frontend Deployment (Expo/EAS)

#### 2.1 Update App Version
The deployment script will prompt you to bump the version. Choose:
- **Patch** (1.0.0 → 1.0.1) - Bug fixes only
- **Minor** (1.0.0 → 1.1.0) - New features, backward compatible
- **Major** (1.0.0 → 2.0.0) - Breaking changes

#### 2.2 Build and Deploy
```bash
# Run deployment script
./deploy-expo.sh   # Linux/Mac
# OR
.\deploy-expo.ps1  # Windows
```

The script will:
1. Check EAS authentication
2. Prompt for version bump
3. Ask for build profile (development/preview/production)
4. Ask for platform (iOS/Android/both)
5. Submit build to EAS

#### 2.3 Build Profiles

**Development** (internal testing)
- Fast build time
- Development client required
- Not suitable for App Store

**Preview** (TestFlight)
- Production-like build
- Can be distributed via TestFlight
- Good for beta testing

**Production** (App Store)
- Optimized build
- Ready for App Store submission
- Requires App Store Connect setup

#### 2.4 Monitor Build
```bash
cd front

# Check build status
eas build:list

# View specific build
eas build:view [BUILD_ID]

# Download build when ready
eas build:download --id [BUILD_ID]
```

---

### Step 3: TestFlight Distribution

#### 3.1 Submit to TestFlight
```bash
cd front

# Submit iOS build to TestFlight
eas submit -p ios

# Follow prompts to select build
```

#### 3.2 Configure TestFlight
1. Go to App Store Connect
2. Navigate to TestFlight tab
3. Add test information:
   - What to test
   - Demo account credentials
   - Known issues
4. Add internal testers
5. Add external testers (optional)

#### 3.3 Test on Real Devices
- iPad Air 11-inch (M3) with iPadOS 26.2.1
- iPhone 15 Pro with iOS 17.x
- Test all critical flows:
  - Matches screen loading
  - Profile pages
  - Reels section
  - Quiz functionality
  - Predictions

---

### Step 4: App Store Submission

#### 4.1 Prepare Submission
1. **App Information**
   - Update app description
   - Add/update screenshots
   - Update keywords
   - Set age rating

2. **Privacy Policy**
   - Ensure privacy policy is up to date
   - URL: https://your-backend-url.railway.app/privacy

3. **Terms of Service**
   - Ensure terms are finalized
   - URL: https://your-backend-url.railway.app/terms

4. **Demo Account**
   - Email: aibuilder80@gmail.com
   - Password: [Set in Clerk]
   - Ensure full access, no restrictions

#### 4.2 Submit for Review
1. Go to App Store Connect
2. Select your app
3. Click "Submit for Review"
4. Answer questionnaire:
   - Does your app use encryption? (Yes - HTTPS)
   - Does your app access third-party content? (No - after copycat fix)
   - Does your app use advertising identifier? (No)
5. Add notes for reviewer:
   ```
   Apple Review Team,
   
   We have addressed all issues from the previous rejection:
   
   1. ✅ Copycat Content (Guideline 4.1)
      - Removed all copyrighted team/league names
      - Replaced with generic alternatives
      - No official logos or branding
   
   2. ✅ Performance Issues (Guideline 2.1)
      - Fixed database connection pool exhaustion
      - Optimized API response times
      - Improved iPad performance
      - No freezing or loading issues
   
   3. ✅ Demo Account
      - Email: aibuilder80@gmail.com
      - Password: [provided separately]
      - Full access to all features
   
   4. ✅ Compliance (Guideline 5.1.1)
      - Terms of Service implemented
      - Account deletion available
      - Content reporting enabled
      - User blocking functional
   
   Please test on iPad Air 11-inch (M3) as before.
   
   Thank you!
   ```

6. Submit

---

## 📊 Post-Deployment Monitoring

### Backend Monitoring
```bash
# Check Railway logs
railway logs

# Monitor error rates
# Check Winston logs in Railway dashboard

# Monitor database connections
# Check Prisma connection pool status

# Monitor Redis cache
# Check cache hit/miss rates
```

### Frontend Monitoring
- Monitor crash reports in App Store Connect
- Check user reviews and ratings
- Monitor TestFlight feedback
- Track app performance metrics

### Key Metrics to Watch
- API response times (should be < 2 seconds)
- Error rates (should be < 1%)
- Database connection pool usage (should not exceed 10)
- Cache hit rate (should be > 80%)
- App crash rate (should be < 0.1%)

---

## 🔄 Rollback Procedure

If critical issues are discovered after deployment:

### Backend Rollback
1. Go to Railway dashboard
2. Navigate to Deployments
3. Click "Rollback" on previous stable deployment
4. Verify rollback success

### Frontend Rollback
```bash
cd front

# Revert to previous version in app.json
# Rebuild and resubmit

# OR use OTA update to patch
eas update --branch production --message "Hotfix: revert changes"
```

---

## 🆘 Troubleshooting

### Build Fails
```bash
# Clear EAS cache
eas build:clear-cache

# Retry build
eas build --profile production --platform ios --clear-cache
```

### Authentication Issues
```bash
# Re-login to EAS
eas logout
eas login
```

### Version Conflicts
```bash
# Check current version
node -p "require('./front/app.json').expo.version"

# Manually update if needed
# Edit front/app.json
```

### Database Migration Fails
```bash
# Rollback migration
npm run prisma:migrate reset

# Re-run migration
npm run prisma:migrate deploy
```

---

## 📞 Support Contacts

### Apple Review Team
- App Store Connect: https://appstoreconnect.apple.com
- Resolution Center: Check for messages

### Infrastructure
- Railway Support: https://railway.app/help
- Expo Support: https://expo.dev/support

### Development Team
- Backend Issues: Check Railway logs
- Frontend Issues: Check Expo build logs
- Database Issues: Check Prisma logs

---

## 📝 Deployment Checklist

Use this checklist for each deployment:

```
[ ] All tests passing
[ ] Code reviewed
[ ] Environment variables updated
[ ] Database migrations run
[ ] Backend deployed to Railway
[ ] Backend health check passed
[ ] Frontend version bumped
[ ] Frontend built with EAS
[ ] Build successful
[ ] TestFlight distribution configured
[ ] Demo account tested
[ ] Manual testing on iPad completed
[ ] Manual testing on iPhone completed
[ ] App Store submission prepared
[ ] Privacy policy updated
[ ] Terms of service updated
[ ] Submitted for review
[ ] Monitoring configured
[ ] Team notified
```

---

## 🎯 Quick Commands Reference

### Git Deployment
```bash
# Linux/Mac
./deploy-git.sh

# Windows
.\deploy-git.ps1
```

### Expo Deployment
```bash
# Linux/Mac
./deploy-expo.sh

# Windows
.\deploy-expo.ps1
```

### Backend Commands
```bash
cd Backend

# Run migrations
npm run prisma:migrate deploy

# Open Prisma Studio
npm run prisma:studio

# Check logs
railway logs
```

### Frontend Commands
```bash
cd front

# Check build status
eas build:list

# Submit to TestFlight
eas submit -p ios

# OTA update
eas update --branch production
```

---

**Last Updated**: March 2, 2026  
**Version**: 1.0.0  
**Status**: Ready for deployment (partial - copycat content fixed)
