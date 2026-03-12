/**
 * Match Status Utilities
 * Unified status engine for correct football match time display
 * Handles 90+X format, extra time, penalties, and half-time
 */

/**
 * Get match status display text with correct 90+X format
 * Rules:
 * - Never show > 90 minutes (e.g., 97, 100)
 * - Show 90+5 instead of 95
 * - Handle extra time (ET)
 * - Handle penalties (P)
 * - Handle half-time (HT)
 */
export const getMatchStatus = (
  status: string,
  elapsed?: number | null
): string => {
  // Finished statuses
  if (status === 'FT' || status === 'AET') return 'FT';
  if (status === 'PEN' || status === 'P') return 'PEN';
  
  // Half-time
  if (status === 'HT') return 'HT';
  
  // Break time (extra time break)
  if (status === 'BT') return 'BT';
  
  // Extra time
  if (status === 'ET' && elapsed !== null && elapsed !== undefined) {
    // In extra time, elapsed can be > 90, show as 90+X
    if (elapsed > 90) {
      return `90+${elapsed - 90}' (ET)`;
    }
    return `${elapsed}' (ET)`;
  }
  
  // Regular time (1H or 2H)
  if ((status === '1H' || status === '2H') && elapsed !== null && elapsed !== undefined) {
    // First half: show 45+X after 45 minutes
    if (status === '1H' && elapsed > 45) {
      return `45+${elapsed - 45}'`;
    }
    // Second half: show 90+X after 90 minutes
    if (status === '2H' && elapsed > 90) {
      return `90+${elapsed - 90}'`;
    }
    return `${elapsed}'`;
  }
  
  // Live status without elapsed time
  if (status === 'LIVE') return 'LIVE';
  
  // Default: return status as-is
  return status;
};

/**
 * Get match status for display in cards
 * Returns the minute string or status
 */
export const formatMatchMinute = (
  status: string,
  elapsed?: number | null
): string | undefined => {
  const displayStatus = getMatchStatus(status, elapsed);
  
  // Return undefined for non-live statuses that should be handled by parent
  if (['FT', 'AET', 'PEN', 'P'].includes(status)) {
    return undefined; // Parent should show "FT" or "PEN"
  }
  
  return displayStatus;
};

/**
 * Check if match is live
 */
export const isMatchLive = (status: string): boolean => {
  const liveStatuses = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'];
  return liveStatuses.includes(status);
};

/**
 * Check if match is finished
 */
export const isMatchFinished = (status: string): boolean => {
  const finishedStatuses = ['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'];
  return finishedStatuses.includes(status);
};

/**
 * Check if match is upcoming
 */
export const isMatchUpcoming = (status: string): boolean => {
  return !isMatchLive(status) && !isMatchFinished(status);
};

