import { receiptStorageValue, tokenFromReceiptRecord } from '../push-receipt-association';

describe('push receipt association', () => {
  it('stores the actual token and rejects a placeholder', () => {
    expect(receiptStorageValue('ExponentPushToken[abc]')).toBe('ExponentPushToken[abc]');
    expect(receiptStorageValue('1')).toBeNull();
    expect(receiptStorageValue('  ')).toBeNull();
    expect(receiptStorageValue(undefined)).toBeNull();
  });

  it('cleans up only the token stored for that receipt', () => {
    const records = new Map<string, string>([
      ['receipt-a', 'ExponentPushToken[phone-a]'],
      ['receipt-b', 'ExponentPushToken[phone-b]'],
      ['receipt-old', '1'],
    ]);
    expect(tokenFromReceiptRecord(records.get('receipt-a'))).toBe('ExponentPushToken[phone-a]');
    expect(tokenFromReceiptRecord(records.get('receipt-b'))).not.toBe('ExponentPushToken[phone-a]');
    expect(tokenFromReceiptRecord(records.get('receipt-old'))).toBeNull();
  });

  it('is a no-op when the receipt was already processed', () => {
    expect(tokenFromReceiptRecord(null)).toBeNull();
    expect(tokenFromReceiptRecord(undefined)).toBeNull();
  });
});
