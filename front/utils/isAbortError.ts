/** True when a fetch was cancelled via AbortController (not a real failure). */
export function isAbortError(error: unknown): boolean {
  if (error == null) return false;
  if (typeof error === 'object' && 'name' in error && (error as { name: string }).name === 'AbortError') {
    return true;
  }
  const message = String((error as Error)?.message ?? error).toLowerCase();
  return (
    message.includes('aborted') ||
    message.includes('abort') ||
    message.includes('cancelled') ||
    message.includes('canceled')
  );
}
