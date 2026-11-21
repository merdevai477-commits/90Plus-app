import { isHighlightCoverageFixture } from '../highlight-coverage';

function match(
  leagueName: string,
  home: string,
  away: string,
  leagueCountry: string | null = null,
): boolean {
  return isHighlightCoverageFixture({ leagueName, leagueCountry, homeTeamName: home, awayTeamName: away });
}

describe('highlight coverage', () => {
  it('covers top flights, cups, and continental tournaments', () => {
    expect(match('Premier League', 'Brentford', 'Bournemouth', 'England')).toBe(true);
    expect(match('La Liga', 'Getafe', 'Valencia', 'Spain')).toBe(true);
    expect(match('Serie A', 'Lecce', 'Cagliari', 'Italy')).toBe(true);
    expect(match('Bundesliga', 'Augsburg', 'Mainz', 'Germany')).toBe(true);
    expect(match('Ligue 1', 'Lorient', 'Auxerre', 'France')).toBe(true);
    expect(match('UEFA Champions League', 'Club Brugge', 'Benfica')).toBe(true);
    expect(match('UEFA Europa League', 'Fenerbahce', 'Rangers')).toBe(true);
    expect(match('CAF Champions League', 'Mamelodi Sundowns', 'Simba')).toBe(true);
    expect(match('Copa Libertadores', 'Bolivar', 'The Strongest')).toBe(true);
    expect(match('UEFA Nations League', 'Croatia', 'Portugal')).toBe(true);
    expect(match('FIFA World Cup', 'France', 'Spain')).toBe(true);
    expect(match('FA Cup', 'Brentford', 'Bournemouth', 'England')).toBe(true);
    expect(match('2. Bundesliga', 'Hamburg', 'Schalke', 'Germany')).toBe(true);
    expect(match('Friendlies', 'Al Ahly', 'Zamalek')).toBe(true);
  });

  it('covers Scores365 country-prefixed names, lower tiers, and all domestic leagues', () => {
    expect(match('Germany, Bundesliga', 'Bayern Munich', '1. FC Köln', 'Germany')).toBe(true);
    expect(match('Spain, LaLiga', 'Athletic Bilbao', 'Espanyol', 'Spain')).toBe(true);
    expect(match('الدوري الألماني', 'بايرن', 'كولن', 'ألمانيا')).toBe(true);
    expect(match('Egyptian Premier League', 'Ismaily', 'Al Masry', 'Egypt')).toBe(true);
    expect(match('Saudi Pro League', 'Al Ettifaq', 'Al Fayha', 'Saudi Arabia')).toBe(true);
    expect(match('Brasileiro Serie A', 'Cuiaba', 'Vitoria', 'Brazil')).toBe(true);
    expect(match('ألمانيا, الدوري الألماني الدرجة الثانية', 'بيليفيلت', 'ماغديبورغ', 'Germany')).toBe(
      true,
    );
    expect(
      isHighlightCoverageFixture({
        leagueId: 7000025,
        leagueName: 'Germany, Bundesliga',
        leagueCountry: 'Germany',
        homeTeamName: 'Bayern Munich',
        awayTeamName: '1. FC Köln',
      }),
    ).toBe(true);
  });

  it('rejects women, youth, and non-football competitions', () => {
    expect(match("Women's Premier League", 'Chelsea', 'Arsenal', 'England')).toBe(false);
    expect(match('FIFA Women World Cup', 'Spain', 'England')).toBe(false);
    expect(match('الدوري المصري سيدات', 'الأهلي', 'الزمالك', 'Egypt')).toBe(false);
    expect(match('UEFA European U21 Championship', 'Spain U21', 'Germany U21')).toBe(false);
    expect(match('كأس العالم تحت 17', 'مصر تحت 17', 'اليونان تحت 17')).toBe(false);
    expect(match('دولي, كأس العالم تحت 17', 'السنغال تحت 17', 'كرواتيا تحت 17')).toBe(false);
    expect(match('NCAAB D-I', 'Duke', 'North Carolina')).toBe(false);
    expect(match('NBA', 'Lakers', 'Celtics')).toBe(false);
  });
});
