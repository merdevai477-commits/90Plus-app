import { ReelData } from './types';

export const MOCK_REELS: ReelData[] = [
    {
        id: '1',
        user: {
            id: '1',
            username: 'player1',
            name: 'لاعب مصري',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
            verified: true,
            followers: 125000,
            isFollowing: false
        },
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=800&fit=crop',
        duration: 30,
        likes: 12400,
        views: 124000,
        comments: 892,
        shares: 234,
        liked: false,
        saved: false,
        muted: true,
        description: 'هدف رائع في المباراة النهائية! 🔥⚽',
        hashtags: ['كرة_القدم', 'أهداف', 'رياضة'],
        location: 'ستاد القاهرة',
        createdAt: new Date()
    },
    {
        id: '2',
        user: {
            id: '2',
            username: 'player2',
            name: 'لاعب برتغالي',
            avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop',
            verified: false,
            followers: 85000,
            isFollowing: true
        },
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=800&fit=crop',
        duration: 25,
        likes: 8900,
        views: 89000,
        comments: 456,
        shares: 123,
        liked: true,
        saved: false,
        muted: false,
        description: 'تمرين اليوم كان قوي! 💪',
        hashtags: ['لياقة', 'صحة', 'تمارين'],
        location: 'نادي الجزيرة',
        createdAt: new Date()
    },
    {
        id: '3',
        user: {
            id: '3',
            username: 'player3',
            name: 'لاعب أرجنتيني',
            avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
            verified: false,
            followers: 92000,
            isFollowing: false
        },
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=800&fit=crop',
        duration: 28,
        likes: 15600,
        views: 156000,
        comments: 1200,
        shares: 567,
        liked: false,
        saved: true,
        muted: true,
        description: 'لحظات لا تُنسى من البطولة',
        hashtags: ['بطولة', 'فوز', 'احتفال'],
        createdAt: new Date()
    }
];
