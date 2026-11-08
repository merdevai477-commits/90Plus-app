/**
 * Write a diagnostics report for one session.
 * Usage: npx ts-node scripts/diagnostics-report.ts <session-uuid>
 * Requires DATABASE_URL. Does not enable any production flag.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { analyzeDiagnostics, toAnalysisEvent } from '../src/services/diagnostics/analysis/diagnostics-analysis';

async function main(): Promise<void> {
    const sessionId = process.argv[2];
    if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
        console.error('Usage: npx ts-node scripts/diagnostics-report.ts <session-uuid>');
        process.exitCode = 1;
        return;
    }
    const prisma = new PrismaClient();
    try {
        const rows = await prisma.diagnosticEvent.findMany({
            where: { sessionId },
            orderBy: { recordedAt: 'asc' },
            take: 5000,
        });
        const report = analyzeDiagnostics(rows.map(toAnalysisEvent));
        const dir = path.join('artifacts', 'diagnostics', sessionId);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
        const lines = [
            `# Diagnostics ${sessionId}`,
            '',
            `Client events: ${report.completeness.clientEvents}`,
            `Backend events: ${report.completeness.backendEvents}`,
            '',
            'A fact is counted from stored events. An inference is not a confirmed cause.',
            '',
        ];
        for (const finding of report.findings) {
            lines.push(`## ${finding.kind}: ${finding.title}`);
            lines.push(finding.probableCause);
            lines.push(`Confidence: ${finding.confidence}. Evidence n=${finding.evidence.n}.`);
            lines.push(finding.recommendation);
            for (const caveat of finding.caveats) lines.push(`- ${caveat}`);
            lines.push('');
        }
        if (report.findings.length === 0) lines.push('No findings.');
        fs.writeFileSync(path.join(dir, 'report.md'), lines.join('\n'));
        console.log(`Wrote ${path.join(dir, 'report.json')}`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
