/**
 * Load Sentry as early as possible (before React mounts).
 * Native iOS crashes are missed if init runs only inside useEffect.
 */
import { initSentry } from './sentry.service';

initSentry();
