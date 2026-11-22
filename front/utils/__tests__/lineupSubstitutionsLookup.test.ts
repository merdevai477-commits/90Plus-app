import { collectLineupSubstitutions, lookupLineupPlayer } from '../lineupMatchState';
import type { FixtureEvent } from '../../services/apiFootball';

function player(
  id: number | string,
  name: string,
  photo = `https://imagecache.365scores.com/image/upload/Athletes/${id}`,
) {
  return { player: { id, name, number: 7, pos: 'M', photo } };
}

describe('lookupLineupPlayer', () => {
  const bench = [player(101, 'Phil Foden'), player(102, "Rico Lewis")];
  const xi = [player(201, 'Savinho'), player(202, 'Cherki')];

  it('matches by numeric id when event id is a string', () => {
    const hit = lookupLineupPlayer('101' as unknown as number, 'Foden', [bench, xi]);
    expect(hit.id).toBe(101);
    expect(hit.photo).toContain('Athletes/101');
  });

  it('matches by surname when event id is missing or wrong', () => {
    const hit = lookupLineupPlayer(null, 'Foden', [bench, xi]);
    expect(hit.id).toBe(101);
    expect(hit.photo).toContain('Athletes/101');
  });

  it('matches Arabic short names against full roster names', () => {
    const hit = lookupLineupPlayer(99999, 'فودين', [
      [player(101, 'فودين')],
      xi,
    ]);
    expect(hit.id).toBe(101);
  });
});

describe('collectLineupSubstitutions', () => {
  it('attaches roster photos to subbed-in players', () => {
    const events = [
      {
        type: 'subst',
        time: { elapsed: 64, extra: null },
        team: { id: 50, name: 'Man City' },
        player: { id: 0, name: 'Foden' },
        assist: { id: 0, name: 'Cherki' },
      },
    ] as unknown as FixtureEvent[];

    const rows = collectLineupSubstitutions(
      [player(202, 'Cherki')],
      [player(101, 'Phil Foden')],
      events,
      50,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].in.id).toBe(101);
    expect(rows[0].in.photo).toContain('Athletes/101');
    expect(rows[0].out.id).toBe(202);
  });
});
