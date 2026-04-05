import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/clerk-expo';

// Helper function to get storage keys with user ID
const getStorageKeys = (userId: string | null | undefined) => {
    const suffix = userId ? `_${userId}` : '';
    return {
        UPLOADED_VIDEOS: `@videos_uploaded${suffix}`,
        USER_VIDEO_DATA: `@videos_user_data${suffix}`,
        REEL_COMMENTS: `@videos_comments${suffix}`,
        LIKED_REELS: `@videos_liked${suffix}`,
    };
};

export interface UploadedVideo {
    id: string;
    uri: string;
    thumbnail?: string;
    createdAt: Date;
    isUploading?: boolean;
    uploadProgress?: number;
}

export interface Comment {
    id: string;
    user: {
        id: string;
        name: string;
        avatar?: string;
        verified?: boolean;
    };
    text: string;
    timestamp: string;
    likes: number;
    liked: boolean;
}

interface UserVideoData {
    username: string;
    avatar: string | null;
    displayName: string;
}

interface VideosContextType {
    uploadedVideos: UploadedVideo[];
    addVideo: (video: UploadedVideo) => void;
    removeVideo: (videoId: string) => void;
    clearVideos: () => void;
    userVideoData: UserVideoData | null;
    setUserVideoData: (data: UserVideoData) => void;
    reelComments: Record<string, Comment[]>;
    addComment: (reelId: string, comment: Comment) => void;
    toggleCommentLike: (reelId: string, commentId: string) => void;
    likedReelIds: string[];
    toggleReelLike: (reelId: string) => void;
    isLoaded: boolean;
}

const VideosContext = createContext<VideosContextType | undefined>(undefined);

