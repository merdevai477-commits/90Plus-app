import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDemoAccount() {
  console.log('🔍 Testing Demo Account: aibuilder80@gmail.com');
  console.log('=' .repeat(50));

  try {
    // Test database connection first
    console.log('\n1. Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Search for the demo account
    console.log('\n2. Searching for demo account in database...');
    const demoUser = await prisma.user.findUnique({
      where: {
        email: 'aibuilder80@gmail.com'
      },
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
        xp: true,
        createdAt: true,
        updatedAt: true,
        clerkUserId: true
      }
    });

    if (demoUser) {
      console.log('✅ Demo account found in database!');
      console.log('\nAccount Details:');
      console.log(`   ID: ${demoUser.id}`);
      console.log(`   Email: ${demoUser.email}`);
      console.log(`   Username: ${demoUser.username || 'Not set'}`);
      console.log(`   Display Name: ${demoUser.displayName || 'Not set'}`);
      console.log(`   Clerk User ID: ${demoUser.clerkUserId || 'Not set'}`);
      console.log(`   Is Developer: ${demoUser.isDeveloper}`);
      console.log(`   Is Verified: ${demoUser.isVerified}`);
      console.log(`   Is Suspended: ${demoUser.isSuspended}`);
      console.log(`   Is Banned: ${demoUser.isBanned}`);
      console.log(`   Is Deleted: ${demoUser.isDeleted}`);
      console.log(`   Coins: ${demoUser.coins}`);
      console.log(`   Level: ${demoUser.level}`);
      console.log(`   XP: ${demoUser.xp}`);
      console.log(`   Created: ${demoUser.createdAt}`);
      console.log(`   Updated: ${demoUser.updatedAt}`);

      // Check for any moderation issues
      console.log('\n3. Checking for moderation issues...');
      
      const strikes = await prisma.strike.count({
        where: { userId: demoUser.id }
      });
      
      const reports = await prisma.report.count({
        where: { reportedUserId: demoUser.id }
      });

      console.log(`   Strikes: ${strikes}`);
      console.log(`   Reports: ${reports}`);

      // Check account status
      console.log('\n4. Account Status Summary:');
      if (demoUser.isSuspended) {
        console.log('❌ Account is SUSPENDED');
      } else if (demoUser.isBanned) {
        console.log('❌ Account is BANNED');
      } else if (demoUser.isDeleted) {
        console.log('❌ Account is DELETED');
      } else {
        console.log('✅ Account is ACTIVE and accessible');
      }

    } else {
      console.log('❌ Demo account NOT found in database!');
      console.log('\nThis means the account needs to be created.');
    }

    // Check total users count
    console.log('\n5. Database Statistics:');
    const totalUsers = await prisma.user.count();
    const activeUsers = await prisma.user.count({
      where: {
        isDeleted: false,
        isBanned: false,
        isSuspended: false
      }
    });
    
    console.log(`   Total Users: ${totalUsers}`);
    console.log(`   Active Users: ${activeUsers}`);

  } catch (error) {
    console.error('❌ Error testing demo account:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\n🔚 Test completed');
  }
}

// Run the test
testDemoAccount().catch(console.error);