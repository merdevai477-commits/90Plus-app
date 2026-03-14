import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * ⚠️ IMPORTANT COPYRIGHT WARNING ⚠️
 * 
 * This seed file is for DEVELOPMENT ONLY and should NEVER be used in production.
 * The quiz-questions-seed.ts file contains copyrighted player names and content
 * that violates Apple's Guideline 4.1 - Design - Copycats.
 * 
 * For production, the app uses:
 * - Backend/src/data/quiz-questions/legends-complete.ts (generic descriptions only)
 * 
 * DO NOT run this seed in production environments!
 */

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
    const englishLeague = await prisma.league.create({
        data: {
            name: 'English League 1',
            country: 'England',
            logo: null,
            season: '2024/25',
        },
    });

    const spanishLeague = await prisma.league.create({
        data: {
            name: 'Spanish League 1',
            country: 'Spain',
            logo: null,
            season: '2024/25',
        },
    });

    const germanLeague = await prisma.league.create({
        data: {
            name: 'German League 1',
            country: 'Germany',
            logo: null,
            season: '2024/25',
        },
    });

    // Create Teams
    console.log('⚽ Creating teams...');
    const englishTeam1 = await prisma.team.create({
        data: {
            name: 'English Team 1',
            logo: null,
            country: 'England',
            stadium: 'Stadium A',
            founded: 1878,
            leagueId: englishLeague.id,
        },
    });

    const englishTeam2 = await prisma.team.create({
        data: {
            name: 'English Team 2',
            logo: null,
            country: 'England',
            stadium: 'Stadium B',
            founded: 1892,
            leagueId: englishLeague.id,
        },
    });

    const spanishTeam1 = await prisma.team.create({
        data: {
            name: 'Spanish Team 1',
            logo: null,
            country: 'Spain',
            stadium: 'Stadium C',
            founded: 1902,
            leagueId: spanishLeague.id,
        },
    });

    const spanishTeam2 = await prisma.team.create({
        data: {
            name: 'Spanish Team 2',
            logo: null,
            country: 'Spain',
            stadium: 'Stadium D',
            founded: 1899,
            leagueId: spanishLeague.id,
        },
    });

    const germanTeam1 = await prisma.team.create({
        data: {
            name: 'German Team 1',
            logo: null,
            country: 'Germany',
            stadium: 'Stadium E',
            founded: 1900,
            leagueId: germanLeague.id,
        },
    });

    // Create Players
    console.log('🏃 Creating players...');
    const player1 = await prisma.player.create({
        data: {
            name: 'Player One',
            photo: null,
            position: 'FW',
            number: 11,
            nationality: 'Egypt',
            age: 31,
            teamId: englishTeam2.id,
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

    const player2 = await prisma.player.create({
        data: {
            name: 'Player Two',
            photo: null,
            position: 'FW',
            number: 9,
            nationality: 'France',
            age: 25,
            teamId: spanishTeam1.id,
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

    const player3 = await prisma.player.create({
        data: {
            name: 'Player Three',
            photo: null,
            position: 'FW',
            number: 9,
            nationality: 'Poland',
            age: 35,
            teamId: spanishTeam2.id,
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

    const player4 = await prisma.player.create({
        data: {
            name: 'Player Four',
            photo: null,
            position: 'GK',
            number: 1,
            nationality: 'Germany',
            age: 37,
            teamId: germanTeam1.id,
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
            homeTeamId: englishTeam1.id,
            awayTeamId: englishTeam2.id,
            homeScore: 2,
            awayScore: 1,
            status: 'FINISHED',
            leagueId: englishLeague.id,
            matchDate: new Date('2024-11-25'),
            venue: 'Stadium A',
        },
    });

    await prisma.match.create({
        data: {
            homeTeamId: spanishTeam1.id,
            awayTeamId: spanishTeam2.id,
            homeScore: null,
            awayScore: null,
            status: 'SCHEDULED',
            leagueId: spanishLeague.id,
            matchDate: new Date('2024-12-05'),
            venue: 'Stadium C',
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
                    question: 'What do Player A and Player B have in common?',
                    options: [
                        'Both won international tournament',
                        'Both won individual award',
                        'Both played for same team',
                        'Both are from same country',
                    ],
                    correctAnswer: '1',
                    difficulty: 'EASY',
                    points: 10,
                },
                {
                    categoryId: flash.id,
                    question: 'Which country won the 2018 international tournament?',
                    options: ['Country A', 'Country B', 'Country C', 'Country D'],
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
