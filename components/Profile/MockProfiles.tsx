import { UserProfile } from './FifaCard';

// البروفايل الماسي - M.Essam (مالك التطبيق)
export const diamondProfile: UserProfile = {
  id: 'diamond-user',
  username: 'M.Essam',
  displayName: 'محمد عصام',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  weight: 70,
  height: 171,
  strongFoot: 'right',
  position: 'RB',
  favoriteClub: {
    name: 'الأهلي',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/9/9e/Al_Ahly_SC_logo.png',
    country: 'مصر'
  },
  cardType: 'diamond',
  isVerified: true,
  followers: 125000,
  bio: 'مطور ومؤسس تطبيق كرة القدم الأول في المنطقة العربية 🚀⚽\n\nمؤسس شركة Football Tech\nخبير في تطوير التطبيقات الرياضية\nعاشق كرة القدم منذ الطفولة',
  stats: {
    predictions: 1250,
    questions: 89,
    interactions: 15600,
    level: 25
  },
  isOwner: true
};

// البروفايل الذهبي
export const goldProfile: UserProfile = {
  id: 'gold-user-1',
  username: 'Ahmed_Football',
  displayName: 'أحمد الكرة',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  weight: 75,
  height: 175,
  strongFoot: 'left',
  position: 'LW',
  favoriteClub: {
    name: 'ريال مدريد',
    logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
    country: 'إسبانيا'
  },
  cardType: 'gold',
  isVerified: true,
  followers: 45000,
  bio: 'لاعب كرة قدم محترف سابق ⚽\n\nخبير في التحليل التكتيكي\nمعلق رياضي في القنوات الرياضية\nمدرب معتمد من الاتحاد الدولي',
  stats: {
    predictions: 890,
    questions: 156,
    interactions: 8900,
    level: 18
  }
};

export const goldProfile2: UserProfile = {
  id: 'gold-user-2',
  username: 'Sara_Sports',
  displayName: 'سارة الرياضة',
  avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
  weight: 65,
  height: 168,
  strongFoot: 'right',
  position: 'CM',
  favoriteClub: {
    name: 'برشلونة',
    logo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
    country: 'إسبانيا'
  },
  cardType: 'gold',
  isVerified: true,
  followers: 32000,
  bio: 'صحفية رياضية متخصصة 📰⚽\n\nمراسلة في كبرى القنوات الرياضية\nخبيرة في كرة القدم النسائية\nمؤلفة كتاب "تاريخ كرة القدم العربية"',
  stats: {
    predictions: 750,
    questions: 203,
    interactions: 6700,
    level: 16
  }
};

// البروفايل الفضي
export const silverProfile: UserProfile = {
  id: 'silver-user-1',
  username: 'Omar_Coach',
  displayName: 'عمر المدرب',
  avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
  weight: 80,
  height: 180,
  strongFoot: 'right',
  position: 'CB',
  favoriteClub: {
    name: 'الهلال',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/1/1b/Al_Hilal_FC_logo.png',
    country: 'السعودية'
  },
  cardType: 'silver',
  isVerified: false,
  followers: 18000,
  bio: 'مدرب كرة قدم معتمد 🏆\n\nمدرب فريق الشباب في النادي الأهلي\nحاصل على شهادة تدريب من الاتحاد المصري\nمتخصص في تطوير المواهب الشابة',
  stats: {
    predictions: 450,
    questions: 78,
    interactions: 3200,
    level: 12
  }
};

export const silverProfile2: UserProfile = {
  id: 'silver-user-2',
  username: 'Fatma_Analyst',
  displayName: 'فاطمة المحللة',
  avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
  weight: 62,
  height: 165,
  strongFoot: 'left',
  position: 'CAM',
  favoriteClub: {
    name: 'مانشستر سيتي',
    logo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
    country: 'إنجلترا'
  },
  cardType: 'silver',
  isVerified: false,
  followers: 12000,
  bio: 'محللة رياضية متخصصة 📊⚽\n\nخبيرة في الإحصائيات الرياضية\nمؤسسة قناة "التحليل الرياضي" على يوتيوب\nحاصلة على ماجستير في الإدارة الرياضية',
  stats: {
    predictions: 380,
    questions: 95,
    interactions: 2800,
    level: 10
  }
};

// البروفايل البرونزي
export const bronzeProfile: UserProfile = {
  id: 'bronze-user-1',
  username: 'Hassan_Player',
  displayName: 'حسن اللاعب',
  avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
  weight: 72,
  height: 173,
  strongFoot: 'right',
  position: 'ST',
  favoriteClub: {
    name: 'الزمالك',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/4/4a/Zamalek_SC_logo.png',
    country: 'مصر'
  },
  cardType: 'bronze',
  isVerified: false,
  followers: 8500,
  bio: 'لاعب كرة قدم في الدوري المصري ⚽\n\nلاعب في فريق النادي الأهلي للشباب\nحاصل على بكالوريوس التربية الرياضية\nأحلم باللعب في أوروبا',
  stats: {
    predictions: 280,
    questions: 45,
    interactions: 1500,
    level: 8
  }
};

