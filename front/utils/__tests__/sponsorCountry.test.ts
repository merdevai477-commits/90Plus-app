import {
  PALESTINE_ISO,
  parseCountryIsoFromAddress,
  remapSponsorCountryIso,
  resolveSponsorCountryIso,
  getSponsorCountryFlagUri,
} from '../sponsorCountry';

describe('sponsorCountry', () => {
  it('remaps geocoder Israel ISO to Palestine', () => {
    expect(remapSponsorCountryIso('IL')).toBe(PALESTINE_ISO);
    expect(remapSponsorCountryIso('il')).toBe(PALESTINE_ISO);
    expect(remapSponsorCountryIso('Israel')).toBe(PALESTINE_ISO);
    expect(remapSponsorCountryIso('إسرائيل')).toBe(PALESTINE_ISO);
  });

  it('keeps other countries', () => {
    expect(remapSponsorCountryIso('EG')).toBe('eg');
    expect(remapSponsorCountryIso('Egypt')).toBe('eg');
    expect(remapSponsorCountryIso('مصر')).toBe('eg');
    expect(remapSponsorCountryIso('SA')).toBe('sa');
  });

  it('parses Israel from a Google formatted address as Palestine', () => {
    expect(parseCountryIsoFromAddress('Tel Aviv-Yafo, Israel')).toBe(PALESTINE_ISO);
    expect(parseCountryIsoFromAddress('يافا، إسرائيل')).toBe(PALESTINE_ISO);
  });

  it('does not treat US state IL as Israel', () => {
    expect(parseCountryIsoFromAddress('Chicago, IL')).toBeNull();
    expect(
      resolveSponsorCountryIso({
        address: 'Chicago, IL',
        socialLinks: { phoneCountryId: 'egypt' },
      }),
    ).toBe('eg');
  });

  it('parses Palestine and Gaza as Palestine', () => {
    expect(parseCountryIsoFromAddress('Gaza Strip')).toBe(PALESTINE_ISO);
    expect(parseCountryIsoFromAddress('رام الله، الضفة الغربية')).toBe(PALESTINE_ISO);
    expect(parseCountryIsoFromAddress('Nablus, Palestine')).toBe(PALESTINE_ISO);
  });

  it('parses a normal country from the last address segment', () => {
    expect(parseCountryIsoFromAddress('التحرير، القاهرة، مصر')).toBe('eg');
    expect(parseCountryIsoFromAddress('Riyadh, Saudi Arabia')).toBe('sa');
  });

  it('prefers location over phone country, and Israel location always wins as Palestine', () => {
    expect(
      resolveSponsorCountryIso({
        address: 'Tel Aviv, Israel',
        socialLinks: { phoneCountryId: 'egypt' },
      }),
    ).toBe(PALESTINE_ISO);

    expect(
      resolveSponsorCountryIso({
        address: 'Cairo, Egypt',
        socialLinks: { phoneCountryId: 'palestine' },
      }),
    ).toBe('eg');
  });

  it('uses stored geocoder countryCode, remapping IL', () => {
    expect(
      resolveSponsorCountryIso({
        address: 'Unknown street 12',
        socialLinks: { countryCode: 'IL', phoneCountryId: 'egypt' },
      }),
    ).toBe(PALESTINE_ISO);

    expect(
      resolveSponsorCountryIso({
        address: 'Unknown street 12',
        socialLinks: { countryCode: 'ae' },
      }),
    ).toBe('ae');
  });

  it('falls back to the advertiser phone country', () => {
    expect(
      resolveSponsorCountryIso({
        address: 'المساحة، ج. سحن',
        socialLinks: { phoneCountryId: 'palestine' },
      }),
    ).toBe(PALESTINE_ISO);
  });

  it('returns a Palestine flagcdn URL for Israel locations', () => {
    const uri = getSponsorCountryFlagUri({
      address: 'Haifa, Israel',
    });
    expect(uri).toEqual(expect.stringContaining('/ps.png'));
  });

  it('returns an Egypt flagcdn URL for Egyptian addresses', () => {
    const uri = getSponsorCountryFlagUri({
      address: 'التحرير، القاهرة، مصر',
    });
    expect(uri).toEqual(expect.stringContaining('/eg.png'));
  });
});
