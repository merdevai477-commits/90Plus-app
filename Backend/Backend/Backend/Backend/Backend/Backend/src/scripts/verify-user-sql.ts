/**
 * Script to verify user using raw SQL (works even if Prisma has issues)
 * Usage: npx ts-node src/scripts/verify-user-sql.ts <username>
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

let databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  databaseUrl = databaseUrl.trim().replace(/^["']|["']$/g, '');
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function verifyUserWithSQL(username: string) {
  try {
    if (!databaseUrl) {
      console.error('❌ DATABASE_URL not found');
      process.exit(1);
    }

    console.log('🔗 Connecting to Railway database...\n');

    // First, list all users to see what's available
    const allUsers = await prisma.$queryRaw<Array<{
      id: string;
      username: string;
      "displayName": string | null;
      email: string;
      "isVerified": boolean;
      "isDeveloper": boolean;
    }>>`
      SELECT id, username, "displayName", email, "isVerified", "isDeveloper"
      FROM users
      ORDER BY "createdAt" DESC
      LIMIT 50
    `;

    if (allUsers.length === 0) {
      console.log('⚠️ No users found in Railway database.\n');
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log(`📋 Found ${allUsers.length} users in Railway database:\n`);
    allUsers.forEach((u, i) => {
      console.log(`  ${i + 1}. Username: ${u.username}`);
      console.log(`     Display Name: ${u.displayName || 'N/A'}`);
      console.log(`     Email: ${u.email}`);
      console.log(`     Verified: ${u.isVerified ? '✅' : '❌'}`);
      console.log(`     Developer: ${u.isDeveloper ? '✅' : '❌'}`);
      console.log('');
    });

    // Find user (case-insensitive)
    const user = allUsers.find(
      u => 
        u.username.toLowerCase() === username.toLowerCase() ||
        (u.displayName && u.displayName.toLowerCase() === username.toLowerCase())
    );

    if (!user) {
      console.log(`\n❌ User "${username}" not found.`);
      console.log('💡 Use the exact username from the list above.\n');
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log(`\n✅ Found user: ${user.username}`);
    console.log(`   Current Verified: ${user.isVerified ? '✅' : '❌'}`);
    console.log(`   Current Developer: ${user.isDeveloper ? '✅' : '❌'}\n`);

    // Update using raw SQL
    console.log('🔄 Updating user...');
    await prisma.$executeRaw`
      UPDATE users
      SET "isVerified" = true, "isDeveloper" = true, "updatedAt" = NOW()
      WHERE id = ${user.id}
    `;

    // Verify update
    const updated = await prisma.$queryRaw<Array<{
      username: string;
      "isVerified": boolean;
      "isDeveloper": boolean;
    }>>`
      SELECT username, "isVerified", "isDeveloper"
      FROM users
      WHERE id = ${user.id}
    `;

    if (updated.length > 0) {
      console.log('\n✅✅✅ User updated successfully on Railway! ✅✅✅');
      console.log(`   Username: ${updated[0].username}`);
      console.log(`   Verified: ${updated[0].isVerified ? '✅' : '❌'}`);
      console.log(`   Developer: ${updated[0].isDeveloper ? '✅' : '❌'}\n`);
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

const username = process.argv[2];

if (!username) {
  console.error('❌ Please provide a username');
  console.log('Usage: npx ts-node src/scripts/verify-user-sql.ts <username>');
  process.exit(1);
}

verifyUserWithSQL(username);

