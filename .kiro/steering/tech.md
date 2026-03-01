# Tech Stack

## Backend

- **Runtime:** Node.js 18+
- **Framework:** Express.js with TypeScript
- **Database:** PostgreSQL (hosted on Supabase/Neon)
- **ORM:** Prisma
- **Authentication:** Clerk (previously JWT + Passport)
- **Caching:** Redis (ioredis)
- **Storage:** Supabase Storage + Cloudflare R2
- **Real-time:** Socket.io + WebSockets
- **Job Queue:** Bull
- **Validation:** class-validator, class-transformer
- **Security:** Helmet, CORS, rate limiting (express-rate-limit)
- **Logging:** Winston, Morgan
- **Testing:** Jest, fast-check (property-based testing)

## Frontend

- **Framework:** React Native 0.76.9
- **Platform:** Expo SDK 52 (managed workflow)
- **Router:** expo-router (file-based routing)
- **Language:** TypeScript
- **State Management:** Zustand
- **Data Fetching:** @tanstack/react-query
- **Authentication:** @clerk/clerk-expo
- **UI Libraries:** 
  - React Native Reanimated (animations)
  - React Native Gesture Handler
  - Expo AV (video playback)
  - Lottie (animations)
  - Lucide React Native (icons)
- **Real-time:** socket.io-client
- **Internationalization:** Custom i18n with locale files
- **Testing:** Jest, fast-check

## Common Commands

### Backend

```bash
# Development
npm run dev                    # Start dev server with hot reload
npm run build                  # Build for production
npm start                      # Start production server

# Database
npm run prisma:generate        # Generate Prisma client
npm run prisma:migrate         # Run migrations
npm run prisma:studio          # Open Prisma Studio GUI
npm run prisma:seed            # Seed database
npm run prisma:reset           # Reset database (⚠️ deletes data)

# Testing
npm test                       # Run tests
npm run test:adversarial       # Run property-based tests
npm run reliability:check      # Check routes and memory

# Code Quality
npm run lint                   # Run ESLint
npm run lint:fix               # Fix ESLint errors
npm run format                 # Format with Prettier
```

### Frontend

```bash
# Development
npm start                      # Start Expo dev server (LAN)
npm run start:tunnel           # Start with tunnel (ngrok)
npm run android                # Run on Android
npm run ios                    # Run on iOS

# Building
npm run build:android          # Build Android (EAS)
npm run build:ios              # Build iOS (EAS)

# Testing
npm test                       # Run tests
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Run with coverage

# Code Quality
npm run lint                   # Run ESLint
```

## Environment Variables

### Backend (.env)
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` - Clerk auth
- `REDIS_URL` - Redis connection
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` - Storage
- `CLOUDFLARE_*` - R2 storage credentials

### Frontend (.env)
- `EXPO_PUBLIC_API_URL` - Backend API URL
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk auth
- `EXPO_PUBLIC_SPORTMONKS_TOKEN` - Football data API

## Build System

- **Backend:** TypeScript compiler (tsc) → dist/
- **Frontend:** Metro bundler (Expo) → EAS Build for production
- **Deployment:** Railway (backend), EAS (mobile apps)
