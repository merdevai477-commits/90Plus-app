import { DiamondProfile, DashboardStats, VideoItem } from './DiamondCard';

// Diamond Profile Mock Data
export const mockDiamondProfile: DiamondProfile = {
  id: 'mahmoud-essam-1',
  username: 'mahmoud_essam',
  displayName: 'Mahmoud Essam',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  coverImage: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=200&fit=crop',
  weight: 75,
  height: 180,
  age: 25,
  strongFoot: 'right',
  position: 'مهاجم',
  favoriteClub: {
    name: 'ريال مدريد',
    logo: 'https://logos-world.net/wp-content/uploads/2020/06/Real-Madrid-Logo.png',
    country: 'إسبانيا'
  },
  bio: 'مطور التطبيق ومحلل رياضي محترف. أحب مشاركة معرفتي وخبرتي في عالم كرة القدم مع المجتمع.',
  stats: {
    views: 125000,
    likes: 8500,
    questionsSolved: 250,
    rating: 4.8,
    posts: 45,
    predictions: 180,
    interactions: 12000,
    level: 15,
    followers: 2500,
    following: 150,
    monthlyViews: 15000,
    yearlyViews: 180000,
    engagementRate: 85,
    contentQuality: 92
  },
  videos: [
    {
      id: '1',
      title: 'تحليل مباراة ريال مدريد ضد برشلونة',
      thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=225&fit=crop',
      duration: '5:30',
      views: 15000,
      likes: 850,
      comments: 120,
      shares: 45,
      uploadDate: '2024-01-15',
      quality: '4K',
      category: 'تحليل',
      tags: ['ريال مدريد', 'برشلونة', 'كلاسيكو', 'تحليل']
    },
    {
      id: '2',
      title: 'أفضل أهداف الأسبوع',
      thumbnail: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=225&fit=crop',
      duration: '3:45',
      views: 8500,
      likes: 420,
      comments: 85,
      shares: 32,
      uploadDate: '2024-01-12',
      quality: 'HD',
      category: 'أهداف',
      tags: ['أهداف', 'أسبوع', 'أفضل']
    },
    {
      id: '3',
      title: 'توقعات مباريات نهاية الأسبوع',
      thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=225&fit=crop',
      duration: '7:20',
      views: 12000,
      likes: 680,
      comments: 95,
      shares: 28,
      uploadDate: '2024-01-10',
      quality: 'HD',
      category: 'توقعات',
      tags: ['توقعات', 'مباريات', 'أسبوع']
    },
    {
      id: '4',
      title: 'مراجعة تشكيلة المنتخب الوطني',
      thumbnail: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=225&fit=crop',
      duration: '4:15',
      views: 9500,
      likes: 520,
      comments: 78,
      shares: 35,
      uploadDate: '2024-01-08',
      quality: 'HD',
      category: 'منتخب',
      tags: ['منتخب', 'تشكيلة', 'مراجعة']
    },
    {
      id: '5',
      title: 'أفضل لحظات كأس العالم',
      thumbnail: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=400&h=225&fit=crop',
      duration: '6:45',
      views: 18000,
      likes: 1200,
      comments: 150,
      shares: 65,
      uploadDate: '2024-01-05',
      quality: '4K',
      category: 'لحظات',
      tags: ['كأس العالم', 'لحظات', 'أفضل']
    }
  ],
  badges: [
    {
      id: '1',
      name: 'VIP',
      icon: 'crown',
      color: '#FFD700',
      description: 'عضو VIP مميز',
      earnedDate: '2024-01-01'
    },
    {
      id: '2',
      name: 'Expert',
      icon: 'star',
      color: '#22c55e',
      description: 'خبير في التحليل الرياضي',
      earnedDate: '2024-01-05'
    },
    {
      id: '3',
      name: 'Influencer',
      icon: 'users',
      color: '#3b82f6',
      description: 'مؤثر في المجتمع الرياضي',
      earnedDate: '2024-01-10'
    },
    {
      id: '4',
      name: 'Coach',
      icon: 'trophy',
      color: '#f59e0b',
      description: 'مدرب معتمد',
      earnedDate: '2024-01-15'
    }
  ],
  achievements: [
    {
      id: '1',
      title: 'أول 1000 متابع',
      description: 'احصل على أول 1000 متابع',
      icon: 'users',
      progress: 1000,
      maxProgress: 1000,
      unlocked: true
    },
    {
      id: '2',
      title: '100 فيديو منشور',
      description: 'انشر 100 فيديو',
      icon: 'video',
      progress: 45,
      maxProgress: 100,
      unlocked: false
    },
    {
      id: '3',
      title: 'خبير التوقعات',
      description: 'احصل على 90% دقة في التوقعات',
      icon: 'target',
      progress: 78,
      maxProgress: 90,
      unlocked: false
    }
  ],
  socialStats: {
    followers: [
      {
        id: 'f1',
        username: 'football_fan_1',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face',
        followDate: '2024-01-15'
      },
      {
        id: 'f2',
        username: 'sports_analyst',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face',
        followDate: '2024-01-14'
      }
    ],
    following: [
      {
        id: 'f3',
        username: 'real_madrid_official',
        avatar: 'https://logos-world.net/wp-content/uploads/2020/06/Real-Madrid-Logo.png',
        followDate: '2024-01-10'
      }
    ]
  },
  notifications: [
    {
      id: 'n1',
      type: 'follow',
      title: 'متابع جديد',
      message: 'football_fan_1 بدأ متابعتك',
      timestamp: '2024-01-15T10:30:00Z',
      read: false,
      priority: 'medium',
      fromUser: {
        id: 'f1',
        username: 'football_fan_1',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=50&h=50&fit=crop&crop=face'
      }
    },
    {
      id: 'n2',
      type: 'like',
      title: 'إعجاب جديد',
      message: 'sports_analyst أعجب بفيديوك "تحليل مباراة ريال مدريد"',
      timestamp: '2024-01-15T09:15:00Z',
      read: true,
      priority: 'low',
      fromUser: {
        id: 'f2',
        username: 'sports_analyst',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=50&h=50&fit=crop&crop=face'
      }
    }
  ],
  isOwner: true,
  isVerified: true,
  isAppOwner: true,
  isFollowing: false,
  isFollowed: true,
  isVip: true,
  isExpert: true,
  isInfluencer: true,
  isVerifiedCoach: true
};

