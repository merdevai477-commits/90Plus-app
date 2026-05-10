import { ClerkUserService } from './src/services/clerk-user.service';
import prisma from './src/lib/prisma';

async function main() {
  console.log('Testing ClerkUserService.findOrCreateUser...');
  try {
    // Use a known existing clerk user ID from the database
    const firstUser = await prisma.user.findFirst();
    if (!firstUser) {
      console.log('No users in DB to test.');
      return;
    }
    console.log('Testing with clerkUserId:', firstUser.clerkUserId);
    const result = await ClerkUserService.findOrCreateUser(firstUser.clerkUserId);
    console.log('Result:', result?.id);
  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    await prisma.$disconnect();
  }
}
main();
