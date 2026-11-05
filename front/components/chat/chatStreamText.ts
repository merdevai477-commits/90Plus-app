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

export function appendChatStream(id: string, piece: string): void {
  if (!piece) return;
  if (activeId !== id) {
    activeId = id;
    text = piece;
  } else {
    text += piece;
  }
  if (emitTimer) return;
  emitTimer = setTimeout(() => {
    emitTimer = null;
    emit();
  }, 50);
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
