import {
  hasPersonWikipediaSignal,
  isValidStadiumWikipediaSummary,
} from '../wikipedia-stadium-validation.util';

describe('isValidStadiumWikipediaSummary', () => {
  it('rejects a person page even when it has an image-like title', () => {
    expect(
      isValidStadiumWikipediaSummary({
        type: 'standard',
        title: 'Santiago Bernabéu',
        description: 'Spanish footballer (1895–1978)',
        latitude: null,
        longitude: null,
      }),
    ).toBe(false);
    expect(hasPersonWikipediaSignal('Spanish footballer (1895–1978)')).toBe(true);
  });

  it('accepts a stadium page with a venue description and coordinates', () => {
    expect(
      isValidStadiumWikipediaSummary({
        type: 'standard',
        title: 'Bernabéu (stadium)',
        description: 'Stadium in Madrid, Spain',
        latitude: 40.45306,
        longitude: -3.68835,
      }),
    ).toBe(true);
  });

  it('accepts a stadium description even without coordinates', () => {
    expect(
      isValidStadiumWikipediaSummary({
        type: 'standard',
        title: 'Anfield',
        description: 'Football stadium in Liverpool, England',
        latitude: null,
        longitude: null,
      }),
    ).toBe(true);
  });

  it('rejects an ambiguous page that has coordinates but no venue wording', () => {
    expect(
      isValidStadiumWikipediaSummary({
        type: 'standard',
        title: 'Barcelona',
        description: 'City in Catalonia, Spain',
        latitude: 41.38,
        longitude: 2.17,
      }),
    ).toBe(false);
  });

  it('rejects a title-only venue word when the description is ambiguous and coords are missing', () => {
    expect(
      isValidStadiumWikipediaSummary({
        type: 'standard',
        title: 'Bernabéu (stadium)',
        description: 'in Madrid, Spain',
        latitude: null,
        longitude: null,
      }),
    ).toBe(false);
  });

  it('accepts an ambiguous description when the title is a venue and coordinates are present', () => {
    expect(
      isValidStadiumWikipediaSummary({
        type: 'standard',
        title: 'Bernabéu (stadium)',
        description: 'in Madrid, Spain',
        latitude: 40.45306,
        longitude: -3.68835,
      }),
    ).toBe(true);
  });

  it('rejects president/manager pages', () => {
    expect(
      isValidStadiumWikipediaSummary({
        type: 'standard',
        title: 'Santiago Bernabéu',
        description: 'President of Real Madrid',
        latitude: 40.45,
        longitude: -3.68,
      }),
    ).toBe(false);
  });

  it('rejects a railway station even when coordinates exist', () => {
    expect(
      isValidStadiumWikipediaSummary({
        type: 'standard',
        title: 'Dortmund Signal-Iduna-Park station',
        description: 'Railway station in Dortmund, Germany',
        latitude: 51.49055556,
        longitude: 7.4575,
      }),
    ).toBe(false);
  });

  it('rejects disambiguation pages', () => {
    expect(
      isValidStadiumWikipediaSummary({
        type: 'disambiguation',
        title: 'Santiago Bernabéu (disambiguation)',
        description: 'Topics referred to by the same term',
      }),
    ).toBe(false);
  });
});
