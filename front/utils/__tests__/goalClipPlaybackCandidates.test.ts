import { buildGoalClipPlaybackCandidates } from '../goalClipPlaybackCandidates';

describe('buildGoalClipPlaybackCandidates', () => {
  const goal = (name: string, elapsed: number) => ({
    type: 'Goal',
    player: { name },
    time: { elapsed },
  });

  it('returns the primary assigned URL when it works alone', () => {
    const events = [goal('Saka', 22)];
    const clips = [
      { title: 'Saka 22', description: 'Saka 22', url: 'https://streamin.link/v/abc12345' },
    ];
    expect(buildGoalClipPlaybackCandidates(events, 0, clips)).toEqual([
      'https://streamin.link/v/abc12345',
    ]);
  });

  it('adds same-event alternates after the primary and deduplicates', () => {
    const events = [goal('Saka', 22), goal('Bellingham', 55)];
    const clips = [
      {
        title: 'Saka finish 22',
        description: 'Saka 22',
        url: 'https://streamin.link/v/deadbeef',
      },
      {
        title: 'Saka finish 22',
        description: 'Saka 22',
        url: 'https://www.youtube.com/watch?v=qjEXEEBQgqo',
      },
      {
        title: 'Saka finish 22',
        description: 'Saka 22',
        url: 'https://streamin.link/v/deadbeef',
      },
      {
        title: 'Bellingham 55',
        description: 'Bellingham 55',
        url: 'https://www.youtube.com/watch?v=othergoal',
      },
    ];

    const urls = buildGoalClipPlaybackCandidates(events, 0, clips);
    expect(urls[0]).toBe('https://streamin.link/v/deadbeef');
    expect(urls).toContain('https://www.youtube.com/watch?v=qjEXEEBQgqo');
    expect(urls.filter((url) => url === 'https://streamin.link/v/deadbeef')).toHaveLength(1);
    expect(urls).not.toContain('https://www.youtube.com/watch?v=othergoal');
  });

  it('never selects a clip assigned to an unrelated goal', () => {
    const events = [goal('Saka', 22), goal('Bellingham', 55)];
    const clips = [
      { title: 'Saka 22', description: 'Saka 22', url: 'https://example.com/saka.mp4' },
      {
        title: 'Bellingham 55',
        description: 'Bellingham 55',
        url: 'https://www.youtube.com/watch?v=bell55xx',
      },
    ];
    expect(buildGoalClipPlaybackCandidates(events, 0, clips)).toEqual([
      'https://example.com/saka.mp4',
    ]);
    expect(buildGoalClipPlaybackCandidates(events, 1, clips)).toEqual([
      'https://www.youtube.com/watch?v=bell55xx',
    ]);
  });

  it('returns empty when there is no goal event / no candidates', () => {
    expect(buildGoalClipPlaybackCandidates([{ type: 'Card' }], 0, [])).toEqual([]);
    expect(buildGoalClipPlaybackCandidates([goal('Saka', 10)], 0, [])).toEqual([]);
  });

  it('keeps fixture scope — only uses the provided fixture clip list', () => {
    const events = [goal('Saka', 22)];
    const fixtureClips = [
      { title: 'Saka 22', description: 'Saka 22', url: 'https://example.com/fixture-a.mp4' },
    ];
    const otherFixtureClips = [
      { title: 'Saka 22', description: 'Saka 22', url: 'https://example.com/other-fixture.mp4' },
    ];
    expect(buildGoalClipPlaybackCandidates(events, 0, fixtureClips)).toEqual([
      'https://example.com/fixture-a.mp4',
    ]);
    expect(buildGoalClipPlaybackCandidates(events, 0, fixtureClips)).not.toEqual(
      expect.arrayContaining(otherFixtureClips.map((clip) => clip.url)),
    );
  });

  it('uses YouTube embedUrl when primary url is an unsupported host', () => {
    const events = [goal('Saka', 22)];
    const clips = [
      {
        title: 'Saka 22',
        description: 'Saka 22',
        url: 'https://streama.in/clip/dead',
        embedUrl: 'https://www.youtube.com/embed/qjEXEEBQgqo',
      },
    ];
    expect(buildGoalClipPlaybackCandidates(events, 0, clips)).toEqual([
      'https://www.youtube.com/embed/qjEXEEBQgqo',
    ]);
  });
});
