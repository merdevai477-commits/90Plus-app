import {
  filterCompleted365Transfers,
  isCompleted365Transfer,
} from '../scores365-transfer-status.util';

describe('isCompleted365Transfer', () => {
  it('keeps confirmed deals by statusId across languages', () => {
    expect(isCompleted365Transfer({ statusId: 2, statusName: 'Confirmed' })).toBe(true);
    expect(isCompleted365Transfer({ statusId: 2, statusName: 'انتقالات تمت' })).toBe(true);
    expect(isCompleted365Transfer({ statusId: 2, statusName: 'אושרה' })).toBe(true);
  });

  it('drops rumours by statusId even when the fee looks like a completed sale', () => {
    expect(isCompleted365Transfer({ statusId: 5, statusName: 'Rumor', })).toBe(false);
    expect(isCompleted365Transfer({ statusId: 5, statusName: 'تقارير' })).toBe(false);
    expect(isCompleted365Transfer({ statusId: 5, statusName: 'Confirmed' })).toBe(false);
  });

  it('falls back to statusName when statusId is missing', () => {
    expect(isCompleted365Transfer({ statusName: 'Confirmed' })).toBe(true);
    expect(isCompleted365Transfer({ statusName: 'انتقالات تمت' })).toBe(true);
    expect(isCompleted365Transfer({ statusName: 'Rumor' })).toBe(false);
    expect(isCompleted365Transfer({ statusName: 'تقارير' })).toBe(false);
    expect(isCompleted365Transfer({ statusName: 'شائعة' })).toBe(false);
    expect(isCompleted365Transfer({})).toBe(false);
  });

  it('drops any other numeric status (deal not completed)', () => {
    expect(isCompleted365Transfer({ statusId: 1, statusName: 'Pending' })).toBe(false);
    expect(isCompleted365Transfer({ statusId: 0 })).toBe(false);
  });
});

describe('filterCompleted365Transfers', () => {
  it('removes rumours from a Real Madrid-style arrivals mix', () => {
    const rows = [
      { athlete: 'Haaland', statusId: 5, statusName: 'Rumor', isArrival: true },
      { athlete: 'Palmer', statusId: 5, statusName: 'تقارير', isArrival: true },
      { athlete: 'Konaté', statusId: 2, statusName: 'انتقالات تمت', isArrival: true },
      { athlete: 'Vinicius out', statusId: 5, statusName: 'Rumor', isArrival: false },
      { athlete: 'Endrick loan-back', statusId: 2, statusName: 'Confirmed', isArrival: true },
    ];
    expect(filterCompleted365Transfers(rows).map((r) => r.athlete)).toEqual([
      'Konaté',
      'Endrick loan-back',
    ]);
  });
});
