# TASK 5: Fix Prisma Client Generation Issue

## Problem

The GDPR controller is showing TypeScript errors because the Prisma client hasn't been regenerated after adding the GDPR models to the schema.

### Errors Found:
- `Property 'gDPRAuditLog' does not exist on type 'PrismaClient'`
- `Property 'dataExportRequest' does not exist on type 'PrismaClient'`
- `Property 'accountDeletionRequest' does not exist on type 'PrismaClient'`
- `Property 'consentLog' does not exist on type 'PrismaClient'`
- Missing User fields: `analyticsConsent`, `pushNotificationsConsent`, `emailCommunicationsConsent`, `dataSharingConsent`, `privacyPolicyVersion`, `privacyPolicyAcceptedAt`, `deletionRequestedAt`

## Root Cause

The Prisma schema was updated with GDPR models, but the Prisma client was not regenerated. The TypeScript types are outdated.

## Solution

### Step 1: Regenerate Prisma Client

```bash
cd Backend
npx prisma generate
```

This will:
- Read the updated `prisma/schema.prisma`
- Generate TypeScript types for all models
- Create client methods: `prisma.gDPRAuditLog`, `prisma.dataExportRequest`, etc.
- Update User model types with new GDPR fields

### Step 2: Run Database Migration

```bash
cd Backend
npx prisma migrate dev --name add_gdpr_compliance
```

This will:
- Create the database tables for GDPR models
- Add new columns to the User table
- Apply all schema changes to PostgreSQL

### Step 3: Verify TypeScript Compilation

```bash
cd Backend
npm run build
```

This should compile without errors after Prisma client regeneration.

## Expected Result

After running these commands, all TypeScript errors should be resolved:

✅ `prisma.gDPRAuditLog.create()` - Available
✅ `prisma.dataExportRequest.findUnique()` - Available
✅ `prisma.accountDeletionRequest.findFirst()` - Available
✅ `prisma.consentLog.create()` - Available
✅ User fields: `analyticsConsent`, `pushNotificationsConsent`, etc. - Available

## Files Status

### ✅ Already Fixed:
- `Backend/src/routes/gdpr.routes.ts` - Uses `requireAuth` (correct)
- `Backend/src/controllers/gdpr.controller.ts` - Uses `req.auth?.userId` (correct)
- `Backend/prisma/schema.prisma` - GDPR models defined (correct)

### ⏳ Needs Prisma Client Regeneration:
- TypeScript types are outdated
- Client methods not available yet

## Next Steps After Fix

1. ✅ Regenerate Prisma client: `npx prisma generate`
2. ✅ Run migration: `npx prisma migrate dev --name add_gdpr_compliance`
3. ⏳ Setup Cloudflare R2 (see `TASK_5_INTEGRATION_GUIDE.md`)
4. ⏳ Add GDPR routes to `Backend/src/main.ts`
5. ⏳ Setup cron jobs for automatic deletion
6. ⏳ Test all 7 endpoints
7. ⏳ Deploy to Railway

## Commands Summary

```bash
# Navigate to Backend directory
cd Backend

# Regenerate Prisma client (fixes TypeScript errors)
npx prisma generate

# Run database migration (creates tables)
npx prisma migrate dev --name add_gdpr_compliance

# Verify compilation
npm run build

# Start server
npm run dev
```

## Notes

- The schema is correct, just needs client regeneration
- All GDPR models follow Prisma naming conventions
- Model names in schema (PascalCase) → Client methods (camelCase)
  - `GDPRAuditLog` → `prisma.gDPRAuditLog`
  - `DataExportRequest` → `prisma.dataExportRequest`
  - `AccountDeletionRequest` → `prisma.accountDeletionRequest`
  - `ConsentLog` → `prisma.consentLog`

## Railway Deployment Note

After local testing, you'll need to run the migration on Railway:

```bash
# Railway will auto-run migrations on deploy, OR manually:
railway run npx prisma migrate deploy
```
