import {
  buildLabEvents,
  buildLabSeries,
  tickSeriesNoise,
} from '../momentumLabFixtures';

describe('momentum lab fixtures', () => {
  it('builds non-null series for 20-event scenario', () => {
    const series = buildLabSeries('20');
    expect(series).not.toBeNull();
    expect(series!.duration).toBeGreaterThanOrEqual(90);
    expect(series!.home.length).toBe(series!.duration + 1);
    expect(series!.markers.length).toBeGreaterThan(0);
  });

  it('returns null for 0 events (coverage gate)', () => {
    expect(buildLabSeries('0')).toBeNull();
    expect(buildLabEvents('0')).toHaveLength(0);
  });

  it('builds longer duration for 120 scenario', () => {
    const series = buildLabSeries('120');
    expect(series).not.toBeNull();
    expect(series!.duration).toBeGreaterThanOrEqual(90);
  });

  it('tickSeriesNoise preserves duration and marker count', () => {
    const base = buildLabSeries('5');
    expect(base).not.toBeNull();
    const next = tickSeriesNoise(base!, 3);
    expect(next.duration).toBe(base!.duration);
    expect(next.markers).toEqual(base!.markers);
    expect(next.home).not.toEqual(base!.home);
  });
});
