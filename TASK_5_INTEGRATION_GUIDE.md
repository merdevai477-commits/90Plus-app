# 🚀 TASK 5 - GDPR Integration Guide (Railway + PostgreSQL + Cloudflare R2)

**Date**: March 30, 2026  
**Infrastructure**: Railway + PostgreSQL + Cloudflare R2

---

## 📋 Prerequisites

- Railway account with PostgreSQL database
- Cloudflare account with R2 storage
- Node.js 18+ installed
- Prisma CLI installed

---

## 1️⃣ Database Migration

### Step 1: Update Prisma Schema

✅ Already done! The schema has been updated with:
- GDPR models (DataExportRequest, AccountDeletionRequest, ConsentLog, GDPRAuditLog)
- User consent fields
- Enums (ExportStatus, DeletionStatus, ConsentType, GDPRAction)

### Step 2: Generate Migration

```bash
cd Backend
npx prisma migrate dev --name add_gdpr_compliance
```

This will:
- Create migration files
- Apply changes to your PostgreSQL database
- Update Prisma Client

### Step 3: Verify Migration

```bash
npx prisma studio
```

Check that the new tables exist:
- `data_export_requests`
- `account_deletion_requests`
- `consent_logs`
- `gdpr_audit_logs`

---

## 2️⃣ Cloudflare R2 Setup

### Step 1: Create R2 Bucket

1. Go to Cloudflare Dashboard → R2
2. Click "Create bucket"
3. Name: `90plus-exports`
4. Region: Auto (closest to your users)
5. Click "Create bucket"

### Step 2: Generate API Tokens