export function VideosProvider({ children }: { children: ReactNode }) {
    const { userId } = useAuth();
    const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>([]);
    const [userVideoData, setUserVideoDataState] = useState<UserVideoData | null>(null);
    const [reelComments, setReelComments] = useState<Record<string, Comment[]>>({});
    const [likedReelIds, setLikedReelIds] = useState<string[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Get storage keys based on current user ID
    const storageKeys = useMemo(() => getStorageKeys(userId), [userId]);
    
    // Track previous userId to clear old user's storage
    const prevUserIdRef = React.useRef<string | null | undefined>(userId);

    // Load data from AsyncStorage on mount or when user changes
    useEffect(() => {
        const prevUserId = prevUserIdRef.current;
        
        // If userId changed (not just initial load), clear old user's storage
        if (prevUserId && prevUserId !== userId && userId) {
            const oldStorageKeys = getStorageKeys(prevUserId);
            Promise.all([
                AsyncStorage.removeItem(oldStorageKeys.UPLOADED_VIDEOS),
                AsyncStorage.removeItem(oldStorageKeys.USER_VIDEO_DATA),
                AsyncStorage.removeItem(oldStorageKeys.REEL_COMMENTS),
                AsyncStorage.removeItem(oldStorageKeys.LIKED_REELS),
            ]).catch(error => {
                console.error('Error clearing old user storage:', error);
            });
        }
        
        // Update ref
        prevUserIdRef.current = userId;
        
        if (userId) {
            loadStoredData();
        } else {
            // Clear data if user logs out
            clearAllData();
        }
    }, [userId]);

    const loadStoredData = async () => {
        if (!userId) return;
        
        try {
            const [videosJson, userDataJson, commentsJson, likedJson] = await Promise.all([
                AsyncStorage.getItem(storageKeys.UPLOADED_VIDEOS),
                AsyncStorage.getItem(storageKeys.USER_VIDEO_DATA),
                AsyncStorage.getItem(storageKeys.REEL_COMMENTS),
                AsyncStorage.getItem(storageKeys.LIKED_REELS),
            ]);

            if (videosJson) {
                const videos = JSON.parse(videosJson);
                // Convert createdAt strings back to Date objects
                setUploadedVideos(videos.map((v: any) => ({
                    ...v,
                    createdAt: new Date(v.createdAt)
                })));
            }
            if (userDataJson) setUserVideoDataState(JSON.parse(userDataJson));
            if (commentsJson) setReelComments(JSON.parse(commentsJson));
            if (likedJson) setLikedReelIds(JSON.parse(likedJson));
        } catch (error) {
            console.error('Error loading videos data:', error);
        } finally {
            setIsLoaded(true);
        }
    };

    const clearAllData = async () => {
        // Clear state
        setUploadedVideos([]);
        setUserVideoDataState(null);
        setReelComments({});
        setLikedReelIds([]);
        setIsLoaded(true);
        
        // Clear AsyncStorage for current user's keys (if userId exists)
        if (userId) {
            try {
                const keysToClear = getStorageKeys(userId);
                await Promise.all([
                    AsyncStorage.removeItem(keysToClear.UPLOADED_VIDEOS),
                    AsyncStorage.removeItem(keysToClear.USER_VIDEO_DATA),
                    AsyncStorage.removeItem(keysToClear.REEL_COMMENTS),
                    AsyncStorage.removeItem(keysToClear.LIKED_REELS),
                ]);
            } catch (error) {
                console.error('Error clearing VideosContext storage:', error);
            }
        }
    };

    // Save videos to AsyncStorage
    const saveVideos = async (videos: UploadedVideo[]) => {
        if (!userId) return;
        try {
            await AsyncStorage.setItem(storageKeys.UPLOADED_VIDEOS, JSON.stringify(videos));
        } catch (error) {
            console.error('Error saving videos:', error);
        }
    };

    // Save user data to AsyncStorage
    const saveUserData = async (data: UserVideoData | null) => {
        if (!userId) return;
        try {
            if (data) {
                await AsyncStorage.setItem(storageKeys.USER_VIDEO_DATA, JSON.stringify(data));
            } else {
                await AsyncStorage.removeItem(storageKeys.USER_VIDEO_DATA);
            }
        } catch (error) {
            console.error('Error saving user data:', error);
        }
    };

    // Save comments to AsyncStorage
    const saveComments = async (comments: Record<string, Comment[]>) => {
        if (!userId) return;
        try {
            await AsyncStorage.setItem(storageKeys.REEL_COMMENTS, JSON.stringify(comments));
        } catch (error) {
            console.error('Error saving comments:', error);
        }
    };

    // Save liked reels to AsyncStorage
    const saveLikedReels = async (liked: string[]) => {
        if (!userId) return;
        try {
            await AsyncStorage.setItem(storageKeys.LIKED_REELS, JSON.stringify(liked));
        } catch (error) {
            console.error('Error saving liked reels:', error);
        }
    };

    const addVideo = (video: UploadedVideo) => {
        setUploadedVideos(prev => {
            // If video already exists, update it in place (for progress updates)
            const existingIndex = prev.findIndex(v => v.id === video.id);
            if (existingIndex !== -1) {
                const newVideos = [...prev];
                newVideos[existingIndex] = video;
                saveVideos(newVideos);
                return newVideos;
            }
            const newVideos = [video, ...prev];
            saveVideos(newVideos);
            return newVideos;
        });
    };

    const removeVideo = (videoId: string) => {
        setUploadedVideos(prev => {
            const newVideos = prev.filter(v => v.id !== videoId);
            saveVideos(newVideos);
            return newVideos;
        });
    };

    const clearVideos = async () => {
        setUploadedVideos([]);
        setUserVideoDataState(null);
        setReelComments({});
        setLikedReelIds([]);
        if (userId) {
            try {
                await Promise.all([
                    AsyncStorage.removeItem(storageKeys.UPLOADED_VIDEOS),
                    AsyncStorage.removeItem(storageKeys.USER_VIDEO_DATA),
                    AsyncStorage.removeItem(storageKeys.REEL_COMMENTS),
                    AsyncStorage.removeItem(storageKeys.LIKED_REELS),
                ]);
            } catch (error) {
                console.error('Error clearing videos data:', error);
            }
        }
    };

    const setUserVideoData = (data: UserVideoData) => {
        setUserVideoDataState(data);
        saveUserData(data);
    };

    const addComment = (reelId: string, comment: Comment) => {
        setReelComments(prev => {
            const newComments = {
                ...prev,
                [reelId]: [...(prev[reelId] || []), comment]
            };
            saveComments(newComments);
            return newComments;
        });
    };

    const toggleCommentLike = (reelId: string, commentId: string) => {
        setReelComments(prev => {
            const newComments = {
                ...prev,
                [reelId]: (prev[reelId] || []).map(comment =>
                    comment.id === commentId
                        ? {
                            ...comment,
                            liked: !comment.liked,
                            likes: comment.liked ? comment.likes - 1 : comment.likes + 1
                        }
                        : comment
                )
            };
            saveComments(newComments);
            return newComments;
        });
    };

    const toggleReelLike = (reelId: string) => {
        setLikedReelIds(prev => {
            const newLiked = prev.includes(reelId)
                ? prev.filter(id => id !== reelId)
                : [...prev, reelId];
            saveLikedReels(newLiked);
            return newLiked;
        });
    };

    return (
        <VideosContext.Provider
            value={{
                uploadedVideos,
                addVideo,
                removeVideo,
                clearVideos,
                userVideoData,
                setUserVideoData,
                reelComments,
                addComment,
                toggleCommentLike,
                likedReelIds,
                toggleReelLike,
                isLoaded,
            }}
        >
            {children}
        </VideosContext.Provider>
    );
}

export function useVideos() {
    const context = useContext(VideosContext);
    if (context === undefined) {
        throw new Error('useVideos must be used within a VideosProvider');
    }
    return context;
}
