import { buildGroupMotivationText } from '../groupInsights';

describe('buildGroupMotivationText', () => {
  const labels = {
    leading: 'You are leading the group',
    rankGap: 'You are rank {rank}, {points} points away from rank {nextRank}.',
    notRanked: 'Make your first prediction to join the leaderboard.',
  };

  it('returns not ranked text when user is not in leaderboard', () => {
    const text = buildGroupMotivationText({ rank: null, pointsToNextRank: null, nextRank: null }, labels);
    expect(text).toBe(labels.notRanked);
  });

  it('returns leading text for first rank', () => {
    const text = buildGroupMotivationText({ rank: 1, pointsToNextRank: null, nextRank: null }, labels);
    expect(text).toBe(labels.leading);
  });

  it('returns rank gap text with replacements', () => {
    const text = buildGroupMotivationText({ rank: 4, pointsToNextRank: 2, nextRank: 3 }, labels);
    expect(text).toBe('You are rank 4, 2 points away from rank 3.');
  });
});
