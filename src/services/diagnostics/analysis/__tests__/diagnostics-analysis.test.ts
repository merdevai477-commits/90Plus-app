import { analyzeDiagnostics, type AnalysisEvent } from '../diagnostics-analysis';

let seq = 0;
function ev(type: string, data: Record<string, unknown> = {}, extra: Partial<AnalysisEvent> = {}): AnalysisEvent {
    seq += 1;
    return {
        eventId: `ev-${seq}`,
        type,
        source: extra.source ?? 'client',
        recordedAt: extra.recordedAt ?? 1_780_000_000_000 + seq * 1000,
        fixtureId: extra.fixtureId,
        traceId: extra.traceId,
        data,
    };
}

describe('analyzeDiagnostics', () => {
    beforeEach(() => {
        seq = 0;
    });

    it('returns no findings for an empty session', () => {
        expect(analyzeDiagnostics([]).findings).toEqual([]);
    });

    it('counts skip reasons as a fact and does not call them a confirmed cause', () => {
        const report = analyzeDiagnostics([
            ev('pipeline_trace', { decision: 'skipped', reason: 'goals_regression' }, { fixtureId: 9 }),
            ev('pipeline_trace', { decision: 'skipped', reason: 'goals_regression' }, { fixtureId: 9 }),
            ev('pipeline_trace', { decision: 'applied' }, { fixtureId: 9 }),
        ]);
        const finding = report.findings.find((item) => item.id === 'guard_rejections');
        expect(finding?.kind).toBe('fact');
        expect(finding?.evidence.n).toBe(2);
        expect(finding?.probableCause).toContain('goals_regression:2');
        expect(finding?.probableCause.toLowerCase()).not.toContain('confirmed');
        expect(finding?.caveats.length).toBeGreaterThan(0);
    });

    it('does not invent a delivery failure when the client uploaded the same trace', () => {
        const report = analyzeDiagnostics([
            ev('be_ws_emit', { point: 'ws_emit' }, { source: 'backend', traceId: 'b-1', fixtureId: 4 }),
            ev('pipeline_trace', { decision: 'applied', source: 'ws' }, { traceId: 'b-1', fixtureId: 4 }),
        ]);
        expect(report.findings.some((item) => item.id === 'missing_ws_delivery')).toBe(false);
    });

    it('treats a missing client trace as an inference with low confidence', () => {
        const report = analyzeDiagnostics([
            ev('be_ws_emit', {}, { source: 'backend', traceId: 'b-missing', fixtureId: 4 }),
            ev('room_sub', { action: 'sub', roomCount: 2 }),
        ]);
        const finding = report.findings.find((item) => item.id === 'missing_ws_delivery');
        expect(finding?.kind).toBe('inference');
        expect(finding?.confidence).toBe('low');
        expect(finding?.caveats.join(' ')).toContain('not proof');
    });

    it('measures only stages that have both timestamps', () => {
        const report = analyzeDiagnostics([
            ev('pipeline_trace', { decision: 'applied', recvMono: 100, storeMono: 110, overlayMono: 140, commitMono: 200 }),
            ev('pipeline_trace', { decision: 'applied', recvMono: 100, storeMono: 130 }),
        ]);
        const finding = report.findings.find((item) => item.id === 'stage_latency');
        expect(finding?.kind).toBe('fact');
        expect(finding?.probableCause).toContain('commit');
    });

    it('reports redundant renders and clock gaps as facts', () => {
        const report = analyzeDiagnostics([
            ev('render_window', { rowRenders: 10, redundantRenders: 4, windowMs: 30_000 }),
            ev('list_minute_mismatch', { label: '64', elapsed: 67, deltaMin: -3 }, { fixtureId: 8 }),
        ]);
        expect(report.findings.map((item) => item.id).sort()).toEqual(['clock_mismatch', 'redundant_renders']);
        for (const item of report.findings) expect(item.kind).toBe('fact');
    });

    it('keeps a negative case quiet when the queue is healthy', () => {
        const report = analyzeDiagnostics([
            ev('queue_stats', { size: 0, criticalDropped: 0, flushFailures: 0, rejected: 0 }),
            ev('render_window', { rowRenders: 5, redundantRenders: 0, windowMs: 30_000 }),
        ]);
        expect(report.findings).toEqual([]);
        expect(report.completeness).toMatchObject({ droppedOnDevice: 0, flushFailures: 0, rejectedByServer: 0 });
    });
});
