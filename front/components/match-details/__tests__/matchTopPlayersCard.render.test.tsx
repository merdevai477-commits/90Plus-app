/**
 * Top Players card on the pre-kickoff Events tab.
 *
 *   npx jest -c jest.render.config.js matchTopPlayersCard.render
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Competitor365Stats } from '../../../services/apiFootball';

const homeStats: Competitor365Stats = {
  competitionId: 1,
  leaderboards: [
    {
      key: 1,
      name: 'Goals',
      rows: [
        {
          rank: 1,
          athleteId: 10,
          name: 'Kylian Mbappe',
          photo: null,
          value: '8',
          competitorId: 1,
          leftClub: false,
          positionName: 'Forward',
        },
      ],
    },
  ],
};

const awayStats: Competitor365Stats = {
  competitionId: 1,
  leaderboards: [
    {
      key: 1,
      name: 'Goals',
      rows: [
        {
          rank: 1,
          athleteId: 20,
          name: 'Lautaro Martinez',
          photo: null,
          value: '6',
          competitorId: 2,
          leftClub: false,
          positionName: 'Forward',
        },
      ],
    },
  ],
};

jest.mock('../../../hooks/useTeamProfile', () => ({
  useCompetitorStats: (competitorId: number) => ({
    data: competitorId === 1 ? homeStats : awayStats,
    isLoading: false,
    isFetched: true,
  }),
  useCompetitorSquad: () => ({
    data: null,
    isLoading: false,
    isFetched: true,
  }),
}));

import { MatchTopPlayersCard } from '../MatchTopPlayersCard';

const labels = {
  title: 'Top Players',
  attack: 'Attack',
  midfield: 'Midfield',
  defense: 'Defense',
  goals: 'Goals',
  assists: 'Assists',
  rating: 'Rating',
};

describe('MatchTopPlayersCard', () => {
  it('renders featured attackers and switches tabs', () => {
    const onOpenPlayer = jest.fn();
    render(
      <MatchTopPlayersCard
        homeCompetitorId={1}
        awayCompetitorId={2}
        competitionId={1}
        homeTeam={{ id: 1, name: 'France' }}
        awayTeam={{ id: 2, name: 'Argentina' }}
        rtl={false}
        labels={labels}
        onOpenPlayer={onOpenPlayer}
      />,
    );

    expect(screen.getByTestId('match-top-players')).toBeTruthy();
    expect(screen.getByText('Top Players')).toBeTruthy();
    expect(screen.getByText('Kylian Mbappe')).toBeTruthy();
    expect(screen.getByText('Lautaro Martinez')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();

    fireEvent.press(screen.getByTestId('top-players-tab-midfield'));
    expect(screen.getByText('Midfield')).toBeTruthy();
  });
});
