/**
 * Pure diagnostics analysis. A finding is either a fact (counted from events)
 * or an inference (a possible explanation). Inferences are never confirmed causes.
 */

export interface AnalysisEvent {
    eventId: string;
    type: string;
    source: 'client' | 'backend';
    recordedAt: number;
    fixtureId?: number | null;
    traceId?: string | null;
    data: Record<string, unknown>;
}

export interface FindingEvidence {
    eventIds: string[];
    traceIds: string[];
    fixtureIds: number[];
    timeRange: { start: number; end: number } | null;
    n: number;
}

export interface Finding {
    id: string;
    kind: 'fact' | 'inference';
    title: string;
    probableCause: string;
    confidence: 'low' | 'med' | 'high';
    evidence: FindingEvidence;
    recommendation: string;
    caveats: string[];
}

export interface AnalysisReport {
    findings: Finding[];
    completeness: {
        clientEvents: number;
        backendEvents: number;
        droppedOnDevice: number;
        flushFailures: number;
        rejectedByServer: number;
    };
}

const DROP_CAVEAT = 'Events dropped on the device, still queued, or rejected by the server are absent from this report.';
const CLOCK_CAVEAT = 'Client and server timestamps are different clocks. A gap between them is not a measured duration.';

function num(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function evidenceOf(events: AnalysisEvent[]): FindingEvidence {
    const times = events.map((event) => event.recordedAt).filter((value) => Number.isFinite(value));
    return {
        eventIds: events.map((event) => event.eventId).slice(0, 20),
        traceIds: [...new Set(events.map((event) => event.traceId).filter((id): id is string => Boolean(id)))].slice(0, 20),
        fixtureIds: [...new Set(events.map((event) => event.fixtureId).filter((id): id is number => typeof id === 'number'))].slice(0, 20),
        timeRange: times.length ? { start: Math.min(...times), end: Math.max(...times) } : null,
        n: events.length,
    };
}

function confidenceFrom(n: number, weakened = false): Finding['confidence'] {
    if (weakened || n < 3) return 'low';
    if (n < 10) return 'med';
    return 'high';
}

function percentile(values: number[], p: number): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[index];
}

function finding(partial: Omit<Finding, 'caveats'> & { caveats?: string[] }): Finding {
    return { ...partial, caveats: [DROP_CAVEAT, ...(partial.caveats ?? [])] };
}

function guardRejections(events: AnalysisEvent[]): Finding | null {
    const skipped = events.filter((event) => event.type === 'pipeline_trace' && event.data.decision === 'skipped');
    if (skipped.length === 0) return null;
    const byReason = new Map<string, number>();
    for (const event of skipped) {
        const reason = text(event.data.reason) ?? 'unspecified';
        byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
    }
    const summary = [...byReason.entries()].map(([reason, count]) => `${reason}:${count}`).join(', ');
    return finding({
        id: 'guard_rejections',
        kind: 'fact',
        title: 'HTTP or store updates were skipped',
        probableCause: `The store recorded these skip reasons: ${summary}. This counts decisions, not why the incoming data was older.`,
        confidence: confidenceFrom(skipped.length),
        evidence: evidenceOf(skipped),
        recommendation: 'Open the skipped traces and compare sigIn with sigBefore before treating a reason as the fault.',
    });
}

function anomalyFacts(events: AnalysisEvent[]): Finding | null {
    const anomalies = events.filter((event) => event.type === 'pipeline_anomaly');
    if (anomalies.length === 0) return null;
    const byKind = new Map<string, number>();
    for (const event of anomalies) {
        const kind = text(event.data.kind) ?? 'unknown';
        byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
    }
    const summary = [...byKind.entries()].map(([kind, count]) => `${kind}:${count}`).join(', ');
    return finding({
        id: 'pipeline_anomalies',
        kind: 'fact',
        title: 'Pipeline anomaly markers were recorded',
        probableCause: `Markers observed: ${summary}. A marker means the check fired. It does not by itself prove the user-visible fault.`,
        confidence: confidenceFrom(anomalies.length),
        evidence: evidenceOf(anomalies),
        recommendation: 'Pair each marker with the pipeline_trace that shares its traceId.',
    });
}

