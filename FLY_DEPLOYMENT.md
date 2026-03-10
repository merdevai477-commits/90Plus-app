# Fly.io Deployment Guide

## Prerequisites

1. Install Fly CLI: `powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"`
2. Create Fly.io account (free tier available)
3. Create Upstash Redis account (free tier: 10K commands/day)

## Initial Setup

### 1. Login to Fly.io

```bash
cd Backend
fly auth login
```

### 2. Create App (First Time Only)

```bash
fly launch --no-deploy
# Choose app name: 90plus-backend
# Choose region: fra (Frankfurt - closest to Middle East)
# Don't deploy yet
```

### 3. Create PostgreSQL Database

```bash
# Create database (free tier: 3GB storage, 1 shared CPU)
fly postgres create --name 90plus-db --region fra

# Attach to app (sets DATABASE_URL automatically)
fly postgres attach 90plus-db
```

### 4. Setup Redis (Upstash)

1. Go to https://console.upstash.com/
2. Create new Redis database (free tier)
3. Copy the connection URL
4. Set secret:

```bash
fly secrets set REDIS_URL="redis://default:YOUR_PASSWORD@YOUR_ENDPOINT.upstash.io:6379"
```

### 5. Set Environment Variables

Run the PowerShell script:

```powershell
.\fly-secrets-setup.ps1
```

Or manually:

```bash
fly secrets set \
  NODE_ENV="production" \
  CLERK_SECRET_KEY="your_key" \
  CLERK_PUBLISHABLE_KEY="your_key" \
  CLERK_WEBHOOK_SECRET="your_secret" \
  SUPABASE_URL="your_url" \
  SUPABASE_ANON_KEY="your_key" \
  SUPABASE_SERVICE_ROLE_KEY="your_key" \
  CLOUDINARY_CLOUD_NAME="your_name" \
  CLOUDINARY_API_KEY="your_key" \
  CLOUDINARY_API_SECRET="your_secret" \
  FOOTBALL_API_KEY="your_key"
```

### 6. Deploy

```bash
fly deploy
```

## Daily Operations

### Deploy Updates

```bash
cd Backend
fly deploy
```

### View Logs

```bash
fly logs
fly logs -a 90plus-backend  # specific app
```

### Check Status

```bash
fly status
fly info
```

### Scale (if needed)

```bash
# Scale to 2 machines
fly scale count 2

# Scale memory (256MB free, 512MB+ paid)
fly scale memory 512
```

### Database Operations

```bash
# Connect to database
fly postgres connect -a 90plus-db

# Run migrations
fly ssh console -C "cd /app && npx prisma migrate deploy"
```

### SSH Access

```bash
fly ssh console
```

## Monitoring

### Health Check

```bash
curl https://90plus-backend.fly.dev/api/health
```

### Metrics

```bash
fly dashboard
```

## Troubleshooting

### App Not Starting

```bash
# Check logs
fly logs

# Check secrets
fly secrets list

# Restart app
fly apps restart 90plus-backend
```

### Database Connection Issues

```bash
# Check DATABASE_URL is set
fly secrets list | grep DATABASE_URL

# Re-attach database
fly postgres attach 90plus-db
```

### WebSocket Issues

- Ensure `force_https = true` in fly.toml
- Check that frontend uses `wss://` not `ws://`
- Verify port 443 is configured in services

## Cost Breakdown (Free Tier)

- **App**: 3 shared-cpu-1x VMs with 256MB RAM (free)
- **PostgreSQL**: 3GB storage, 1 shared CPU (free)
- **Redis**: Upstash free tier - 10K commands/day (free)
- **Bandwidth**: 100GB/month (free)

Total: $0/month 🎉

## Upgrading to Paid (After Apple Approval)

If you need more resources:

```bash
# Upgrade to dedicated CPU
fly scale vm dedicated-cpu-1x

# Increase memory
fly scale memory 1024

# Add more machines
fly scale count 2
```

## Returning to Railway

When ready to return to Railway:

1. Keep all environment variables
2. Update `front/config/api.config.ts` production URL back to Railway
3. Railway will auto-deploy from GitHub
4. Delete Fly.io app: `fly apps destroy 90plus-backend`

## Support

- Fly.io Docs: https://fly.io/docs/
- Community: https://community.fly.io/
- Status: https://status.flyio.net/
