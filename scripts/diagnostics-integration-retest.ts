/**
 * Prepared second diagnostics integration test. Do not run it until the
 * operator sets DIAG_INTEGRATION_APPROVED=1 for this process.
 *
 * It refuses NODE_ENV=production and a DIAG_REDIS_URL that points at the
 * application Redis. It does not read REDIS_URL for diagnostic commands.
 * The database URL must be supplied explicitly in the environment; this file
 * does not embed one.
 *
 * Expected after A, B, C and a post-stop event: 8 persisted events, counters
 * still 8, and the post-stop response rejected.
 */
import { guardDiagnosticTestProcess, describeDiagnosticRedis } from '../src/services/diagnostics/diagnostics-redis';

guardDiagnosticTestProcess();
if (process.env.DIAG_INTEGRATION_APPROVED !== '1') {
    console.error('Refusing to run. Set DIAG_INTEGRATION_APPROVED=1 after review. This script does not execute the test by itself.');
    process.exitCode = 1;
} else {
    const target = describeDiagnosticRedis();
    console.log(
        JSON.stringify({
            ready: true,
            environment: target.environment,
            redisMode: target.mode,
            redisHost: target.host,
            namespace: target.namespace,
        }),
    );
    console.error('Approved flag is set, but the retest body is intentionally not executed from this preparation step.');
    process.exitCode = 2;
}
