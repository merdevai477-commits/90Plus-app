import {
  cityFrom365VenueName,
  map365OfficialNames,
  map365VenueFields,
  pick365BroadcastNames,
  scores365VenueImageUrl,
} from '../scores365-match-info.util';

describe('scores365 match info', () => {
  it('pulls a city from a parenthetical venue name', () => {
    expect(cityFrom365VenueName('BC Place (Vancouver)')).toBe('Vancouver');
    expect(cityFrom365VenueName('Anfield')).toBeNull();
  });

  it('maps venue capacity and image', () => {
    expect(
      map365VenueFields({
        id: 1023,
        name: 'Anfield',
        capacity: 61276,
      }),
    ).toEqual({
      id: 1023,
      name: 'Anfield',
      city: null,
      capacity: 61276,
      attendance: null,
      image: scores365VenueImageUrl(1023),
    });
  });

  it('keeps official names in order and prefers local TV channels', () => {
    expect(map365OfficialNames([{ name: 'Thomas Bramall' }, { name: ' Thomas Bramall ' }])).toEqual([
      'Thomas Bramall',
    ]);
    expect(
      pick365BroadcastNames(
        [
          { name: 'Sky Sports', countryId: 1 },
          { name: 'beIN Sport Max 1 HD', countryId: 131 },
          { name: 'beIN Sport Max 3 HD', countryId: 131 },
        ],
        131,
        3,
      ),
    ).toEqual(['beIN Sport Max 1 HD', 'beIN Sport Max 3 HD']);
  });
});
