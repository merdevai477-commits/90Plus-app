// User Profile Types
export interface DiamondProfile {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    coverImage?: string;
    bio?: string;
    clubLogo?: string;
    favoriteTeam?: string;
    brandLogo?: string;
    position?: string;
    countryFlag?: string;
    country?: string;
    age?: number;
    height?: number;
    weight?: number;
    preferredFoot?: string;
    stats: {
        views: number;
        likes: number;
        questionsSolved: number;
        rating: number;
        posts: number;
        predictions: number;
        interactions: number;
        level: number;
        followers: number;
        following: number;
        monthlyViews: number;
        yearlyViews: number;
        engagementRate: number;
        contentQuality: number;
    };
    videos: any[];
    badges: any[];
    achievements: any[];
    socialStats: {
        followers: any[];
        following: any[];
    };
    notifications: any[];
    isOwner: boolean;
    isVerified: boolean;
    isAppOwner: boolean;
}
