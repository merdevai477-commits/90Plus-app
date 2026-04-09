# Football App Backend

Backend API for Football App using Express.js, Prisma, and PostgreSQL.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- PostgreSQL 14+ (or a managed Postgres like Neon)
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
# Or use a managed Postgres provider connection string.

# JWT (if using JWT auth)
JWT_SECRET="your-secret-key-change-in-production"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Server
PORT=3000
API_PREFIX="/api"
NODE_ENV="development"
CORS_ORIGIN="http://localhost:8081"

# Cloudflare R2 (media uploads)
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="your-bucket"
R2_MEDIA_PUBLIC_URL="https://media.yourdomain.com"

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

### Option 2: Managed PostgreSQL (Recommended)
1. Create a database on your provider (e.g. Neon, Railway, Render, etc.)
2. Copy the connection string
3. Update `DATABASE_URL` in `.env`

## 🔐 Authentication

### Current System
- Clerk authentication for API routes that require login
- JWT (where applicable)

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
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** Clerk + JWT (where applicable)
- **Validation:** class-validator
- **Security:** Helmet, CORS
- **Logging:** Morgan, Winston

## 📁 Project Structure

```
src/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Seed data script
│   └── migrations/        # Database migrations
├── src/
│   ├── main.ts            # Application entry point
│   ├── config/            # Configuration files
│   │   ├── auth.config.ts
│   │   └── storage.config.ts
│   ├── controllers/       # Route controllers
│   │   ├── auth.controller.ts
│   ├── middleware/        # Express middleware
│   │   ├── auth.middleware.ts
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

- Media uploads use Cloudflare R2 (avatars/covers/reels/thumbnails)
- `AUTH_ENDPOINTS.md` - Authentication endpoints documentation

## 🤝 Contributing

This is a private project. Please contact the development team for contribution guidelines.

## 📄 License

ISC
