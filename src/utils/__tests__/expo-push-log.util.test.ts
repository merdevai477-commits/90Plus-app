import {
    extractExpoErrorCode,
    logExpoPushReceipt,
    logExpoPushTicket,
} from '../expo-push-log.util';

describe('expo-push-log.util', () => {
    it('extractExpoErrorCode maps known codes', () => {
        expect(extractExpoErrorCode({ error: 'DeviceNotRegistered' })).toBe('DeviceNotRegistered');
        expect(extractExpoErrorCode({ error: 'MismatchSenderId' })).toBe('MismatchSenderId');
        expect(extractExpoErrorCode({ error: 'SomethingElse' })).toBe('Unknown');
        expect(extractExpoErrorCode(undefined)).toBe('Unknown');
    });

    it('logExpoPushTicket returns error code for error tickets', () => {
        const code = logExpoPushTicket(
            {
                status: 'error',
                message: 'Invalid credentials',
                details: { error: 'InvalidCredentials' },
            },
            { source: 'sendNotification' },
        );
        expect(code).toBe('InvalidCredentials');
    });

    it('logExpoPushReceipt returns error code for error receipts', () => {
        const code = logExpoPushReceipt(
            'receipt-abc',
            {
                status: 'error',
                message: 'Device not registered',
                details: { error: 'DeviceNotRegistered' },
            },
            { source: 'checkPushReceipts' },
        );
        expect(code).toBe('DeviceNotRegistered');
    });
});
