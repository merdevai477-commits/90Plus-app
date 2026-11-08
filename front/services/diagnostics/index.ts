/**
 * Public diagnostics API for hook sites. Every function is a no-op unless a
 * remote session is recording on a diagnostics-capable build; call sites
 * guard with `diagFlags.<feature>` first so the disabled cost is one read.
 */
export { diagFlags, monoNow } from './diagnosticsState';
export { recordDiagEvent, isFixtureSampled, getDiagSessionHeader } from './diagnosticsRecorder';
export { fixtureSignature } from './diagnosticsPrivacy';
export { crossClockDelta } from './diagnosticsClockSync';
export { clockEstimator } from './diagnosticsUploader';
export {
  diagnosticsHostTick,
  onDiagnosticsSessionChange,
  type DiagSessionInfo,
} from './diagnosticsSession';
export { isDiagnosticsCapableBuild } from './diagnosticsConfig';
