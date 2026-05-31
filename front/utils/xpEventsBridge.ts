import type { XpEvent } from '../contexts/XpContext';

type XpEventsHandler = (events: XpEvent[]) => void | Promise<void>;

let handler: XpEventsHandler | null = null;

export function setXpEventsHandler(next: XpEventsHandler | null): void {
  handler = next;
}

/** Forward API xpEvents to XpContext (profile updates, uploads, etc.). */
export function processXpEventsFromApi(
  xpEvents: XpEvent[] | null | undefined,
  fallbackRefresh?: () => void,
): void {
  if (xpEvents?.length && handler) {
    void handler(xpEvents);
    return;
  }
  if (fallbackRefresh) {
    void fallbackRefresh();
  }
}
