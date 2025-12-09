# Railway Deployment Guide for 90Plus Backend

## Prerequisites
- [x] Railway account created
- [ ] GitHub repo with Backend code
- [ ] Supabase project (for database)
- [ ] Clerk API keys

---

## Step 1: Connect GitHub

1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub Repo"**
4. Authorize Railway to access your GitHub
5. Select your **Football-app** repository

---

## Step 2: Configure Service

1. Railway will detect your project
2. Click on the service card
3. Go to **Settings** tab
4. Set these values:

| Setting | Value |
|---------|-------|
| **Root Directory** | `Backend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

---

## Step 3: Add Environment Variables

Go to **Variables** tab and add:

```env
# Server
NODE_ENV=production
PORT=3000

# Database (from Supabase)
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres

# Supabase
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Clerk
CLERK_SECRET_KEY=sk_live_xxx
CLERK_PUBLISHABLE_KEY=pk_live_xxx
```

---

## Step 4: Deploy

1. Click **"Deploy"** button
2. Watch the build logs
3. Wait for "Deployment successful" ✅

---

## Step 5: Get Your URL

After deployment:
1. Go to **Settings** → **Domains**
2. Click **"Generate Domain"**
3. You'll get: `https://your-app.up.railway.app`

---

## Test Your Deployment

```
https://your-app.up.railway.app/api/health
```

Expected response:
```json
{
  "status": "OK",
  "database": "Connected"
}
```
