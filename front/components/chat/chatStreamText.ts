/**
 * Live assistant text while a reply is typing.
 * Listeners are the streaming bubble only — the message list stays put
 * until the reply is committed.
 */

type Listener = () => void;

let activeId: string | null = null;
let text = '';
const listeners = new Set<Listener>();
let emitTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeChatStream(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function peekChatStream(id: string): string {
  return activeId === id ? text : '';
}

const FLUSH_MS = 80;

export function appendChatStream(id: string, piece: string): void {
  if (!piece) return;
  const firstPiece = activeId !== id;
  if (firstPiece) {
    activeId = id;
    text = piece;
  } else {
    text += piece;
  }
  // Paint the first token immediately so the reply feels instant, then
  // coalesce the rest so markdown layout does not run on every SSE chunk.
  if (firstPiece) {
    if (emitTimer) {
      clearTimeout(emitTimer);
      emitTimer = null;
    }
    emit();
    return;
  }
  if (emitTimer) return;
  emitTimer = setTimeout(() => {
    emitTimer = null;
    emit();
  }, FLUSH_MS);
}

/** Visible text so far. Does not notify — the caller is about to commit it into React state. */
export function takeChatStream(id: string): string {
  if (emitTimer) {
    clearTimeout(emitTimer);
    emitTimer = null;
  }
  if (activeId !== id) return '';
  const taken = text;
  activeId = null;
  text = '';
  return taken;
}

export function resetChatStream(): void {
  if (emitTimer) {
    clearTimeout(emitTimer);
    emitTimer = null;
  }
  activeId = null;
  text = '';
  emit();
}
