import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LeagueSummary, TeamSummary } from '../../services/sportmonks';

type FollowedTeam = TeamSummary & {
  followedAt: string;
  notificationsEnabled: boolean;
};

type SportmonksPreferences = {
  lastSelectedTeamId?: number;
  lastSelectedLeagueId?: number;
  lastStatusFilter: 'live' | 'upcoming' | 'finished';
};

interface SportmonksStore {
  followedTeams: Record<number, FollowedTeam>;
  preferences: SportmonksPreferences;
  toggleFollow: (team: TeamSummary) => void;
  isFollowing: (teamId: number) => boolean;
  enableNotifications: (teamId: number, enabled: boolean) => void;
  setPreferences: (prefs: Partial<SportmonksPreferences>) => void;
  reset: () => void;
}

const initialPreferences: SportmonksPreferences = {
  lastStatusFilter: 'live',
};

export const useSportmonksStore = create<SportmonksStore>()(
  persist(
    (set, get) => ({
      followedTeams: {},
      preferences: initialPreferences,

      toggleFollow: (team) => {
        set((state) => {
          const isFollowing = Boolean(state.followedTeams[team.id]);
          if (isFollowing) {
            const updated = { ...state.followedTeams };
            delete updated[team.id];
            return { followedTeams: updated };
          }

          return {
            followedTeams: {
              ...state.followedTeams,
              [team.id]: {
                ...team,
                followedAt: new Date().toISOString(),
                notificationsEnabled: true,
              },
            },
          };
        });
      },

      isFollowing: (teamId) => Boolean(get().followedTeams[teamId]),

      enableNotifications: (teamId, enabled) => {
        set((state) => {
          if (!state.followedTeams[teamId]) return state;
          return {
            followedTeams: {
              ...state.followedTeams,
              [teamId]: {
                ...state.followedTeams[teamId],
                notificationsEnabled: enabled,
              },
            },
          };
        });
      },

      setPreferences: (prefs) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...prefs,
          },
        }));
      },

      reset: () => set({ followedTeams: {}, preferences: initialPreferences }),
    }),
    {
      name: 'sportmonks-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        followedTeams: state.followedTeams,
        preferences: state.preferences,
      }),
    },
  ),
);
