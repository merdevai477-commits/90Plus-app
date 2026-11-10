/** Token stored with a receipt. A placeholder cannot identify which device to remove. */
export function receiptStorageValue(pushToken: string | undefined): string | null {
    const token = pushToken?.trim();
    if (!token || token === '1') return null;
    return token;
}

/** Token to delete for a receipt record. `'1'` is the old placeholder and matches no device. */
export function tokenFromReceiptRecord(stored: string | null | undefined): string | null {
    if (!stored || stored === '1') return null;
    return stored;
}