// Dashboard Stats Mock Data
export const mockDashboardStats: DashboardStats = {
  views: {
    total: 125000,
    thisWeek: 8500,
    thisMonth: 35000,
    trend: 'up'
  },
  likes: {
    total: 8500,
    thisWeek: 650,
    thisMonth: 2800,
    trend: 'up'
  },
  questionsSolved: {
    total: 250,
    thisWeek: 18,
    thisMonth: 75,
    trend: 'up'
  },
  rating: {
    average: 4.8,
    totalRatings: 1200,
    trend: 'up'
  },
  posts: {
    total: 45,
    thisWeek: 3,
    thisMonth: 12,
    trend: 'up'
  },
  predictions: {
    total: 180,
    accuracy: 78,
    thisWeek: 12,
    trend: 'up'
  },
  interactions: {
    total: 12000,
    thisWeek: 850,
    thisMonth: 4200,
    trend: 'up'
  },
  level: {
    current: 15,
    experience: 7500,
    nextLevel: 10000,
    progress: 75
  }
};

// Additional Diamond Profiles
export const diamondProfiles: DiamondProfile[] = [
  mockDiamondProfile,
  {
    id: 'diamond-user-2',
    username: 'football_expert',
    displayName: 'خبير كرة القدم',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=200&fit=crop',
    weight: 80,
    height: 185,
    age: 30,
    strongFoot: 'left',
    position: 'وسط',
    favoriteClub: {
      name: 'برشلونة',
      logo: 'https://logos-world.net/wp-content/uploads/2020/06/Barcelona-Logo.png',
      country: 'إسبانيا'
    },
    bio: 'محلل رياضي محترف مع خبرة 10 سنوات في عالم كرة القدم. متخصص في تحليل التكتيكات والاستراتيجيات.',
    stats: {
      views: 98000,
      likes: 7200,
      questionsSolved: 180,
      rating: 4.7,
      posts: 38,
      predictions: 150,
      interactions: 9500,
      level: 12
    },
    videos: [
      {
        id: '6',
        title: 'تحليل تكتيكات برشلونة',
        thumbnail: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=225&fit=crop',
        duration: '8:15',
        views: 12000,
        likes: 750,
        uploadDate: '2024-01-14'
      },
      {
        id: '7',
        title: 'أفضل لاعبي الوسط في العالم',
        thumbnail: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=225&fit=crop',
        duration: '6:30',
        views: 9500,
        likes: 580,
        uploadDate: '2024-01-11'
      }
    ],
    isOwner: false
  },
  {
    id: 'diamond-user-3',
    username: 'sports_analyst',
    displayName: 'محلل رياضي',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    coverImage: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=200&fit=crop',
    weight: 70,
    height: 175,
    age: 28,
    strongFoot: 'right',
    position: 'مدافع',
    favoriteClub: {
      name: 'مانشستر سيتي',
      logo: 'https://logos-world.net/wp-content/uploads/2020/06/Manchester-City-Logo.png',
      country: 'إنجلترا'
    },
    bio: 'محلل رياضي متخصص في الدوري الإنجليزي والبطولات الأوروبية. خبرة واسعة في تحليل الأداء والإحصائيات.',
    stats: {
      views: 156000,
      likes: 9800,
      questionsSolved: 320,
      rating: 4.9,
      posts: 52,
      predictions: 220,
      interactions: 15000,
      level: 18
    },
    videos: [
      {
        id: '8',
        title: 'تحليل أداء مانشستر سيتي هذا الموسم',
        thumbnail: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=225&fit=crop',
        duration: '7:45',
        views: 18000,
        likes: 1200,
        uploadDate: '2024-01-13'
      },
      {
        id: '9',
        title: 'أفضل المدافعين في الدوري الإنجليزي',
        thumbnail: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=400&h=225&fit=crop',
        duration: '5:20',
        views: 14000,
        likes: 890,
        uploadDate: '2024-01-09'
      }
    ],
    isOwner: false
  }
];

