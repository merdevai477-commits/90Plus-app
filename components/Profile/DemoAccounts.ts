import { DiamondProfile } from './DiamondCard';
import { UserProfile, } from './FifaCard';
import { mockDiamondProfile } from './DiamondMockData';

// Basic demo non-diamond profiles compatible with UserProfile
export const demoUserProfiles: UserProfile[] = [
  {
    id: 'gold-1',
    username: 'gold_player',
    displayName: 'Gold Player',
    avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&h=150&fit=crop&crop=faces',
    weight: 78,
    height: 182,
    strongFoot: 'right',
    position: 'LW',
    favoriteClub: {
      name: 'Liverpool',
      logo: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
      country: 'England',
    },
    cardType: 'gold',
    isVerified: true,
    followers: 54000,
    bio: 'لاعب ذهبي ومحب للتحليل.',
    stats: { predictions: 210, questions: 45, interactions: 5400, level: 12 },
  },
  {
    id: 'silver-1',
    username: 'silver_player',
    displayName: 'Silver Player',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=faces',
    weight: 70,
    height: 176,
    strongFoot: 'left',
    position: 'CM',
    favoriteClub: {
      name: 'Barcelona',
      logo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
      country: 'Spain',
    },
    cardType: 'silver',
    isVerified: false,
    followers: 12000,
    bio: 'لاعب فضي محب للتكتيك.',
    stats: { predictions: 120, questions: 30, interactions: 2100, level: 8 },
  },
];

// Adapter to convert DiamondProfile to UserProfile for demo browsing
export const adaptDiamondToUserProfile = (p: DiamondProfile): UserProfile => ({
  id: p.id,
  username: p.username,
  displayName: p.displayName,
  avatar: p.avatar,
  weight: p.weight,
  height: p.height,
  strongFoot: p.strongFoot,
  position: p.position,
  favoriteClub: p.favoriteClub,
  cardType: 'diamond',
  isVerified: !!p.isVerified,
  followers: (p.stats as any)?.followers ?? 0,
  bio: p.bio,
  stats: {
    predictions: p.stats.predictions ?? 0,
    questions: (p.stats as any)?.questions ?? p.stats.questionsSolved ?? 0,
    interactions: p.stats.interactions ?? 0,
    level: p.stats.level ?? 0,
  },
  isOwner: p.isAppOwner || p.isOwner,
});

export const demoDiamondAsUser: UserProfile = adaptDiamondToUserProfile(mockDiamondProfile);

export const demoAccounts: UserProfile[] = [demoDiamondAsUser, ...demoUserProfiles];