function stageLatency(events: AnalysisEvent[]): Finding | null {
    const traces = events.filter((event) => event.type === 'pipeline_trace' && event.data.decision === 'applied');
    const stages = { store: [] as number[], overlay: [] as number[], commit: [] as number[] };
    for (const event of traces) {
        const recv = num(event.data.recvMono);
        const store = num(event.data.storeMono);
        const overlay = num(event.data.overlayMono);
        const commit = num(event.data.commitMono);
        if (recv != null && store != null && store >= recv) stages.store.push(store - recv);
        if (store != null && overlay != null && overlay >= store) stages.overlay.push(overlay - store);
        if (overlay != null && commit != null && commit >= overlay) stages.commit.push(commit - overlay);
    }
    const samples = stages.store.length + stages.overlay.length + stages.commit.length;
    if (samples === 0) return null;
    const p50 = {
        store: percentile(stages.store, 50),
        overlay: percentile(stages.overlay, 50),
        commit: percentile(stages.commit, 50),
    };
    const ranked = (Object.entries(p50) as Array<[string, number | null]>).filter((entry): entry is [string, number] => entry[1] != null);
    ranked.sort((a, b) => b[1] - a[1]);
    const largest = ranked[0];
    return finding({
        id: 'stage_latency',
        kind: 'fact',
        title: 'Measured stage durations on the device clock',
        probableCause: largest
            ? `Largest p50 among the stages that had both timestamps: ${largest[0]} at ${Math.round(largest[1])}ms. Stages without both timestamps are omitted, not zero.`
            : 'Durations could not be paired.',
        confidence: confidenceFrom(samples),
        evidence: evidenceOf(traces),
        recommendation: 'Use the monotonic deltas. Do not subtract a server timestamp from a device timestamp.',
    });
}

function missingDelivery(events: AnalysisEvent[]): Finding | null {
    const emits = events.filter((event) => event.type === 'be_ws_emit' && event.traceId);
    if (emits.length === 0) return null;
    const received = new Set(
        events.filter((event) => event.source === 'client' && event.traceId).map((event) => event.traceId as string),
    );
    const missing = emits.filter((event) => !received.has(event.traceId as string));
    if (missing.length === 0) return null;
    const subscribed = events.some((event) => event.type === 'room_sub' && event.data.action === 'sub');
    return finding({
        id: 'missing_ws_delivery',
        kind: 'inference',
        title: 'Some server emits have no matching client trace',
        probableCause: subscribed
            ? 'The device recorded a room subscription, and these emit trace ids never appeared in an uploaded client event. One explanation is that the update did not arrive. Upload delay or a closed session can look the same.'
            : 'These emit trace ids have no uploaded client event. The device may not have been subscribed, or the client batch may not have been uploaded yet.',
        confidence: 'low',
        evidence: evidenceOf(missing),
        recommendation: 'Check queue_stats and session_end before calling the socket path broken.',
        caveats: [CLOCK_CAVEAT, 'Absence of an uploaded event is not proof the device never received the update.'],
    });
}

function redundantRenders(events: AnalysisEvent[]): Finding | null {
    const windows = events.filter((event) => event.type === 'render_window');
    const redundant = windows.reduce((sum, event) => sum + (num(event.data.redundantRenders) ?? 0), 0);
    const renders = windows.reduce((sum, event) => sum + (num(event.data.rowRenders) ?? 0), 0);
    if (renders === 0 || redundant === 0) return null;
    return finding({
        id: 'redundant_renders',
        kind: 'fact',
        title: 'Rows rendered again with the same signature',
        probableCause: `${redundant} of ${renders} sampled row renders repeated a signature. The count is a fact. The reason they repeated is not identified here.`,
        confidence: confidenceFrom(windows.length),
        evidence: evidenceOf(windows),
        recommendation: 'Compare the render window with storeSets in the same window before changing a component.',
    });
}

function jsStalls(events: AnalysisEvent[]): Finding | null {
    const stalls = events.filter((event) => event.type === 'js_stall');
    if (stalls.length === 0) return null;
    const max = Math.max(...stalls.map((event) => num(event.data.latenessMs) ?? 0));
    return finding({
        id: 'js_stalls',
        kind: 'fact',
        title: 'An existing timer fired late',
        probableCause: `${stalls.length} live-sync ticks were late. The largest lateness in this set is ${Math.round(max)}ms. Lateness of the host timer is evidence the JS thread was busy, not a named cause.`,
        confidence: confidenceFrom(stalls.length),
        evidence: evidenceOf(stalls),
        recommendation: 'Look at render_window and pipeline_trace samples in the same few seconds.',
    });
}

