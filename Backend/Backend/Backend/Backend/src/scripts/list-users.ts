/**
 * Script to list all users
 * Usage: npx ts-node src/scripts/list-users.ts
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        isVerified: true,
        isDeveloper: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    console.log(`\n📋 Found ${users.length} users:\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. Username: ${user.username}`);
      console.log(`   Display Name: ${user.displayName || 'N/A'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Verified: ${user.isVerified ? '✅' : '❌'}`);
      console.log(`   Developer: ${user.isDeveloper ? '✅' : '❌'}`);
      console.log(`   Created: ${user.createdAt.toISOString()}`);
      console.log('');
    });

    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    logger.error('Error listing users:', error);
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

listUsers();

