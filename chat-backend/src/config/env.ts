import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
  
  GOOGLE_AI_KEY: z.string().min(1, 'Google AI Key is required for Gemini embeddings'),
  OPENROUTER_API_KEY: z.string().min(1, 'OpenRouter API Key is required for AI models'),
  GROQ_API_KEY: z.string().optional(),
  
  DAILY_MESSAGE_LIMIT: z.string().transform(Number).default('20'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  parsedEnv.error.issues.forEach((issue) => {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = parsedEnv.data;