function clockMismatches(events: AnalysisEvent[]): Finding | null {
    const mismatches = events.filter((event) => event.type === 'list_minute_mismatch');
    if (mismatches.length === 0) return null;
    const max = Math.max(...mismatches.map((event) => Math.abs(num(event.data.deltaMin) ?? 0)));
    return finding({
        id: 'clock_mismatch',
        kind: 'fact',
        title: 'A list minute differed from the server elapsed value',
        probableCause: `${mismatches.length} comparisons differed. The largest absolute gap in this set is ${max} minute(s). The label and the server elapsed were both recorded; the reason they diverged is not decided here.`,
        confidence: confidenceFrom(mismatches.length),
        evidence: evidenceOf(mismatches),
        recommendation: 'Read clock_reanchor and clock_offset_sample beside the mismatch before changing the clock.',
        caveats: ['The displayed minute is rounded. A one-minute gap can be a rounding boundary.'],
    });
}

function deliveryIntegrity(events: AnalysisEvent[]): Finding | null {
    const stats = events.filter((event) => event.type === 'queue_stats');
    if (stats.length === 0) return null;
    const last = stats[stats.length - 1];
    const critical = num(last.data.criticalDropped) ?? 0;
    const failures = num(last.data.flushFailures) ?? 0;
    const rejected = num(last.data.rejected) ?? 0;
    if (critical === 0 && failures === 0 && rejected === 0) return null;
    return finding({
        id: 'delivery_integrity',
        kind: 'fact',
        title: 'The device reported upload loss or failure',
        probableCause: `Last queue_stats: criticalDropped ${critical}, flushFailures ${failures}, rejected ${rejected}.`,
        confidence: critical > 0 ? 'high' : 'med',
        evidence: evidenceOf([last]),
        recommendation: 'Treat later gaps as missing data. Do not explain them as product bugs until the missing events are ruled out.',
    });
}

function sentryCorrelation(events: AnalysisEvent[]): Finding | null {
    const refs = events.filter((event) => event.type === 'sentry_event_ref');
    if (refs.length === 0) return null;
    const nearby = events.filter((event) => event.type === 'js_stall' || event.type === 'pipeline_anomaly');
    return finding({
        id: 'sentry_correlation',
        kind: nearby.length ? 'inference' : 'fact',
        title: nearby.length ? 'A Sentry event sits near a stall or anomaly marker' : 'Sentry events were referenced',
        probableCause: nearby.length
            ? `${refs.length} Sentry event ids were stored, and ${nearby.length} stall or anomaly markers exist in the same session. Sharing a session is not proof they have one cause.`
            : `${refs.length} Sentry event ids were stored. Open them in Sentry. Their messages are not in this report.`,
        confidence: 'low',
        evidence: evidenceOf([...refs, ...nearby].slice(0, 40)),
        recommendation: 'Search Sentry by the diag_session tag and the stored event id.',
        caveats: ['Exception messages are intentionally not stored here.'],
    });
}

function completeness(events: AnalysisEvent[]): AnalysisReport['completeness'] {
    const stats = events.filter((event) => event.type === 'queue_stats');
    const last = stats[stats.length - 1];
    return {
        clientEvents: events.filter((event) => event.source === 'client').length,
        backendEvents: events.filter((event) => event.source === 'backend').length,
        droppedOnDevice: num(last?.data.criticalDropped) ?? 0,
        flushFailures: num(last?.data.flushFailures) ?? 0,
        rejectedByServer: num(last?.data.rejected) ?? 0,
    };
}

const RULES = [
    guardRejections,
    anomalyFacts,
    stageLatency,
    missingDelivery,
    redundantRenders,
    jsStalls,
    clockMismatches,
    deliveryIntegrity,
    sentryCorrelation,
];

export function toAnalysisEvent(row: {
    eventId: string;
    type: string;
    source: string;
    recordedAt: Date;
    fixtureId?: number | null;
    traceId?: string | null;
    payload: unknown;
}): AnalysisEvent {
    const payload = row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};
    const nested = payload.data;
    const data = row.source === 'client' && nested && typeof nested === 'object' && !Array.isArray(nested)
        ? (nested as Record<string, unknown>)
        : payload;
    return {
        eventId: row.eventId,
        type: row.type,
        source: row.source === 'backend' ? 'backend' : 'client',
        recordedAt: row.recordedAt.getTime(),
        fixtureId: row.fixtureId,
        traceId: row.traceId,
        data,
    };
}

export function analyzeDiagnostics(events: AnalysisEvent[]): AnalysisReport {
    const findings = RULES.map((rule) => rule(events)).filter((item): item is Finding => item != null);
    return { findings, completeness: completeness(events) };
}
