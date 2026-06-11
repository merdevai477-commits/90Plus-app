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

/** Temporary runtime diagnostics — always logged (filter: adb logcat | grep "PUSH STEP") */
export function pushStep(step: string | number, detail?: string): void {
    const label = typeof step === 'number' ? String(step) : step;
    const suffix = detail ? ` ${detail}` : '';
    console.log(`[PUSH STEP ${label}]${suffix}`);
}
