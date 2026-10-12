/**
 * Lets the typing orb ask the chat hook to hold back the first words of a
 * reply until its entrance animation has finished.
 */

let holdUntil = 0;

export function holdTypingUntil(timestamp: number): void {
  holdUntil = timestamp;
}

export function typingOrbHoldUntil(): number {
  return holdUntil;
}
