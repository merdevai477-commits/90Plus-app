import { followedTeamsEqual, type StoredFollowedTeam } from '../../src/storage/teamFavorites.storage';

const row = (partial: Partial<StoredFollowedTeam> = {}): StoredFollowedTeam => ({
    apiTeamId: 131,
    teamName: 'Real Madrid',
    teamLogo: 'https://logo/rm.png',
    country: 'Spain',
    ...partial,
});

describe('followedTeamsEqual', () => {
    it('treats identical lists as unchanged so loaders can skip setState', () => {
        const a = [row(), row({ apiTeamId: 132, teamName: 'Barcelona' })];
        const b = [row(), row({ apiTeamId: 132, teamName: 'Barcelona' })];
        expect(followedTeamsEqual(a, b)).toBe(true);
    });

    it('detects id / name / logo / country changes', () => {
        expect(followedTeamsEqual([row()], [row({ apiTeamId: 1 })])).toBe(false);
        expect(followedTeamsEqual([row()], [row({ teamName: 'RM' })])).toBe(false);
        expect(followedTeamsEqual([row()], [row({ teamLogo: null })])).toBe(false);
        expect(followedTeamsEqual([row()], [row({ country: 'ES' })])).toBe(false);
        expect(followedTeamsEqual([row()], [])).toBe(false);
        expect(followedTeamsEqual(null, [])).toBe(true);
    });
});
