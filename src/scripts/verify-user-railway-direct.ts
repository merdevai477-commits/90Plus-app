/**
 * Script to verify user on Railway - Direct connection
 * Usage: 
 *   DATABASE_URL="postgresql://..." npx ts-node src/scripts/verify-user-railway-direct.ts <username>
 *   OR set DATABASE_URL in .env file
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get and clean DATABASE_URL
let databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  // Remove quotes and whitespace
  databaseUrl = databaseUrl.trim().replace(/^["']|["']$/g, '');
}

// Create Prisma client with Railway DATABASE_URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function verifyUserOnRailway(username: string) {
  try {
    if (!databaseUrl) {
      console.error('❌ DATABASE_URL not found in environment variables');
      console.log('\n💡 Please set DATABASE_URL:');
      console.log('   Option 1: Set in .env file (without quotes)');
      console.log('   Option 2: Pass as environment variable:');
      console.log('     $env:DATABASE_URL="postgresql://..." ; npx ts-node src/scripts/verify-user-railway-direct.ts <username>');
      process.exit(1);
    }
    
    // Validate URL format
    if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
      console.error('❌ Invalid DATABASE_URL format');
      console.error(`   Current: ${databaseUrl.substring(0, 50)}...`);
      console.log('\n💡 DATABASE_URL must start with postgresql:// or postgres://');
      process.exit(1);
    }

    console.log('🔗 Connecting to Railway database...');
    console.log(`📝 Looking for user: ${username}\n`);

    // Test connection
    await prisma.$connect();
    console.log('✅ Connected to database\n');

    // Find user by username (case-insensitive) or displayName
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          {
            username: {
              equals: username,
              mode: 'insensitive',
            },
          },
          {
            displayName: {
              equals: username,
              mode: 'insensitive',
            },
          },
        ],
      },
    });
    
    // If not found, try partial match
    if (!user) {
      console.log(`⚠️ User "${username}" not found, searching by partial match...\n`);
      
      const partialUsers = await prisma.user.findMany({
        where: {
          OR: [
            {
              username: {
                contains: username,
                mode: 'insensitive',
              },
            },
            {
              displayName: {
                contains: username,
                mode: 'insensitive',
              },
            },
          ],
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          isVerified: true,
          isDeveloper: true,
        },
        take: 10,
      });
      
      if (partialUsers.length > 0) {
        console.log(`🔍 Found ${partialUsers.length} similar users:\n`);
        partialUsers.forEach((u, i) => {
          console.log(`  ${i + 1}. Username: ${u.username}`);
          console.log(`     Display Name: ${u.displayName || 'N/A'}`);
          console.log(`     Email: ${u.email}`);
          console.log(`     Verified: ${u.isVerified ? '✅' : '❌'}`);
          console.log(`     Developer: ${u.isDeveloper ? '✅' : '❌'}`);
          console.log('');
        });
        console.log('💡 Use the exact username from the list above.\n');
      } else {
        console.log(`❌ User "${username}" not found in Railway database.\n`);
        
        // List all users to help find the correct one
        console.log('📋 Listing all users in Railway database:\n');
        const allUsers = await prisma.user.findMany({
          select: {
            username: true,
            displayName: true,
            email: true,
            isVerified: true,
            isDeveloper: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        
        if (allUsers.length === 0) {
          console.log('⚠️ No users found in Railway database.\n');
        } else {
          console.log(`Found ${allUsers.length} users:\n`);
          allUsers.forEach((u, i) => {
            console.log(`  ${i + 1}. Username: ${u.username}`);
            console.log(`     Display Name: ${u.displayName || 'N/A'}`);
            console.log(`     Email: ${u.email}`);
            console.log(`     Verified: ${u.isVerified ? '✅' : '❌'}`);
            console.log(`     Developer: ${u.isDeveloper ? '✅' : '❌'}`);
            console.log('');
          });
          console.log('💡 Use the exact username from the list above.\n');
        }
      }
      
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log('✅ Found user:');
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Display Name: ${user.displayName || 'N/A'}`);
    console.log(`   Current Verified: ${user.isVerified ? '✅' : '❌'}`);
    console.log(`   Current Developer: ${user.isDeveloper ? '✅' : '❌'}\n`);

    // Update user to verified and developer
    console.log('🔄 Updating user...');
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        isDeveloper: true,
      },
    });

    console.log('\n✅✅✅ User updated successfully on Railway! ✅✅✅');
    console.log(`   Username: ${updatedUser.username}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Verified: ${updatedUser.isVerified ? '✅' : '❌'}`);
    console.log(`   Developer: ${updatedUser.isDeveloper ? '✅' : '❌'}\n`);
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message?.includes('P1001') || error.message?.includes('Can\'t reach database')) {
      console.error('\n💡 Connection error. Check:');
      console.error('   1. DATABASE_URL is correct');
      console.error('   2. Database is accessible');
      console.error('   3. Network connection is working\n');
    } else if (error.message?.includes('protocol')) {
      console.error('\n💡 DATABASE_URL must start with postgresql:// or postgres://');
      console.error('   Example: postgresql://user:password@host:port/database\n');
    }
    
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Get username from command line arguments
const username = process.argv[2];

if (!username) {
  console.error('❌ Please provide a username');
  console.log('Usage: npx ts-node src/scripts/verify-user-railway-direct.ts <username>');
  console.log('Example: npx ts-node src/scripts/verify-user-railway-direct.ts Mrdev_1');
  process.exit(1);
}

verifyUserOnRailway(username);

