# 🚀 Setup with Supabase (Free PostgreSQL)

## Why Supabase?
- ✅ Free PostgreSQL database
- ✅ No installation needed
- ✅ Works immediately
- ✅ 500MB storage free

## Steps:

### 1. Create Supabase Account
Go to: https://supabase.com/dashboard

### 2. Create New Project
- Click "New Project"
- Name: `football-app`
- Database Password: Choose a strong password (save it!)
- Region: Choose closest to you
- Click "Create new project"

### 3. Get Connection String
- Go to Project Settings → Database
- Find "Connection string" → "URI"
- Copy the connection string (looks like):
  ```
  postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
  ```

### 4. Update .env
Replace `DATABASE_URL` in your `.env` file with the Supabase connection string:
```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
```

### 5. Run Migrations
```powershell
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

### 6. Done! 🎉
Your backend is now connected to a cloud PostgreSQL database!

## View Your Data
- Use Supabase Dashboard → Table Editor
- Or use: `npm run prisma:studio`
