import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FollowStore {
  followedUserIds: Record<string, boolean>; // Use Record instead of Set for easier persistence
  follow: (userId: string) => void;
  unfollow: (userId: string) => void;
  isFollowing: (userId: string) => boolean;
  clear: () => void;
}

export const useFollowStore = create<FollowStore>()(
  persist(
    (set, get) => ({
      followedUserIds: {},

      follow: (userId: string) => {
        set((state) => ({
          followedUserIds: {
            ...state.followedUserIds,
            [userId]: true,
          },
        }));
      },

      unfollow: (userId: string) => {
        set((state) => {
          const updated = { ...state.followedUserIds };
          delete updated[userId];
          return { followedUserIds: updated };
        });
      },

      isFollowing: (userId: string) => {
        return Boolean(get().followedUserIds[userId]);
      },

      clear: () => {
        set({ followedUserIds: {} });
      },
    }),
    {
      name: 'follow-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

