/**
 * chatStorageService.ts
 *
 * Thin AsyncStorage wrapper used by useAIChatNative.
 * Provides a stable userId (UUID) per device and persists the last
 * active conversation id so the chat screen reopens where the user left off.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../constants/theme';

const USER_ID_KEY = API_CONFIG.userIdKey;          // 'ai-chat-user-id'
const LAST_CONV_KEY = 'ai-chat-last-conversation-id';
const SESSION_CACHE_KEY = '@chat_session_cache_v1';
const SESSION_CACHE_TTL_MS = 30 * 60 * 1000;

export interface CachedChatMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
    time: string;
}

export interface ChatSessionCache {
    conversationId: string;
    messages: CachedChatMessage[];
    cachedAt: number;
}

/** Generate a simple UUID-v4 without external deps. */
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export const Storage = {
    /**
     * Returns the device-local userId. Creates and persists one on first call.
     */
    async getUserId(): Promise<string> {
        try {
            const stored = await AsyncStorage.getItem(USER_ID_KEY);
            if (stored) return stored;
            const id = generateUUID();
            await AsyncStorage.setItem(USER_ID_KEY, id);
            return id;
        } catch {
            // Fallback: return a session-only id so the app doesn't crash.
            return generateUUID();
        }
    },

    async saveLastConversationId(id: string): Promise<void> {
        try {
            await AsyncStorage.setItem(LAST_CONV_KEY, id);
        } catch {
            // non-fatal
        }
    },

    async getLastConversationId(): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(LAST_CONV_KEY);
        } catch {
            return null;
        }
    },

    async clearLastConversationId(): Promise<void> {
        try {
            await AsyncStorage.removeItem(LAST_CONV_KEY);
        } catch {
            // non-fatal
        }
    },

    async saveSessionCache(entry: ChatSessionCache): Promise<void> {
        try {
            await AsyncStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(entry));
        } catch {
            // non-fatal
        }
    },

    async loadSessionCache(): Promise<ChatSessionCache | null> {
        try {
            const raw = await AsyncStorage.getItem(SESSION_CACHE_KEY);
            if (!raw) return null;
            const entry = JSON.parse(raw) as ChatSessionCache;
            if (!entry?.conversationId || !Array.isArray(entry.messages)) return null;
            if (Date.now() - entry.cachedAt > SESSION_CACHE_TTL_MS) {
                await AsyncStorage.removeItem(SESSION_CACHE_KEY);
                return null;
            }
            return entry;
        } catch {
            return null;
        }
    },

    async clearSessionCache(): Promise<void> {
        try {
            await AsyncStorage.removeItem(SESSION_CACHE_KEY);
        } catch {
            // non-fatal
        }
    },
};

export default Storage;
