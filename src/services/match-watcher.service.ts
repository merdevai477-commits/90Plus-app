/**
 * @deprecated Use LiveMatchIngestorService directly. Kept for backward-compatible imports in main.ts.
 */
import LiveMatchIngestorService from './live-match-ingestor.service';

export class MatchWatcherService {
    static start(): void {
        LiveMatchIngestorService.start();
    }

    static stop(): void {
        LiveMatchIngestorService.stop();
    }

    /** Manual trigger (tests / admin). */
    static async checkMatches(): Promise<void> {
        await LiveMatchIngestorService.tick();
    }
}

export default MatchWatcherService;