// Helper functions
export const getDiamondProfileById = (id: string): DiamondProfile | undefined => {
  return diamondProfiles.find(profile => profile.id === id);
};

export const getDiamondProfilesByLevel = (minLevel: number): DiamondProfile[] => {
  return diamondProfiles.filter(profile => profile.stats.level >= minLevel);
};

export const searchDiamondProfiles = (query: string): DiamondProfile[] => {
  const lowercaseQuery = query.toLowerCase();
  return diamondProfiles.filter(profile => 
    profile.displayName.toLowerCase().includes(lowercaseQuery) ||
    profile.username.toLowerCase().includes(lowercaseQuery) ||
    profile.position.toLowerCase().includes(lowercaseQuery) ||
    profile.favoriteClub.name.toLowerCase().includes(lowercaseQuery)
  );
};

export const getPopularDiamondProfiles = (limit: number = 5): DiamondProfile[] => {
  return diamondProfiles
    .sort((a, b) => b.stats.views - a.stats.views)
    .slice(0, limit);
};

export const getDiamondProfilesByClub = (clubName: string): DiamondProfile[] => {
  return diamondProfiles.filter(profile => 
    profile.favoriteClub.name.toLowerCase().includes(clubName.toLowerCase())
  );
};

export const getDiamondProfilesByPosition = (position: string): DiamondProfile[] => {
  return diamondProfiles.filter(profile => 
    profile.position.toLowerCase().includes(position.toLowerCase())
  );
};

// Video helper functions
export const getVideosByProfile = (profileId: string): VideoItem[] => {
  const profile = getDiamondProfileById(profileId);
  return profile?.videos || [];
};

export const getPopularVideos = (limit: number = 10): VideoItem[] => {
  const allVideos = diamondProfiles.flatMap(profile => profile.videos);
  return allVideos
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
};

export const getRecentVideos = (limit: number = 10): VideoItem[] => {
  const allVideos = diamondProfiles.flatMap(profile => profile.videos);
  return allVideos
    .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
    .slice(0, limit);
};

export const searchVideos = (query: string): VideoItem[] => {
  const lowercaseQuery = query.toLowerCase();
  const allVideos = diamondProfiles.flatMap(profile => profile.videos);
  return allVideos.filter(video => 
    video.title.toLowerCase().includes(lowercaseQuery)
  );
};
