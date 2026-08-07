/// <reference types="node" />
import 'dotenv/config';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRawUnsafe<{ ok: number }[]>('SELECT 1::int AS ok');
    console.log('POSTGRES_OK', rows);
  } catch (e: any) {
    console.log('POSTGRES_FAIL', String(e?.message ?? e).slice(0, 300));
  } finally {
    await prisma.$disconnect();
  }

  const r = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 1,
    connectTimeout: 10000,
    lazyConnect: true,
  });
  try {
    await r.connect();
    console.log('REDIS_OK', await r.ping());
  } catch (e: any) {
    console.log('REDIS_FAIL', String(e?.message ?? e).slice(0, 300));
  } finally {
    try {
      await r.quit();
    } catch {
      /* ignore */
    }
  }
}

main();
