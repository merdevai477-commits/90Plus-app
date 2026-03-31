import prisma from './src/lib/prisma';

async function checkTestUser() {
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { username: { contains: 'test' } },
                { email: { contains: 'test' } }
            ]
        },
        select: {
            id: true,
            username: true,
            email: true,
            clerkUserId: true,
            displayName: true
        }
    });
    
    console.log('Found users:', JSON.stringify(users, null, 2));
    
    await prisma.$disconnect();
}

checkTestUser();
