import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetCooldowns() {
  try {
    // Reset all cooldowns for all users
    const result = await prisma.user.updateMany({
      data: {
        lastAvatarChange: null,
        lastCoverChange: null,
        lastReelUpload: null,
      }
    });
    
    console.log(`✅ Reset cooldowns for ${result.count} users`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetCooldowns();
