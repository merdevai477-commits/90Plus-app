# 🧪 GDPR Testing Guide

## Quick Start

### 1. Start Server
```bash
cd Backend
npm run dev
```

### 2. Get Your Token
- Login to the app
- Open DevTools → Network
- Copy `Authorization: Bearer <token>` from any API request

### 3. Test with PowerShell
```powershell
# Edit token in file
code test-gdpr-endpoints.ps1

# Run tests
.\test-gdpr-endpoints.ps1
```

## Expected Results

### ✅ All Endpoints Should Return 200

1. **GET /api/gdpr/consent** → Returns consent settings
2. **POST /api/gdpr/consent** → Updates consent
3. **POST /api/gdpr/export-data** → Creates export request
4. **GET /api/gdpr/export-status/:id** → Returns export status
5. **GET /api/gdpr/deletion-status** → Returns deletion status
6. **POST /api/gdpr/delete-account** → Schedules deletion (30 days)
7. **POST /api/gdpr/cancel-deletion** → Cancels deletion

## Manual Testing

### Test Data Export
```powershell
# Request export
curl -X POST http://localhost:3000/api/gdpr/export-data `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -H "Content-Type: application/json"

# Check status (use requestId from response)
curl -X GET http://localhost:3000/api/gdpr/export-status/REQUEST_ID `
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Account Deletion
```powershell
# Request deletion
curl -X POST http://localhost:3000/api/gdpr/delete-account `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"reason":"Testing"}'

# Check status
curl -X GET http://localhost:3000/api/gdpr/deletion-status `
  -H "Authorization: Bearer YOUR_TOKEN"

# Cancel deletion
curl -X POST http://localhost:3000/api/gdpr/cancel-deletion `
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Consent Management
```powershell
# Get consent
curl -X GET http://localhost:3000/api/gdpr/consent `
  -H "Authorization: Bearer YOUR_TOKEN"

# Update consent
curl -X POST http://localhost:3000/api/gdpr/consent `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"consentType":"ANALYTICS","granted":false}'
```

## Check Database

```sql
-- Export requests
SELECT * FROM data_export_requests ORDER BY "requestedAt" DESC;

-- Deletion requests
SELECT * FROM account_deletion_requests ORDER BY "requestedAt" DESC;

-- Consent logs
SELECT * FROM consent_logs ORDER BY timestamp DESC;

-- GDPR audit logs
SELECT * FROM gdpr_audit_logs ORDER BY timestamp DESC;
```

## Troubleshooting

### Server won't start
- Check DATABASE_URL in .env
- Make sure PostgreSQL is running
- Run `npx prisma generate`

### 401 Unauthorized
- Token expired (get new one)
- Token format wrong (should be `Bearer <token>`)

### 404 Not Found
- Check route: `/api/gdpr/...` (not `/gdpr/...`)
- Server might not have started properly

### R2 Upload Failed
- Check R2 credentials in .env
- Verify R2_ENDPOINT is set
- Check server logs for details

## Success Indicators

✅ Server logs show:
```
✅ GDPR Cron Jobs scheduled (hourly)
✅ GDPR Export Cleanup Cron Job scheduled (daily at 3 AM)
```

✅ All endpoints return 200 status

✅ Database tables populated:
- data_export_requests
- account_deletion_requests
- consent_logs
- gdpr_audit_logs

✅ Frontend screens work:
- Privacy Settings
- Delete Account

## Next Steps

After all tests pass:
1. ✅ Commit changes
2. ⏳ Deploy to Railway (when ready)
3. ⏳ Test in production
4. ⏳ Legal review
5. ⏳ App Store submission
