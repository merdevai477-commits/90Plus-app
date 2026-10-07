const mockZone = (zone: string) => {
  jest
    .spyOn(Intl, 'DateTimeFormat')
    .mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: zone }) }) as unknown as Intl.DateTimeFormat,
    );
};

const load = () => {
  let mod!: typeof import('../calendarTimezone');
  jest.isolateModules(() => {
    mod = require('../calendarTimezone');
  });
  return mod;
};

describe('calendarTimezone', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('sends no tz and keeps plain keys for the app zone', () => {
    mockZone('Africa/Cairo');
    const tz = load();
    expect(tz.getCalendarTzParam()).toBeNull();
    expect(tz.appendCalendarTzQuery('/m/2026-10-08?view=list')).toBe('/m/2026-10-08?view=list');
    expect(tz.calendarStorageKey('2026-10-08')).toBe('2026-10-08');
  });

  it('adds tz to the query and the storage key elsewhere', () => {
    mockZone('America/New_York');
    const tz = load();
    expect(tz.appendCalendarTzQuery('/m/2026-10-08?view=list')).toBe(
      '/m/2026-10-08?view=list&tz=America%2FNew_York',
    );
    expect(tz.appendCalendarTzQuery('/m/2026-10-08')).toBe('/m/2026-10-08?tz=America%2FNew_York');
    expect(tz.calendarStorageKey('2026-10-08')).toBe('2026-10-08@America/New_York');
  });

  it('notifies listeners when the device zone changes', () => {
    jest.useFakeTimers();
    mockZone('Africa/Cairo');
    const tz = load();
    const listener = jest.fn();
    tz.onCalendarTimezoneChange(listener);
    tz.getCalendarTzParam();
    mockZone('Asia/Dubai');
    jest.advanceTimersByTime(61_000);
    expect(tz.getCalendarTzParam()).toBe('Asia/Dubai');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
