# 90Plus Chat Backend

REST API + WebSocket server للـ 90Plus AI Chat.

## Stack
- **Runtime**: Node.js 24 + TypeScript
- **Framework**: Express 4
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT (Access Token 15m + Refresh Token 30d)
- **Real-time**: WebSocket (ws)
- **AI**: DeepSeek API (OpenAI-compatible)

## Setup

### 1. متطلبات
- Node.js 18+
- PostgreSQL

### 2. تثبيت
```bash
npm install
```

### 3. إعداد الـ .env
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/90plus_chat"
JWT_SECRET="your-super-secret-key"
AI_API_KEY="your-deepseek-api-key"
AI_BASE_URL="https://api.deepseek.com"
AI_MODEL="deepseek-chat"
PORT=3001
FRONTEND_URL="http://localhost:5173"
DAILY_MESSAGE_LIMIT=5
```

### 4. إعداد الـ Database
```bash
# إنشاء الـ tables
npm run db:push

# أو بـ migrations
npm run db:migrate
```

### 5. تشغيل
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | تسجيل مستخدم جديد |
| POST | `/api/auth/login` | تسجيل الدخول |
| POST | `/api/auth/refresh` | تجديد الـ access token |
| POST | `/api/auth/logout` | تسجيل الخروج |

### Conversations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | جيب كل المحادثات |
| POST | `/api/conversations` | محادثة جديدة |
| GET | `/api/conversations/:id/messages` | رسائل محادثة |
| PATCH | `/api/conversations/:id` | تعديل (عنوان/pin) |
| DELETE | `/api/conversations/:id` | حذف محادثة |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/limit` | الـ daily limit status |
| POST | `/api/chat/send` | ابعت رسالة (REST) |

### WebSocket
```
ws://localhost:3001/ws?token=<access_token>
```

**Messages:**
```json
// ابعت رسالة
{ "type": "chat", "conversationId": "...", "message": "..." }

// Ping
{ "type": "ping" }
```

**Responses:**
```json
// رد AI
{ "type": "message", "userMessage": {...}, "aiMessage": {...}, "limit": {...} }

// Typing indicator
{ "type": "typing", "isTyping": true }

// Error
{ "type": "error", "code": "LIMIT_REACHED", "message": "...", "resetAt": "..." }
```

## Project Structure
```
src/
├── config/
│   ├── database.ts     # Prisma client singleton
│   └── env.ts          # Zod env validation
├── middleware/
│   ├── auth.ts         # JWT validation + token generation
│   └── rateLimit.ts    # In-memory rate limiter
├── routes/
│   ├── auth.ts         # Register, Login, Refresh, Logout
│   ├── conversations.ts # CRUD للمحادثات
│   └── chat.ts         # Send message + limit status
├── services/
│   ├── AIService.ts    # DeepSeek API integration
│   ├── LimitService.ts # Daily limit management
│   └── PromptService.ts # Category detection + prompt loading
├── websocket/
│   └── ChatWebSocket.ts # WebSocket server with JWT auth
└── index.ts            # Entry point
prompts/
├── football.md
├── training.md
├── nutrition.md
└── recovery.md
```
