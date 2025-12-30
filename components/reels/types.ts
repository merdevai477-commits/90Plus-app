export interface User {
    id: string;
    name: string;
    username: string;
    avatar: string;
    verified: boolean;
    followers?: number;
    isFollowing?: boolean;
}

export interface Comment {
    id: string;
    user: User;
    text: string;
    likes: number;
    liked: boolean;
    replies: number;
    timeAgo: string;
    createdAt: Date;
}

export interface ReelData {
    id: string;
    user: User;
    videoUrl: string;
    thumbnail: string;
    duration: number;
    likes: number;
    views: number;
    comments: number;
    shares: number;
    liked: boolean;
    saved: boolean;
    muted: boolean;
    description?: string;
    hashtags?: string[];
    mentions?: string[];
    location?: string;
    createdAt: Date;
}
