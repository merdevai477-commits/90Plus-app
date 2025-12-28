import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await prisma.report.deleteMany();
    await prisma.userAchievement.deleteMany();
    await prisma.achievement.deleteMany();
    await prisma.coinTransaction.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.like.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.reel.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.quizAttempt.deleteMany();
    await prisma.quizQuestion.deleteMany();
    await prisma.quizCategory.deleteMany();
    await prisma.match.deleteMany();
    await prisma.playerStats.deleteMany();
    await prisma.player.deleteMany();
    await prisma.team.deleteMany();
    await prisma.league.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();

    // No seed users - all users must register fresh
    console.log('👤 Users cleared - ready for fresh registrations');

    // Create Leagues
    console.log('🏆 Creating leagues...');
    const premierLeague = await prisma.league.create({
        data: {
            name: 'Premier League',
            country: 'England',
            logo: 'https://example.com/premier-league.png',
            season: '2024/25',
        },
    });

    const laLiga = await prisma.league.create({
        data: {
            name: 'La Liga',
            country: 'Spain',
            logo: 'https://example.com/la-liga.png',
            season: '2024/25',
        },
    });

    const bundesliga = await prisma.league.create({
        data: {
            name: 'Bundesliga',
            country: 'Germany',
            logo: 'https://example.com/bundesliga.png',
            season: '2024/25',
        },
    });

    // Create Teams
    console.log('⚽ Creating teams...');
    const manUnited = await prisma.team.create({
        data: {
            name: 'Manchester United',
            logo: 'https://example.com/man-utd.png',
            country: 'England',
            stadium: 'Old Trafford',
            founded: 1878,
            leagueId: premierLeague.id,
        },
    });

    const liverpool = await prisma.team.create({
        data: {
            name: 'Liverpool',
            logo: 'https://example.com/liverpool.png',
            country: 'England',
            stadium: 'Anfield',
            founded: 1892,
            leagueId: premierLeague.id,
        },
    });

    const realMadrid = await prisma.team.create({
        data: {
            name: 'Real Madrid',
            logo: 'https://example.com/real-madrid.png',
            country: 'Spain',
            stadium: 'Santiago Bernabéu',
            founded: 1902,
            leagueId: laLiga.id,
        },
    });

    const barcelona = await prisma.team.create({
        data: {
            name: 'FC Barcelona',
            logo: 'https://example.com/barcelona.png',
            country: 'Spain',
            stadium: 'Camp Nou',
            founded: 1899,
            leagueId: laLiga.id,
        },
    });

    const bayernMunich = await prisma.team.create({
        data: {
            name: 'Bayern Munich',
            logo: 'https://example.com/bayern.png',
            country: 'Germany',
            stadium: 'Allianz Arena',
            founded: 1900,
            leagueId: bundesliga.id,
        },
    });

    // Create Players
    console.log('🏃 Creating players...');
    const salah = await prisma.player.create({
        data: {
            name: 'Mohamed Salah',
            photo: 'https://example.com/salah.png',
            position: 'FW',
            number: 11,
            nationality: 'Egypt',
            age: 31,
            teamId: liverpool.id,
            stats: {
                create: {
                    pace: 91,
                    shooting: 87,
                    passing: 81,
                    dribbling: 90,
                    defending: 45,
                    physical: 75,
                    overall: 89,
                },
            },
        },
    });

    const mbappe = await prisma.player.create({
        data: {
            name: 'Kylian Mbappé',
            photo: 'https://example.com/mbappe.png',
            position: 'FW',
            number: 9,
            nationality: 'France',
            age: 25,
            teamId: realMadrid.id,
            stats: {
                create: {
                    pace: 97,
                    shooting: 88,
                    passing: 80,
                    dribbling: 92,
                    defending: 36,
                    physical: 77,
                    overall: 91,
                },
            },
        },
    });

    const lewandowski = await prisma.player.create({
        data: {
            name: 'Robert Lewandowski',
            photo: 'https://example.com/lewandowski.png',
            position: 'FW',
            number: 9,
            nationality: 'Poland',
            age: 35,
            teamId: barcelona.id,
            stats: {
                create: {
                    pace: 78,
                    shooting: 92,
                    passing: 79,
                    dribbling: 86,
                    defending: 44,
                    physical: 82,
                    overall: 91,
                },
            },
        },
    });

    const neuer = await prisma.player.create({
        data: {
            name: 'Manuel Neuer',
            photo: 'https://example.com/neuer.png',
            position: 'GK',
            number: 1,
            nationality: 'Germany',
            age: 37,
            teamId: bayernMunich.id,
            stats: {
                create: {
                    pace: 58,
                    shooting: 13,
                    passing: 55,
                    dribbling: 30,
                    defending: 90,
                    physical: 78,
                    overall: 88,
                },
            },
        },
    });

    // Create Matches
    console.log('📅 Creating matches...');
    await prisma.match.create({
        data: {
            homeTeamId: manUnited.id,
            awayTeamId: liverpool.id,
            homeScore: 2,
            awayScore: 1,
            status: 'FINISHED',
            leagueId: premierLeague.id,
            matchDate: new Date('2024-11-25'),
            venue: 'Old Trafford',
        },
    });

    await prisma.match.create({
        data: {
            homeTeamId: realMadrid.id,
            awayTeamId: barcelona.id,
            homeScore: null,
            awayScore: null,
            status: 'SCHEDULED',
            leagueId: laLiga.id,
            matchDate: new Date('2024-12-05'),
            venue: 'Santiago Bernabéu',
        },
    });

    // Create Quiz Categories
    console.log('❓ Creating quiz categories...');
    const inCommon = await prisma.quizCategory.create({
        data: {
            name: 'In Common',
            description: 'Find what players have in common',
            icon: '🤝',
            isLocked: false,
            unlockLevel: 1,
        },
    });

    const flash = await prisma.quizCategory.create({
        data: {
            name: 'Flash',
            description: 'Quick fire questions',
            icon: '⚡',
            isLocked: false,
            unlockLevel: 1,
        },
    });

    const whoAmI = await prisma.quizCategory.create({
        data: {
            name: 'Who Am I?',
            description: 'Guess the player from clues',
            icon: '🎭',
            isLocked: false,
            unlockLevel: 2,
        },
    });

    const highFive = await prisma.quizCategory.create({
        data: {
            name: 'High Five',
            description: 'Name 5 things',
            icon: '🖐️',
            isLocked: false,
            unlockLevel: 1,
        },
    });

    const qa = await prisma.quizCategory.create({
        data: {
            name: 'Q&A',
            description: 'Multiple choice questions',
            icon: '❓',
            isLocked: false,
            unlockLevel: 1,
        },
    });

    const teammates = await prisma.quizCategory.create({
        data: {
            name: 'Teammates',
            description: 'Questions about teammates',
            icon: '👥',
            isLocked: true,
            unlockLevel: 3,
        },
    });

    const guessNumber = await prisma.quizCategory.create({
        data: {
            name: 'Guess the Number',
            description: 'Guess numbers and statistics',
            icon: '🔢',
            isLocked: false,
            unlockLevel: 1,
        },
    });

    const legends = await prisma.quizCategory.create({
        data: {
            name: 'Legends',
            description: 'Questions about football legends',
            icon: '👑',
            isLocked: true,
            unlockLevel: 3,
        },
    });

    // Import and seed quiz questions
    console.log('💭 Creating quiz questions...');
    try {
        const { seedQuizQuestions } = require('./quiz-questions-seed');
        await seedQuizQuestions(prisma, {
            inCommon: inCommon.id,
            flash: flash.id,
            whoAmI: whoAmI.id,
            highFive: highFive.id,
            qa: qa.id,
            teammates: teammates.id,
            guessNumber: guessNumber.id,
            legends: legends.id,
        });
    } catch (error) {
        console.error('⚠️  Error seeding quiz questions:', error);
        console.log('📝 Creating sample quiz questions instead...');
        await prisma.quizQuestion.createMany({
            data: [
                {
                    categoryId: inCommon.id,
                    question: 'What do Cristiano Ronaldo and Lionel Messi have in common?',
                    options: [
                        'Both won World Cup',
                        'Both won Ballon d\'Or',
                        'Both played for Barcelona',
                        'Both are from Brazil',
                    ],
                    correctAnswer: '1',
                    difficulty: 'EASY',
                    points: 10,
                },
                {
                    categoryId: flash.id,
                    question: 'Which country won the 2018 FIFA World Cup?',
                    options: ['Brazil', 'Germany', 'France', 'Argentina'],
                    correctAnswer: '2',
                    difficulty: 'EASY',
                    points: 10,
                    timeLimit: 10,
                },
            ],
        });
    }

    // Create Achievements
    console.log('🏅 Creating achievements...');
    await prisma.achievement.createMany({
        data: [
            {
                name: 'Quiz Beginner',
                description: 'Complete your first quiz',
                icon: '🎓',
                category: 'QUIZ_MASTER',
                requirement: JSON.stringify({ quizzes_completed: 1 }),
                coinReward: 50,
                xpReward: 100,
                rarity: 'COMMON',
            },
            {
                name: 'Quiz Expert',
                description: 'Complete 50 quizzes',
                icon: '🧠',
                category: 'QUIZ_MASTER',
                requirement: JSON.stringify({ quizzes_completed: 50 }),
                coinReward: 500,
                xpReward: 1000,
                rarity: 'RARE',
            },
            {
                name: 'Social Butterfly',
                description: 'Get 100 followers',
                icon: '🦋',
                category: 'SOCIAL_BUTTERFLY',
                requirement: JSON.stringify({ followers_count: 100 }),
                coinReward: 300,
                xpReward: 500,
                rarity: 'RARE',
            },
            {
                name: 'Coin Collector',
                description: 'Earn 10,000 coins',
                icon: '💰',
                category: 'COIN_COLLECTOR',
                requirement: JSON.stringify({ total_coins_earned: 10000 }),
                coinReward: 1000,
                xpReward: 2000,
                rarity: 'EPIC',
            },
            {
                name: 'Reel Star',
                description: 'Get 1000 views on a reel',
                icon: '⭐',
                category: 'REEL_STAR',
                requirement: JSON.stringify({ reel_views: 1000 }),
                coinReward: 200,
                xpReward: 400,
                rarity: 'RARE',
            },
            {
                name: 'Legend',
                description: 'Reach level 50',
                icon: '👑',
                category: 'STREAK_KEEPER',
                requirement: JSON.stringify({ level: 50 }),
                coinReward: 5000,
                xpReward: 10000,
                rarity: 'LEGENDARY',
            },
        ],
    });

    // Note: Sample data for users (coin transactions, follows, notifications)
    // are not created because seed.ts doesn't create users
    // All users must register fresh through the app

    console.log('✅ Database seeded successfully!');
    console.log('📊 Summary:');
    console.log(`   - Leagues: 3`);
    console.log(`   - Teams: 5`);
    console.log(`   - Players: 4`);
    console.log(`   - Matches: 2`);
    console.log(`   - Quiz Categories: 8 (${inCommon.name}, ${flash.name}, ${whoAmI.name}, ${highFive.name}, ${qa.name}, ${teammates.name}, ${guessNumber.name}, ${legends.name})`);
    const questionCount = await prisma.quizQuestion.count();
    console.log(`   - Quiz Questions: ${questionCount}`);
    console.log(`   - Achievements: 6`);
    console.log(`   - Quiz Attempts: 0 (users will create attempts when playing)`);
    console.log(`   - Coin Transactions: 0 (created when users earn coins)`);
    console.log(`   - Follows: 0 (created when users follow each other)`);
    console.log(`   - Notifications: 0 (created dynamically)`);
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
