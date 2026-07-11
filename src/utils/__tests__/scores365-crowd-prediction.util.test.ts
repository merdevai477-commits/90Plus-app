import { extractScores365CrowdWinPrediction } from '../../utils/scores365-crowd-prediction.util';

describe('extractScores365CrowdWinPrediction', () => {
  const game = {
    id: 1,
    promotedPredictions: {
      predictions: [
        {
          type: 1,
          title: 'Who Will Win?',
          totalVotes: 1000,
          options: [
            { num: 1, name: 'Home', vote: { percentage: 42.2, count: 422 } },
            { num: 2, name: 'Draw', vote: { percentage: 8.1, count: 81 } },
            { num: 3, name: 'Away', vote: { percentage: 49.7, count: 497 } },
          ],
        },
      ],
    },
  };

  it('extracts rounded home/draw/away percentages', () => {
    expect(extractScores365CrowdWinPrediction(game)).toEqual({
      homePercent: 42,
      drawPercent: 8,
      awayPercent: 50,
      totalVotes: 1000,
    });
  });

  it('swaps home/away when teams are aligned swapped', () => {
    expect(extractScores365CrowdWinPrediction(game, { swapped: true })).toEqual({
      homePercent: 50,
      drawPercent: 8,
      awayPercent: 42,
      totalVotes: 1000,
    });
  });

  it('returns null when Who Will Win is missing', () => {
    expect(extractScores365CrowdWinPrediction({ id: 2, promotedPredictions: { predictions: [] } })).toBeNull();
  });
});
