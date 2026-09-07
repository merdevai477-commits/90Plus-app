import { extractMatchKickoffInfo, hasMatchKickoffFacts } from '../extractMatchKickoffInfo';

describe('extractMatchKickoffInfo', () => {
  it('prefers officials, venue extras, and local broadcast names', () => {
    const info = extractMatchKickoffInfo({
      fixture: {
        fixture: {
          referee: 'Fallback Ref',
          venue: { name: 'Anfield', city: null, capacity: 61276 },
        },
        _officials: ['Thomas Bramall', 'Fourth Official'],
        _tvNetworks: ['beIN Sport Max 1 HD', { name: 'beIN Sport Max 3 HD' }],
      },
      venue: { name: 'Anfield', image: 'https://img/anfield.jpg' },
    });

    expect(info).toMatchObject({
      stadiumName: 'Anfield',
      capacity: 61276,
      referee: 'Thomas Bramall',
      staff: 'Fourth Official',
      broadcast: 'beIN Sport Max 1 HD · beIN Sport Max 3 HD',
      stadiumImage: 'https://img/anfield.jpg',
    });
    expect(hasMatchKickoffFacts(info)).toBe(true);
  });

  it('is empty when the fixture has no preview facts', () => {
    expect(hasMatchKickoffFacts(extractMatchKickoffInfo({ fixture: null, venue: null }))).toBe(false);
  });
});
