/**
 * Script to verify and grant developer access to a user
 * Usage: npx ts-node src/scripts/verify-user.ts <username>
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

async function verifyUser(username: string) {
  try {
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
    
    // If not found, try exact match
    if (!user) {
      user = await prisma.user.findUnique({
        where: { username: username },
      });
    }
    
    // If still not found, search by partial match
    if (!user) {
      logger.warn(`User with username "${username}" not found, searching by partial match...`);
      
      // Try partial match
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
          console.log(`  ${i + 1}. ${u.username} (${u.displayName || 'N/A'}) - Verified: ${u.isVerified}, Developer: ${u.isDeveloper}`);
        });
        console.log('\n💡 Use the exact username from the list above.');
      } else {
        // List all users
        const allUsers = await prisma.user.findMany({
          select: {
            username: true,
            displayName: true,
            email: true,
            isVerified: true,
            isDeveloper: true,
          },
          take: 20,
          orderBy: { createdAt: 'desc' },
        });
        
        if (allUsers.length === 0) {
          console.log('\n⚠️ No users found in database. The user needs to sign up first.');
        } else {
          console.log('\n📋 Available users (last 20):');
          allUsers.forEach((u, i) => {
            console.log(`  ${i + 1}. ${u.username} (${u.displayName || 'N/A'}) - Verified: ${u.isVerified}, Developer: ${u.isDeveloper}`);
          });
        }
      }
      
      await prisma.$disconnect();
      process.exit(1);
    }

    logger.info(`Found user: ${user.username} (${user.email})`);
    logger.info(`Current status: isVerified=${user.isVerified}, isDeveloper=${user.isDeveloper}`);

    // Update user to verified and developer
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        isDeveloper: true,
      },
    });

    logger.info(`✅ Successfully updated user "${username}"`);
    logger.info(`New status: isVerified=${updatedUser.isVerified}, isDeveloper=${updatedUser.isDeveloper}`);
    
    console.log('\n✅ User updated successfully!');
    console.log(`Username: ${updatedUser.username}`);
    console.log(`Email: ${updatedUser.email}`);
    console.log(`Verified: ${updatedUser.isVerified}`);
    console.log(`Developer: ${updatedUser.isDeveloper}`);
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    logger.error('Error updating user:', error);
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Get username from command line arguments
const username = process.argv[2];

if (!username) {
  console.error('❌ Please provide a username');
  console.log('Usage: npx ts-node src/scripts/verify-user.ts <username>');
  process.exit(1);
}

verifyUser(username);
