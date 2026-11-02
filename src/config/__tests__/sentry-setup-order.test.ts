/**
 * Sentry only instruments modules required after it starts, and Express only
 * passes errors to handlers registered after the routes. Both orders broke once
 * without anyone noticing: no server errors reached Sentry.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const mainSource = readFileSync(join(__dirname, '../../main.ts'), 'utf8');

describe('Sentry setup order in main.ts', () => {
    it('starts Sentry before anything else is imported', () => {
        const firstImport = mainSource.match(/^import\s[^;]+;/m)?.[0];
        expect(firstImport).toBe("import './instrument';");
    });

    it('registers the Sentry error handler after every route and before the final error handler', () => {
        const sentryHandler = mainSource.indexOf('setupSentryErrorHandler(app);');
        const notFoundHandler = mainSource.indexOf('404 - Route not found');
        const finalErrorHandler = mainSource.indexOf('app.use((err: Error');

        expect(sentryHandler).toBeGreaterThan(notFoundHandler);
        expect(sentryHandler).toBeLessThan(finalErrorHandler);
        expect(notFoundHandler).toBeGreaterThan(-1);

        const routesAfterHandler = mainSource
            .slice(sentryHandler)
            .match(/^app\.(use|get|post|put|patch|delete|all)\(/gm);
        expect(routesAfterHandler).toEqual(['app.use(']);
    });
});
