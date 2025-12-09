# Clerk Webhook Setup Guide

## Overview

This guide explains how to set up Clerk webhooks to sync user data with your Supabase database.

---

## Step 1: Deploy Backend to Railway

Before setting up webhooks, deploy your backend to get a public URL.

Your webhook URL will be:
```
https://your-app.up.railway.app/api/webhooks/clerk
```

---

## Step 2: Configure Webhook in Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **Webhooks** in the sidebar
4. Click **Add Endpoint**

### Endpoint Configuration:

| Field | Value |
|-------|-------|
| **Endpoint URL** | `https://your-app.up.railway.app/api/webhooks/clerk` |
| **Message Filtering** | Select events below |

### Select Events:
- ✅ `user.created`
- ✅ `user.updated`
- ✅ `user.deleted`

5. Click **Create**

---

## Step 3: Copy Signing Secret

After creating the endpoint:

1. Click on your webhook endpoint
2. Find **Signing Secret** (starts with `whsec_`)
3. Copy it

---

## Step 4: Add to Environment Variables

### For Railway:

1. Go to your Railway project
2. Click on your service
3. Go to **Variables** tab
4. Add:
   ```
   CLERK_WEBHOOK_SECRET=whsec_your_secret_here
   ```

### For Local Development:

Add to `.env`:
```
CLERK_WEBHOOK_SECRET=whsec_your_secret_here
```

---

## Step 5: Verify Setup

### Test Webhook Health:
```bash
curl https://your-app.up.railway.app/api/webhooks/clerk/health
```

Expected Response:
```json
{
  "status": "OK",
  "message": "Clerk webhook endpoint is ready",
  "webhookSecretConfigured": true
}
```

### Create Test User:
1. Sign up a new user in your app
2. Check Railway logs for:
   ```
   📧 Processing user.created webhook for: user_xxx
   ✅ User created in database
   ```

---

## Username Generation

When a new user signs up, the webhook automatically:

1. **For Email/Password Registration:**
   - Takes first letters of first + last name
   - Adds 4 random digits
   - Example: `ma8472` (محمد أحمد)

2. **For OAuth (Google/Apple):**
   - Uses email prefix if available
   - Falls back to name-based if taken
   - Example: `john.doe` or `jd8472`

---

## Troubleshooting

### Webhook Not Receiving Events

1. Check endpoint URL is correct
2. Verify backend is deployed and running
3. Check Railway logs for errors

### Signature Verification Failed

1. Verify `CLERK_WEBHOOK_SECRET` is set correctly
2. Make sure there are no extra spaces
3. Check the secret matches the one in Clerk Dashboard

### User Not Created in Database

1. Check Prisma migrations ran
2. Verify database connection
3. Look for errors in logs
