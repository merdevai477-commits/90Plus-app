import { Comment } from './types';

export const mockComments: Comment[] = [
    {
        id: 'c1',
        user: {
            id: 'user4',
            name: 'خالد أحمد',
            username: 'khaled_a',
            avatar: 'https://i.pravatar.cc/100?img=15',
            verified: false,
        },
        text: 'تعليق رائع! 👏',
        likes: 234,
        liked: false,
        replies: 12,
        timeAgo: 'منذ ساعتين',
        createdAt: new Date('2024-01-15'),
    },
    {
        id: 'c2',
        user: {
            id: 'user5',
            name: 'فاطمة محمود',
            username: 'fatma_m',
            avatar: 'https://i.pravatar.cc/100?img=26',
            verified: true,
        },
        text: 'هدف خرافي! 🔥⚽',
        likes: 567,
        liked: true,
        replies: 23,
        timeAgo: 'منذ 3 ساعات',
        createdAt: new Date('2024-01-15'),
    },
    {
        id: 'c3',
        user: {
            id: 'user6',
            name: 'علي حسين',
            username: 'ali_h',
            avatar: 'https://i.pravatar.cc/100?img=41',
            verified: false,
        },
        text: 'مستوى عالي جداً 💯',
        likes: 89,
        liked: false,
        replies: 5,
        timeAgo: 'منذ 5 ساعات',
        createdAt: new Date('2024-01-15'),
    },
];
