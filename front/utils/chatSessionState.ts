/**
 * Lightweight module flag so OTA bootstrap can defer reloadAsync while the
 * user has an active Captain AI conversation.
 */

let chatSessionActive = false;

export function setChatSessionActive(active: boolean): void {
  chatSessionActive = active;
}

export function isChatSessionActive(): boolean {
  return chatSessionActive;
}

/** Poll until chat is idle or timeout — used before OTA reload. */
export async function waitForChatSessionIdle(maxWaitMs = 5 * 60 * 1000): Promise<boolean> {
  const start = Date.now();
  while (isChatSessionActive() && Date.now() - start < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return !isChatSessionActive();
}
