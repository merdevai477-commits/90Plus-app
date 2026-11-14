import { randomUUID } from 'crypto';
import prisma from '../lib/prisma';
import { getRedisClient } from '../lib/redis';
import { logger } from '../utils/logger';
import { PushNotificationService } from './push-notification.service';

const REDIS_KEY = 'app:update-notice';

export type AppUpdateNotice = {
    id: string;
    title: string;
    message: string;
    active: boolean;
    sentAt: string;
    devices: number;
};

let memoryNotice: AppUpdateNotice | null = null;

function parseNotice(raw: string | null): AppUpdateNotice | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as AppUpdateNotice;
        if (!parsed?.id || !parsed.message) return null;
        return parsed;
    } catch {
        return null;
    }
}

export async function getAppUpdateNotice(): Promise<AppUpdateNotice | null> {
    const redis = getRedisClient();
    if (redis) {
        try {
            const stored = parseNotice(await redis.get(REDIS_KEY));
            if (stored) {
                memoryNotice = stored;
                return stored.active ? stored : null;
            }
        } catch (err) {
            logger.warn('[AppUpdateNotice] Redis read failed:', err);
        }
    }
    return memoryNotice?.active ? memoryNotice : null;
}

async function saveNotice(notice: AppUpdateNotice): Promise<void> {
    memoryNotice = notice;
    const redis = getRedisClient();
    if (!redis) return;
    try {
        await redis.set(REDIS_KEY, JSON.stringify(notice));
    } catch (err) {
        logger.warn('[AppUpdateNotice] Redis write failed:', err);
    }
}

async function listPushTokens(): Promise<string[]> {
    const [devices, users] = await Promise.all([
        prisma.userPushDevice.findMany({ select: { token: true } }),
        prisma.user.findMany({
            where: { isDeleted: false, expoPushToken: { not: null } },
            select: { expoPushToken: true },
        }),
    ]);
    const tokens = new Set<string>();
    for (const row of devices) {
        if (row.token) tokens.add(row.token);
    }
    for (const row of users) {
        if (row.expoPushToken) tokens.add(row.expoPushToken);
    }
    return [...tokens];
}

async function pushNotice(notice: AppUpdateNotice): Promise<number> {
    const tokens = await listPushTokens();
    if (!tokens.length) return 0;
    const payloads = tokens.map((to) => ({
        to,
        title: notice.title,
        body: notice.message,
        channelId: 'general-v2',
        data: {
            type: 'APP_UPDATE',
            noticeId: notice.id,
        },
    }));
    const chunkSize = 100;
    let sent = 0;
    for (let i = 0; i < payloads.length; i += chunkSize) {
        const slice = payloads.slice(i, i + chunkSize);
        const result = await PushNotificationService.sendBulkNotifications(slice);
        sent += result.success;
    }
    return sent;
}

export async function publishAppUpdateNotice(message: string): Promise<AppUpdateNotice> {
    const notice: AppUpdateNotice = {
        id: randomUUID(),
        title: 'تحديث متاح',
        message: message.trim(),
        active: true,
        sentAt: new Date().toISOString(),
        devices: 0,
    };
    await saveNotice(notice);
    void pushNotice(notice)
        .then(async (devices) => {
            notice.devices = devices;
            await saveNotice(notice);
            logger.info('[AppUpdateNotice] Push finished', { id: notice.id, devices });
        })
        .catch((err) => logger.error('[AppUpdateNotice] Push failed:', err));
    return notice;
}

export async function clearAppUpdateNotice(): Promise<void> {
    const current = memoryNotice || (await getAppUpdateNotice());
    if (!current) {
        memoryNotice = null;
        const redis = getRedisClient();
        if (redis) await redis.del(REDIS_KEY).catch(() => undefined);
        return;
    }
    await saveNotice({ ...current, active: false });
}
