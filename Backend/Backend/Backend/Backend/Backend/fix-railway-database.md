# Fix Railway Database Connection Issue

## Problem
The `/api/clerk/me` endpoint is returning 500 errors with message: "Database error while loading user"

## Root Cause
The `DATABASE_URL` environment variable on Railway is either:
1. Not set
2. Set to `${{Postgres.DATABASE_URL}}` but PostgreSQL service is not attached
3. Connection pool exhausted
4. Database connection timeout

## Solution Steps

### Option 1: Use Railway PostgreSQL (Recommended)

1. **Add PostgreSQL Service**
   ```bash
   # In your Railway project dashboard
   Click "New" → "Database" → "Add PostgreSQL"
   ```

2. **Wait for Deployment**
   - Railway will automatically create the database
   - `DATABASE_URL` will be populated with `${{Postgres.DATABASE_URL}}`

3. **Run Migrations**
   ```bash
   railway run npx prisma migrate deploy
   ```

4. **Redeploy**
   ```bash
   git push
   ```

### Option 2: Use Neon Database (Current Setup)

1. **Set DATABASE_URL Manually**
   ```bash
   railway variables set DATABASE_URL="postgresql://neondb_owner:npg_PpiHYbQ2etD4@ep-floral-sunset-als9j23r-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
   ```

2. **Verify Variable**
   ```bash
   railway variables
   ```

3. **Redeploy**
   ```bash
   railway up
   ```

### Option 3: Quick Fix - Update Environment Variables via Dashboard

1. Go to Railway Dashboard: https://railway.app/dashboard
2. Select your project: "90Plus-app"
3. Click on "Variables" tab
4. Find `DATABASE_URL` variable
5. If it shows `${{Postgres.DATABASE_URL}}`:
   - Either add PostgreSQL service (Option 1)
   - Or replace with Neon URL (Option 2)

## Verification

After applying the fix, verify the connection:

```bash
# Check logs
railway logs

# Should see:
# ✅ Database connected
# ✅ Prisma client initialized
```

## Additional Fixes Applied

### 1. Added Retry Logic to `/api/clerk/me`
- 3 retry attempts with exponential backoff
- Better error messages
- Timeout protection (10 seconds per attempt)

### 2. Enhanced Error Logging
- Detailed error codes and messages
- Stack traces for debugging
- Connection pool status monitoring

### 3. Database Connection Improvements
- Connection timeout: 20 seconds
- Pool timeout: 10 seconds
- Automatic retry on connection errors
- Graceful degradation

## Testing

After deployment, test the endpoint:

```bash
# From your mobile app, try to load profile
# Or use curl:
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://90plus-app-production-26e9.up.railway.app/api/clerk/me
```

Expected response:
```json
{
  "status": "SUCCESS",
  "data": {
    "user": {
      "id": "...",
      "username": "...",
      ...
    }
  }
}
```

## Monitoring

Monitor the following metrics:
- `/api/clerk/me` response time (should be < 2s)
- Error rate (should be < 1%)
- Database connection pool usage
- Retry count per request

## Rollback Plan

If issues persist:

1. **Check Railway Logs**
   ```bash
   railway logs
   ```

2. **Verify Database Connection**
   ```bash
   railway run npx prisma db pull
   ```

3. **Test Locally**
   ```bash
   npm run dev
   # Try accessing http://localhost:3000/api/health
   ```

## Next Steps

1. ✅ Deploy the fixes to Railway
2. ✅ Verify DATABASE_URL is set correctly
3. ✅ Test profile loading in mobile app
4. ✅ Monitor error rates for 24 hours
5. ⏳ Consider upgrading to Railway Pro for better database performance

## Contact

If issues persist after following these steps:
- Check Railway status: https://status.railway.app/
- Review Neon status: https://neon.tech/status
- Check application logs for specific error codes
