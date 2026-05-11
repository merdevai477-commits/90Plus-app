import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, '../data/qa-cache.json');

const prisma = new PrismaClient();
let genAI: GoogleGenerativeAI;

interface CacheEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
  language: string;
  hits: number;
  createdAt: string;
  lastHit: string;
}

async function main() {
  console.log('🚀 Starting cache migration to PostgreSQL + pgvector...');

  if (!process.env.GOOGLE_AI_KEY) {
    console.error('❌ GOOGLE_AI_KEY is missing in your .env file.');
    console.error('💡 Please add: GOOGLE_AI_KEY=your-gemini-key-here');
    process.exit(1);
  }

  genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);

  if (!fs.existsSync(CACHE_FILE)) {
    console.warn(`⚠️ Cache file not found at ${CACHE_FILE}. Skipping migration.`);
    return;
  }

  const rawData = fs.readFileSync(CACHE_FILE, 'utf-8');
  const store = JSON.parse(rawData);
  const entries: CacheEntry[] = store.cache || [];

  console.log(`📦 Found ${entries.length} entries to migrate.`);

  let successCount = 0;
  let errorCount = 0;

  for (const entry of entries) {
    try {
      // 1. Generate Embedding using Gemini
      const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
      const result = await model.embedContent(entry.question.trim());
      const embedding = result.embedding.values;
      
      // Format array to pgvector string format: '[0.1, 0.2, ...]'
      const vectorString = `[${embedding.join(',')}]`;

      // 2. Insert into PostgreSQL using raw query (required for pgvector)
      await prisma.$executeRaw`
        INSERT INTO "QACache" (
          id, question, answer, category, language, "hitCount", "lastHit", "createdAt", embedding
        ) VALUES (
          ${entry.id}, 
          ${entry.question.trim()}, 
          ${entry.answer}, 
          ${entry.category || 'general'}, 
          ${entry.language || 'ar'}, 
          ${entry.hits || 0}, 
          ${new Date(entry.lastHit || new Date())}, 
          ${new Date(entry.createdAt || new Date())}, 
          ${vectorString}::vector
        )
        ON CONFLICT (question) DO UPDATE SET
          "hitCount" = "QACache"."hitCount" + EXCLUDED."hitCount",
          "lastHit" = EXCLUDED."lastHit";
      `;

      successCount++;
      console.log(`✅ Migrated: "${entry.question}"`);
      
      // Optional: Add a small delay to respect OpenAI rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`❌ Failed to migrate: "${entry.question}"`, error);
      errorCount++;
    }
  }

  console.log('🎉 Migration completed!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
