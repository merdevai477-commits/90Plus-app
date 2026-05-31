/**
 * Push forensic trace logging — enabled in __DEV__ or EXPO_PUBLIC_PUSH_TRACE=1.
 * Disable in production by omitting the env var and shipping release builds.
 */
export const PUSH_TRACE_ENABLED =
    __DEV__ || process.env.EXPO_PUBLIC_PUSH_TRACE === '1';

export function pushTrace(message: string): void {
    if (PUSH_TRACE_ENABLED) {
        console.log(message);
    }
}
