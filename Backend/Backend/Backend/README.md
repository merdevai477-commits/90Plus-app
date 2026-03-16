# Football App Backend

Backend API for Football App using Express.js, Prisma, and PostgreSQL/Supabase.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- PostgreSQL 14+ OR Supabase account (free)
- npm or yarn package manager

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Setup environment variables:**
Create `.env` file with:
```env
# Database (choose one)
DATABASE_URL="postgresql://postgres:password@localhost:5432/football_app"
# OR use Supabase:
# DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"

# JWT (if using JWT auth)
JWT_SECRET="your-secret-key-change-in-production"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Supabase (if using Supabase Auth)
SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Server
PORT=3000
API_PREFIX="/api"
NODE_ENV="development"
CORS_ORIGIN="http://localhost:8081"

# OAuth (if using Google OAuth)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="/api/auth/google/callback"

# Session
SESSION_SECRET="your-session-secret-change-in-production"
```

3. **Setup database:**
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations to create database tables
npm run prisma:migrate

# Seed the database with sample data
npm run prisma:seed
```

4. **Start the development server:**
```bash
npm run dev
```

The server will be running at `http://localhost:3000`

## 📝 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run prisma:seed` - Seed database with sample data
- `npm run prisma:reset` - Reset database (⚠️ deletes all data)
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier

## 🗄️ Database Setup

### Option 1: Local PostgreSQL
1. Install PostgreSQL locally
2. Create database: `createdb football_app`
3. Update `DATABASE_URL` in `.env`

### Option 2: Supabase (Recommended - Free)
1. Go to https://supabase.com/dashboard
2. Create new project
3. Copy connection string from Settings → Database
4. Update `DATABASE_URL` in `.env`

See `SUPABASE_SETUP.md` for detailed instructions.

## 🔐 Authentication

### Current System: JWT + Passport
- Email/Password authentication
- Google OAuth
- JWT tokens (access + refresh)

### Alternative: Supabase Auth (Available)
- Email/Password authentication
- OAuth providers (Google, Facebook, Apple)
- Magic Links
- Phone Authentication
- Automatic session management

To switch to Supabase Auth, see `HOW_TO_USE_SUPABASE_AUTH.md`

## 🗄️ Database Schema

### Authentication & Users
- **Users** - User accounts with profile information (Clerk authentication)
- **RefreshTokens** - Secure token management
- **Sessions** - Lucia session management

### Football Data
- **Leagues** - Football leagues
- **Teams** - Football teams
- **Players** - Player information
- **PlayerStats** - Player statistics
- **Matches** - Match schedules and results

### Quiz System
- **QuizCategories** - Different quiz types
- **QuizQuestions** - Quiz questions
- **QuizAttempts** - User quiz history

### Gamification
- **CoinTransactions** - Coin earning/spending
- **Achievements** - Available achievements
- **UserAchievements** - User achievement progress

### Social Features
- **Follows** - User follow system
- **Reels** - Short video content
- **Likes** - Reel likes
- **Comments** - Reel comments

### Moderation
- **Notifications** - User notifications
- **Reports** - Content reporting system

## 🔧 API Endpoints

### Health & Info
- `GET /` - API information
- `GET /api` - API information
- `GET /api/health` - Check API and database status
- `GET /api/users` - List all users (for testing)

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/google` - Start Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback
- `POST /api/auth/google/complete` - Complete Google registration
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user info

## 🌱 Sample Data

After running `npm run prisma:seed`, you'll have:
- 3 sample users (including a developer account)
- 3 leagues (Premier League, La Liga, Bundesliga)
- 5 teams with real data
- 4 players with FIFA-style stats
- 2 matches
- 4 quiz categories
- 4 quiz questions
- 6 achievements

### Test Accounts
- Email: `ahmed@football.com` / Password: `password123`
- Email: `sara@football.com` / Password: `password123`
- Email: `dev@football.com` / Password: `password123` (Developer account)

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL / Supabase
- **ORM:** Prisma
- **Authentication:** JWT + Passport (or Supabase Auth)
- **Validation:** class-validator
- **Security:** Helmet, CORS
- **Logging:** Morgan, Winston

## 📁 Project Structure

```
Backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Seed data script
│   └── migrations/        # Database migrations
├── src/
│   ├── main.ts            # Application entry point
│   ├── config/            # Configuration files
│   │   ├── auth.config.ts
│   │   └── supabase.config.ts
│   ├── controllers/       # Route controllers
│   │   ├── auth.controller.ts
│   │   └── auth.controller.supabase.ts
│   ├── middleware/        # Express middleware
│   │   ├── auth.middleware.ts
│   │   └── auth.middleware.supabase.ts
│   ├── routes/           # API routes
│   │   └── auth.routes.ts
│   ├── strategies/       # Passport strategies
│   │   ├── google.strategy.ts
│   │   └── jwt.strategy.ts
│   └── utils/            # Utilities
│       └── jwt.util.ts
├── .env                  # Environment variables
├── tsconfig.json         # TypeScript config
└── package.json          # Dependencies
```

## 📊 Prisma Studio

View and edit your database with Prisma Studio:

```bash
npm run prisma:studio
```

Opens at `http://localhost:5555`

## 📖 Documentation

- `SUPABASE_SETUP.md` - Setup Supabase database
- `SUPABASE_AUTH_SETUP.md` - Setup Supabase Auth
- `HOW_TO_USE_SUPABASE_AUTH.md` - Switch to Supabase Auth
- `AUTH_ENDPOINTS.md` - Authentication endpoints documentation

## 🤝 Contributing

This is a private project. Please contact the development team for contribution guidelines.

## 📄 License

ISC
