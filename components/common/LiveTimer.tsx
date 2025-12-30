import React, { useState, useEffect } from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

interface LiveTimerProps extends TextProps {
    /** Timestamp when the current period started (in seconds or milliseconds) */
    startTime: number;
    /** Initial elapsed minutes provided by API (optional, for validation/fallback) */
    initialMinute?: number;
    /** Current match status (1H, 2H, HT, etc.) */
    status: string;
    /** Style for the text */
    style?: any;
}

/**
 * LiveTimer component
 * Calculates and displays elapsed time in MM:SS format relative to a start timestamp.
 */
export const LiveTimer: React.FC<LiveTimerProps> = ({
    startTime,
    status,
    initialMinute,
    style,
    ...props
}) => {
    const [elapsed, setElapsed] = useState<string>('00:00');

    useEffect(() => {
        // Immediate calculation
        calculateTime();

        // Update every second
        const interval = setInterval(calculateTime, 1000);

        return () => clearInterval(interval);
    }, [startTime, status]);

    const calculateTime = () => {
        if (!startTime) {
            setElapsed('00:00');
            return;
        }

        const now = Math.floor(Date.now() / 1000);
        const start = typeof startTime === 'string' ? parseInt(startTime) : startTime;

        // API-Football timestamps are usually in seconds (Unix timestamp)
        // If it seems too small (e.g. < 2B), it's seconds. If > 2B, might be ms (unlikely for standard epoch, but good to check).
        // Actually, Date.now() is ms, API is usually seconds.
        // Let's normalize start to seconds.

        // Adjust if input is ms
        const startInSeconds = start > 100000000000 ? Math.floor(start / 1000) : start;

        let diffSeconds = now - startInSeconds;

        // Correction for 2nd half: add 45 minutes
        if (status === '2H') {
            diffSeconds += 45 * 60;
        }

        // Extra Time correction could be added here if needed (e.g. +90 mins for ET)

        if (diffSeconds < 0) diffSeconds = 0;

        const minutes = Math.floor(diffSeconds / 60);
        const seconds = diffSeconds % 60;

        const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        setElapsed(formatted);
    };

    // Helper for non-live statuses
    if (['HT', 'FT', 'BT', 'P'].includes(status)) {
        // If status is not active play, just return the status or fixed time?
        // User request implies "timer", usually for active play.
        // For HT/FT, the parent component usually handles the display logic, 
        // but if this component is used, we might want to just show the static time if provided?
        // Actually, let's strictly return the timer. If status is HT, parent shouldn't render Timer or should render "HT".
        // But if we want to be safe:
        return <Text style={style} {...props}>{elapsed}</Text>;
    }

    return (
        <Text style={style} {...props}>
            {elapsed}
        </Text>
    );
};
