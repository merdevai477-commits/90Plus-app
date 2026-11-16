import { assignGoalClips } from '../assignGoalClips';

describe('assignGoalClips', () => {
  const goal = (name: string) => ({ type: 'Goal', player: { name } });

  it('attaches a clip to the scorer named in the title and leaves other events alone', () => {
    const clips = [
      { title: 'Bellingham goal', description: null, url: 'https://example.com/b', thumbnail: 'https://example.com/b.jpg' },
      { title: 'Saka finish', description: null, url: 'https://example.com/s', thumbnail: null },
    ];
    const assigned = assignGoalClips(
      [goal('Bukayo Saka'), { type: 'Card', player: { name: 'Saka' } }, goal('Jude Bellingham')],
      clips,
    );
    expect(assigned[0]?.url).toBe('https://example.com/s');
    expect(assigned[1]).toBeNull();
    expect(assigned[2]?.url).toBe('https://example.com/b');
  });

  it('lines clips up with goals only when the counts match', () => {
    const clips = [
      { title: 'Goal', url: 'https://example.com/1' },
      { title: 'Goal', url: 'https://example.com/2' },
    ];
    const assigned = assignGoalClips([goal('A'), goal('B')], clips);
    expect(assigned.map((clip) => clip?.url)).toEqual(['https://example.com/1', 'https://example.com/2']);

    const ambiguous = assignGoalClips([goal('A'), goal('B'), goal('C')], [clips[0]]);
    expect(ambiguous).toEqual([null, null, null]);
  });
});
