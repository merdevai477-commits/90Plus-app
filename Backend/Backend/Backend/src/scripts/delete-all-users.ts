import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllUsers() {
    try {
        console.log('🗑️  Starting to delete all users...');

        // Count users before deletion
        const userCount = await prisma.user.count();
        console.log(`📊 Found ${userCount} users to delete`);

        if (userCount === 0) {
            console.log('✅ No users found. Nothing to delete.');
            return;
        }

        // Delete all users (cascade will handle related data)
        // Prisma will automatically delete related records due to onDelete: Cascade
        const result = await prisma.user.deleteMany({});

        console.log(`✅ Successfully deleted ${result.count} users`);
        console.log('✅ All related data (sessions, tokens, etc.) has been automatically deleted');

        // Verify deletion
        const remainingCount = await prisma.user.count();
        console.log(`📊 Remaining users: ${remainingCount}`);

    } catch (error) {
        console.error('❌ Error deleting users:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
deleteAllUsers()
    .then(() => {
        console.log('✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });

