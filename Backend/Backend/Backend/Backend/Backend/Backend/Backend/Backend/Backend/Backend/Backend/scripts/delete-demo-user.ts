
import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function main() {
  const email = 'aibuilder80@gmail.com';
  
  logger.info(`🗑️ Deleting demo user: ${email}`);
  
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user) {
      logger.info('User not found, nothing to delete.');
      return;
    }

    // Delete related data first if needed (cascade should handle it usually, but let's be safe)
    // Actually, Prisma schema usually handles cascade delete or we just delete user.
    
    await prisma.user.delete({
      where: { email },
    });
    
    logger.info(`✅ User ${email} deleted from database.`);
    logger.info(`
👉 NEXT STEP:
Go to your Clerk Dashboard (https://dashboard.clerk.com) and delete the user ${email} there as well.
Then, open your app and Sign Up again with the credentials Apple expects.
`);

  } catch (error) {
    logger.error('Error deleting user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
