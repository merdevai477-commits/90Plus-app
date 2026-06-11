import { logger } from './logger';

/**
 * Expo push ticket/receipt error codes (FCM + APNs via Expo).
 * @see https://docs.expo.dev/push-notifications/sending-notifications/#push-receipts
 */
export const EXPO_PUSH_ERROR_CODES = [
    'DeviceNotRegistered',
    'InvalidCredentials',
    'MismatchSenderId',
    'MessageTooBig',
    'InvalidProviderToken',
    'MessageRateExceeded',
    'InvalidRegistration',
] as const;

export type ExpoPushErrorCode =
    | (typeof EXPO_PUSH_ERROR_CODES)[number]
    | 'Unknown';

type ExpoTicketLike = {
    status: string;
    id?: string;
    message?: string;
    details?: { error?: string; [key: string]: unknown };
};

type ExpoReceiptLike = {
    status: string;
    message?: string;
    details?: { error?: string; [key: string]: unknown };
};

export function extractExpoErrorCode(
    details?: { error?: string; [key: string]: unknown },
): ExpoPushErrorCode {
    const raw = details?.error;
    if (!raw || typeof raw !== 'string') return 'Unknown';
    if ((EXPO_PUSH_ERROR_CODES as readonly string[]).includes(raw)) {
        return raw as ExpoPushErrorCode;
    }
    return 'Unknown';
}

export interface ExpoPushLogContext {
    pushTokenPrefix?: string;
    receiptId?: string;
    source?: 'sendNotification' | 'sendBulkNotifications' | 'checkPushReceipts';
}

/** Structured ticket log — always emitted (errors at error level). */
export function logExpoPushTicket(ticket: ExpoTicketLike, context: ExpoPushLogContext = {}): ExpoPushErrorCode | null {
    const errorCode =
        ticket.status === 'error' ? extractExpoErrorCode(ticket.details) : null;

    const payload = {
        event: 'EXPO_PUSH_TICKET',
        ticketId: ticket.status === 'ok' ? ticket.id ?? null : null,
        ticketStatus: ticket.status,
        ticketMessage: ticket.status === 'error' ? ticket.message ?? null : null,
        ticketDetails: ticket.details ?? null,
        errorCode,
        ...context,
    };

    if (ticket.status === 'error') {
        logger.error('[EXPO PUSH TICKET]', payload);
    } else {
        logger.info('[EXPO PUSH TICKET]', payload);
    }

    return errorCode;
}

/** Structured receipt log — always emitted (errors at error level). */
export function logExpoPushReceipt(
    receiptId: string,
    receipt: ExpoReceiptLike | Record<string, unknown>,
    context: ExpoPushLogContext = {},
): ExpoPushErrorCode | null {
    const r = receipt as ExpoReceiptLike;
    const errorCode =
        r.status === 'error' ? extractExpoErrorCode(r.details) : null;

    const payload = {
        event: 'EXPO_PUSH_RECEIPT',
        receiptId,
        receiptStatus: r.status,
        receiptMessage: r.status === 'error' ? r.message ?? null : null,
        receiptDetails: r.details ?? null,
        receiptDetailsError: r.status === 'error' ? r.details?.error ?? null : null,
        errorCode,
        ...context,
    };

    if (r.status === 'error') {
        logger.error('[EXPO PUSH RECEIPT]', payload);
    } else {
        logger.info('[EXPO PUSH RECEIPT]', payload);
    }

    return errorCode;
}
