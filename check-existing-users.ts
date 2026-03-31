import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkExistingUsers() {
  console.log('🔍 Checking all existing users in database');
  console.log('=' .repeat(50));

  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully\n');

    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        isDeveloper: true,
        isVerified: true,
        isSuspended: true,
        isBanned: true,
        isDeleted: true,
        coins: true,
        level: true,
        createdAt: true,
        clerkUserId: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${users.length} user(s) in database:\n`);

    users.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username || 'Not set'}`);
      console.log(`   Display Name: ${user.displayName || 'Not set'}`);
      console.log(`   Clerk ID: ${user.clerkUserId || 'Not set'}`);
      console.log(`   Is Developer: ${user.isDeveloper}`);
      console.log(`   Is Verified: ${user.isVerified}`);
      console.log(`   Status: ${user.isSuspended ? 'SUSPENDED' : user.isBanned ? 'BANNED' : user.isDeleted ? 'DELETED' : 'ACTIVE'}`);
      console.log(`   Coins: ${user.coins}`);
      console.log(`   Level: ${user.level}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log('   ' + '-'.repeat(40));
    });

    // Check if demo account exists with different email variations
    console.log('\nChecking for demo account variations...');
    
    const demoVariations = [
      'aibuilder80@gmail.com',
      'AIBUILDER80@GMAIL.COM',
      'aibuilder80@GMAIL.COM'
    ];

    for (const email of demoVariations) {
      const user = await prisma.user.findFirst({
        where: {
          email: {
            equals: email,
            mode: 'insensitive'
          }
        }
      });
      
      if (user) {
        console.log(`✅ Found demo account with email: ${user.email}`);
      } else {
        console.log(`❌ No account found for: ${email}`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking users:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\n🔚 Check completed');
  }
}

checkExistingUsers().catch(console.error);