/**
 * Script to verify and grant developer access to a user on Railway
 * This script connects directly to Railway database
 * Usage: npx ts-node src/scripts/verify-user-railway.ts <username>
 * 
 * Make sure DATABASE_URL is set to Railway database URL
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

async function verifyUserOnRailway(username: string) {
  try {
    console.log('🔗 Connecting to Railway database...');
    console.log(`📝 Looking for user: ${username}\n`);

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
      logger.warn(`User with username "${username}" not found, searching by partial match...`);
      
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
        console.log(`\n🔍 Found ${partialUsers.length} similar users:`);
        partialUsers.forEach((u, i) => {
          console.log(`  ${i + 1}. ${u.username} (${u.displayName || 'N/A'})`);
          console.log(`     Email: ${u.email}`);
          console.log(`     Verified: ${u.isVerified ? '✅' : '❌'}`);
          console.log(`     Developer: ${u.isDeveloper ? '✅' : '❌'}`);
          console.log('');
        });
        console.log('💡 Use the exact username from the list above.\n');
      } else {
        console.log(`\n❌ User "${username}" not found in Railway database.\n`);
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

    console.log('\n✅ User updated successfully on Railway!');
    console.log(`   Username: ${updatedUser.username}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   Verified: ${updatedUser.isVerified ? '✅' : '❌'}`);
    console.log(`   Developer: ${updatedUser.isDeveloper ? '✅' : '❌'}\n`);
    
    logger.info(`✅ Successfully updated user "${username}" on Railway`);
    logger.info(`New status: isVerified=${updatedUser.isVerified}, isDeveloper=${updatedUser.isDeveloper}`);
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    logger.error('Error updating user on Railway:', error);
    console.error('\n❌ Error:', error.message);
    
    if (error.message?.includes('P1001') || error.message?.includes('Can\'t reach database')) {
      console.error('\n💡 Make sure DATABASE_URL is set to Railway database URL');
      console.error('   Check Railway environment variables\n');
    }
    
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Get username from command line arguments
const username = process.argv[2];

if (!username) {
  console.error('❌ Please provide a username');
  console.log('Usage: npx ts-node src/scripts/verify-user-railway.ts <username>');
  console.log('Example: npx ts-node src/scripts/verify-user-railway.ts Mrdev_1');
  process.exit(1);
}

verifyUserOnRailway(username);