1. Go to R2 → Manage R2 API Tokens
2. Click "Create API token"
3. Name: `90plus-backend`
4. Permissions: Object Read & Write
5. TTL: Never expire
6. Click "Create API token"
7. **Save the credentials** (you won't see them again):
   - Access Key ID
   - Secret Access Key
   - Endpoint URL

### Step 3: Configure Public Access (Optional)

If you want direct public URLs:

1. Go to your bucket → Settings
2. Enable "Public Access"
3. Set custom domain (optional): `exports.90plus.app`
4. Configure CORS if needed

### Step 4: Set Lifecycle Rules

1. Go to your bucket → Lifecycle rules
2. Create rule: "Delete exports after 7 days"
3. Filter: Prefix = `exports/`
4. Action: Delete after 7 days
5. Save

---

## 3️⃣ Environment Variables

### Railway Environment Variables

Add these to your Railway project:

```env
# Cloudflare R2 Storage
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=90plus-exports
R2_PUBLIC_URL=https://exports.90plus.app  # or your custom domain

# Email Service (for notifications)
SENDGRID_API_KEY=your_sendgrid_key  # or use another email service
EMAIL_FROM=noreply@90plus.app

# API URL (for frontend)
API_URL=https://your-railway-app.up.railway.app
```

### Local Development (.env)

```env
# Copy from Railway
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=90plus-exports
R2_PUBLIC_URL=http://localhost:3000/exports  # for local testing

# Database (from Railway)
DATABASE_URL=postgresql://user:password@host:port/database

# Email (optional for local)
SENDGRID_API_KEY=your_sendgrid_key
EMAIL_FROM=noreply@90plus.app
```

---

## 4️⃣ Install Dependencies

### Backend

```bash
cd Backend
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

These packages are needed for Cloudflare R2 (S3-compatible API).

---

## 5️⃣ Add Routes to main.ts

### Update Backend/src/main.ts

```typescript
import gdprRoutes from './routes/gdpr.routes';
import { setupGDPRCronJobs } from './services/data-anonymization.service';

// ... existing code ...

// GDPR Routes
app.use('/api/gdpr', gdprRoutes);

// Setup GDPR cron jobs (scheduled deletions, export cleanup)
setupGDPRCronJobs();

// ... rest of the code ...
```

---

## 6️⃣ Test Locally

### Step 1: Start Backend

```bash
cd Backend
npm run dev
```

### Step 2: Test Data Export

```bash
# Request data export
curl -X POST http://localhost:3000/api/gdpr/export-data \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Response:
# {
#   "status": "SUCCESS",
#   "requestId": "abc-123",
#   "message": "Data export request created",
#   "estimatedTime": "5-10 minutes"
# }

# Check status
curl http://localhost:3000/api/gdpr/export-status/abc-123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 3: Test Consent Management

```bash
# Get consent
curl http://localhost:3000/api/gdpr/consent \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update consent
curl -X POST http://localhost:3000/api/gdpr/consent \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "consentType": "ANALYTICS",
    "granted": false
  }'
```

### Step 4: Test Account Deletion

```bash
# Request deletion
curl -X POST http://localhost:3000/api/gdpr/delete-account \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "privacy_concerns"
  }'

# Cancel deletion
curl -X POST http://localhost:3000/api/gdpr/cancel-deletion \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 7️⃣ Deploy to Railway

### Step 1: Commit Changes

```bash
git add .
git commit -m "feat: add GDPR compliance system"
git push origin main
```

### Step 2: Railway Auto-Deploy

Railway will automatically:
1. Detect changes
2. Build the app
3. Run migrations (if configured)
4. Deploy

### Step 3: Run Migration Manually (if needed)

```bash
# In Railway dashboard → your service → Settings → Deploy
# Add build command:
npx prisma migrate deploy && npm run build

# Or run manually via Railway CLI:
railway run npx prisma migrate deploy
```

### Step 4: Verify Deployment

```bash
# Check health
curl https://your-railway-app.up.railway.app/health

# Test GDPR endpoint
curl https://your-railway-app.up.railway.app/api/gdpr/consent \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 8️⃣ Frontend Integration

### Step 1: Update API URL

In `front/.env` or `front/app.json`:

```json
{
  "expo": {
    "extra": {
      "EXPO_PUBLIC_API_URL": "https://your-railway-app.up.railway.app"
    }
  }
}
```

### Step 2: Test Frontend

```bash
cd front
npm start
```

Test:
1. Go to Privacy Settings screen
2. Toggle consent switches
3. Click "Export My Data"
4. Click "Delete My Account"

---

## 9️⃣ Monitoring & Maintenance

### Cron Jobs

The system automatically runs these jobs every hour:

1. **Process Scheduled Deletions**
   - Finds accounts scheduled for deletion (30 days passed)
   - Anonymizes user data
   - Marks deletion as completed

2. **Cleanup Old Exports**
   - Finds expired exports (7 days old)
   - Deletes files from R2
   - Updates database status

### Manual Monitoring

```bash
# Check pending exports
SELECT * FROM data_export_requests WHERE status = 'PENDING';

# Check scheduled deletions
SELECT * FROM account_deletion_requests WHERE status = 'SCHEDULED';

# Check consent logs
SELECT * FROM consent_logs ORDER BY timestamp DESC LIMIT 10;

# Check GDPR audit trail
SELECT * FROM gdpr_audit_logs ORDER BY timestamp DESC LIMIT 10;
```

### Cloudflare R2 Dashboard

Monitor:
- Storage usage
- Request count
- Bandwidth usage
- Lifecycle rule execution

---

## 🔟 Troubleshooting

### Issue: Migration Fails

**Solution**:
```bash
# Reset database (CAUTION: Development only!)
npx prisma migrate reset

# Or apply manually
npx prisma db push
```

### Issue: R2 Upload Fails

**Check**:
1. Credentials are correct
2. Bucket exists
3. Permissions are set (Read & Write)
4. Endpoint URL is correct

**Test R2 Connection**:
```typescript
// Backend/test-r2.ts
import { uploadDataExport } from './src/services/r2-storage.service';

async function test() {
  try {
    const result = await uploadDataExport('test-123', '{"test": true}');
    console.log('✅ R2 Upload Success:', result);
  } catch (error) {
    console.error('❌ R2 Upload Failed:', error);
  }
}

test();
```

```bash
npx ts-node test-r2.ts
```

### Issue: Cron Jobs Not Running

**Check**:
1. `setupGDPRCronJobs()` is called in main.ts
2. Server is running continuously (not serverless)
3. Check logs for errors

**Manual Trigger**:
```typescript
// In your code or via API endpoint
import { processScheduledDeletions, cleanupOldExports } from './services/data-anonymization.service';

await processScheduledDeletions();
await cleanupOldExports();
```

### Issue: Frontend Can't Connect

**Check**:
1. API_URL is correct in frontend
2. CORS is enabled in backend
3. Routes are registered in main.ts
4. Authentication token is valid

---

## 1️⃣1️⃣ Production Checklist

- [ ] Database migration applied
- [ ] R2 bucket created and configured
- [ ] Environment variables set in Railway
- [ ] Routes added to main.ts
- [ ] Cron jobs setup
- [ ] Email service configured
- [ ] Frontend API URL updated
- [ ] Test data export flow
- [ ] Test account deletion flow
- [ ] Test consent management
- [ ] Monitor logs for errors
- [ ] Setup alerts for failures
- [ ] Document for team
- [ ] Legal review completed
- [ ] Privacy policy updated
- [ ] Terms of service updated

---

## 1️⃣2️⃣ Cost Estimation

### Cloudflare R2

**Free Tier**:
- 10 GB storage/month
- 1 million Class A operations/month (writes)
- 10 million Class B operations/month (reads)

**Estimated Usage** (1000 users):
- Storage: ~100 MB (100 KB per export × 1000 users)
- Operations: ~1000 writes/month
- **Cost**: $0 (within free tier)

### Railway PostgreSQL

**Starter Plan**: $5/month
- 1 GB RAM
- 1 GB storage
- Unlimited bandwidth

**Estimated Usage**:
- GDPR tables: ~10 MB
- **Cost**: Included in existing plan

### Total Additional Cost: $0/month

---

## 📚 Additional Resources

- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [GDPR Compliance Guide](https://gdpr.eu/)
- [Railway Docs](https://docs.railway.app/)

---

**Integration Guide by**: Kiro AI Assistant  
**Date**: March 30, 2026  
**Status**: ✅ Ready for Deployment

---

## 🎉 Summary

You now have a complete GDPR compliance system with:
- ✅ Data export to Cloudflare R2
- ✅ Account deletion with 30-day grace period
- ✅ Consent management
- ✅ Complete audit trail
- ✅ Automated cleanup
- ✅ Railway + PostgreSQL integration
- ✅ Production-ready

**Next Steps**: Follow the checklist above and deploy! 🚀
