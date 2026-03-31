# GDPR System - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Configure Environment Variables

Add to `Backend/.env`:

```env
# Cloudflare R2 Storage
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=90plus-exports
R2_PUBLIC_URL=https://exports.90plus.app
```

### Step 2: Run Deployment Script

```bash
cd Backend
chmod +x deploy-gdpr.sh
./deploy-gdpr.sh
```

### Step 3: Test Endpoints

```bash
# Set your test token
export TEST_USER_TOKEN="your_clerk_token_here"

# Run tests
npx ts-node test-gdpr-endpoints.ts
```

## ✅ Verification Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Server started successfully
- [ ] All tests passing
- [ ] Privacy policy accessible at `/privacy-policy.html`
- [ ] Terms of service accessible at `/terms-of-service.html`

## 📚 Full Documentation

See `GDPR_COMPLIANCE_GUIDE.md` for complete documentation.

## 🆘 Quick Troubleshooting

### Server won't start
- Check DATABASE_URL in .env
- Verify PostgreSQL is running
- Run `npx prisma generate`

### Tests failing
- Verify TEST_USER_TOKEN is set
- Check server is running
- Verify authentication is working

### Export not processing
- Check R2 credentials
- Verify R2 bucket exists
- Check server logs

## 📞 Support

For detailed help, see:
- `GDPR_COMPLIANCE_GUIDE.md` - Complete guide
- `TASK_5_GDPR_COMPLETE.md` - Implementation summary
- Server logs at `logs/app.log`

---

**Ready to deploy!** 🎉
