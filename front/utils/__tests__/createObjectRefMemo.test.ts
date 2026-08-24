import { createObjectRefMemo } from '../createObjectRefMemo';

describe('createObjectRefMemo', () => {
  it('returns the same output ref for the same input object', () => {
    const compute = jest.fn((input: { id: string }) => ({ mapped: input.id }));
    const memo = createObjectRefMemo(compute);
    const row = { id: 'a' };
    const first = memo(row);
    const second = memo(row);
    expect(second).toBe(first);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('recomputes when the input object reference changes', () => {
    const compute = jest.fn((input: { id: string }) => ({ mapped: input.id }));
    const memo = createObjectRefMemo(compute);
    const a = memo({ id: 'a' });
    const b = memo({ id: 'a' });
    expect(a).not.toBe(b);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('preserves identity for unchanged rows when mapping a list', () => {
    const memo = createObjectRefMemo((m: { id: string; score: number }) => ({
      id: m.id,
      score: m.score,
    }));
    const stable = { id: '1', score: 0 };
    const changing = { id: '2', score: 0 };
    const first = [stable, changing].map(memo);
    const nextChanging = { id: '2', score: 1 };
    const second = [stable, nextChanging].map(memo);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
    expect(second[1].score).toBe(1);
  });
});