export const bronzeProfile2: UserProfile = {
  id: 'bronze-user-2',
  username: 'Nour_Fan',
  displayName: 'نور المشجعة',
  avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
  weight: 58,
  height: 162,
  strongFoot: 'left',
  position: 'LM',
  favoriteClub: {
    name: 'ليفربول',
    logo: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
    country: 'إنجلترا'
  },
  cardType: 'bronze',
  isVerified: false,
  followers: 6200,
  bio: 'مشجعة كرة قدم متحمسة 🔥⚽\n\nعضو في مجموعة مشجعي ليفربول في مصر\nمنشئة محتوى رياضي على وسائل التواصل\nأتابع جميع الدوريات الأوروبية',
  stats: {
    predictions: 190,
    questions: 32,
    interactions: 980,
    level: 6
  }
};

export const bronzeProfile3: UserProfile = {
  id: 'bronze-user-3',
  username: 'Youssef_Referee',
  displayName: 'يوسف الحكم',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
  weight: 78,
  height: 182,
  strongFoot: 'right',
  position: 'GK',
  favoriteClub: {
    name: 'بايرن ميونخ',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',
    country: 'ألمانيا'
  },
  cardType: 'bronze',
  isVerified: false,
  followers: 4200,
  bio: 'حكم كرة قدم معتمد ⚽👨‍⚖️\n\nحكم في الدوري المصري الممتاز\nحاصل على شهادة حكم من الاتحاد المصري\nأحلم بالحكم في كأس العالم',
  stats: {
    predictions: 150,
    questions: 28,
    interactions: 750,
    level: 5
  }
};

// جميع البروفايلات
export const allProfiles: UserProfile[] = [
  diamondProfile,
  goldProfile,
  goldProfile2,
  silverProfile,
  silverProfile2,
  bronzeProfile,
  bronzeProfile2,
  bronzeProfile3
];

// البروفايلات حسب النوع
export const profilesByType = {
  diamond: [diamondProfile],
  gold: [goldProfile, goldProfile2],
  silver: [silverProfile, silverProfile2],
  bronze: [bronzeProfile, bronzeProfile2, bronzeProfile3]
};

// البحث في البروفايلات
export const searchProfiles = (query: string): UserProfile[] => {
  const lowercaseQuery = query.toLowerCase();
  return allProfiles.filter(profile => 
    profile.username.toLowerCase().includes(lowercaseQuery) ||
    profile.displayName.toLowerCase().includes(lowercaseQuery) ||
    profile.favoriteClub.name.toLowerCase().includes(lowercaseQuery) ||
    profile.position.toLowerCase().includes(lowercaseQuery)
  );
};

// الحصول على البروفايلات الشائعة
export const getPopularProfiles = (): UserProfile[] => {
  return allProfiles
    .filter(profile => profile.followers > 10000)
    .sort((a, b) => b.followers - a.followers);
};

// الحصول على البروفايلات حسب المستوى
export const getProfilesByLevel = (minLevel: number): UserProfile[] => {
  return allProfiles
    .filter(profile => profile.stats.level >= minLevel)
    .sort((a, b) => b.stats.level - a.stats.level);
};

// بيانات الفيديوهات المرتبطة بالبروفايلات
export const mockVideos = {
  'diamond-user': [
    {
      id: 'diamond-video-1',
      thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=600&fit=crop',
      title: 'هدف رائع في المباراة النهائية! 🔥⚽',
      views: 125000,
      likes: 12500,
      duration: '0:30',
      uploadDate: '2024-01-15',
      isPrivate: false,
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      hashtags: ['كرة_القدم', 'أهداف', 'رياضة'],
      location: 'ستاد القاهرة',
      comments: 1200,
      shares: 450
    }
  ],
  'gold-user-1': [
    {
      id: 'gold-video-1',
      thumbnail: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=400&h=600&fit=crop',
      title: 'تمرين اليوم كان قوي! 💪',
      views: 89000,
      likes: 8900,
      duration: '0:25',
      uploadDate: '2024-01-14',
      isPrivate: false,
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      hashtags: ['لياقة', 'صحة', 'تمارين'],
      location: 'نادي الجزيرة',
      comments: 456,
      shares: 123
    }
  ],
  'gold-user-2': [
    {
      id: 'gold-video-2',
      thumbnail: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=600&fit=crop',
      title: 'لحظات لا تُنسى من البطولة 🏆',
      views: 156000,
      likes: 15600,
      duration: '0:28',
      uploadDate: '2024-01-13',
      isPrivate: true,
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      hashtags: ['بطولة', 'فوز', 'احتفال'],
      location: 'ملعب برشلونة',
      comments: 1200,
      shares: 567
    }
  ]
};
