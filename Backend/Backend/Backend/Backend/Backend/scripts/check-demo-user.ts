
import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function main() {
  const email = 'aibuilder80@gmail.com';
  
  logger.info(`🔍 Checking for demo user: ${email}`);
  
  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (user) {
      logger.info(`✅ User found in database: ${user.id} (${user.username})`);
      logger.info(`
⚠️ IMPORTANT INSTRUCTIONS FOR APPLE REVIEW:
Apple needs to sign in with:
Email: ${email}
Password: 1872004ME

Since authentication is handled by Clerk, you must ensure this user exists in your Clerk Dashboard with this EXACT password.

If you cannot reset the password in Clerk, you should:
1. Delete this user from Clerk Dashboard.
2. Delete this user from the database (run: npx ts-node scripts/delete-demo-user.ts).
3. Sign up again in the app with these exact credentials.
`);
    } else {
      logger.warn(`❌ User NOT found in local database.`);
      logger.info(`
ℹ️ This means the user has not been synced to your database yet.
Action items:
1. Go to the app and Sign Up with:
   Email: ${email}
   Password: 1872004ME
2. This will create the user in Clerk and sync it to your database.
`);
    }
  } catch (error) {
    logger.error('Error checking user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
