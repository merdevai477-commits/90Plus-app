type Notice = { id: string; message: string };
type Listener = (notice: Notice) => void;

const listeners = new Set<Listener>();

export function emitAppUpdateNotice(notice: Notice): void {
  for (const listener of listeners) listener(notice);
}

export function subscribeAppUpdateNotice(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
