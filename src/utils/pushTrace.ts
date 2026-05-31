/**
 * Server-side push trace logs — set PUSH_TRACE_LOGS=true to enable in production.
 */
export const PUSH_TRACE_ENABLED =
    process.env.PUSH_TRACE_LOGS === 'true' || process.env.NODE_ENV !== 'production';

export function pushApiTrace(message: string): void {
    if (PUSH_TRACE_ENABLED) {
        console.log(message);
    }
}
