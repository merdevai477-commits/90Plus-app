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
  it('keeps the big five, European nations, and continental tournaments', () => {
    expect(match('Premier League', 'Brentford', 'Bournemouth', 'England')).toBe(true);
    expect(match('La Liga', 'Getafe', 'Valencia', 'Spain')).toBe(true);
    expect(match('Serie A', 'Lecce', 'Cagliari', 'Italy')).toBe(true);
    expect(match('Bundesliga', 'Augsburg', 'Mainz', 'Germany')).toBe(true);
    expect(match('Ligue 1', 'Lorient', 'Auxerre', 'France')).toBe(true);
    expect(match('UEFA Champions League', 'Club Brugge', 'Benfica')).toBe(true);
    expect(match('UEFA Europa League', 'Fenerbahce', 'Rangers')).toBe(true);
    expect(match('CAF Champions League', 'Mamelodi Sundowns', 'Simba')).toBe(true);
    expect(match('CAF Confederation Cup', 'RSB Berkane', 'USM Alger')).toBe(true);
    expect(match('Copa Libertadores', 'Bolivar', 'The Strongest')).toBe(true);
    expect(match('UEFA Nations League', 'Croatia', 'Portugal')).toBe(true);
    expect(match('FIFA World Cup', 'France', 'Spain')).toBe(true);
    expect(match('Africa Cup of Nations', 'Egypt', 'Morocco')).toBe(true);
  });

  it('covers Scores365 country-prefixed Big 5 names and league ids', () => {
    expect(match('Germany, Bundesliga', 'Bayern Munich', '1. FC Köln', 'Germany')).toBe(true);
    expect(match('Spain, LaLiga', 'Athletic Bilbao', 'Espanyol', 'Spain')).toBe(true);
    expect(match('الدوري الألماني', 'بايرن', 'كولن', 'ألمانيا')).toBe(true);
    expect(match('الدوري الإسباني', 'برشلونة', 'مدريد', 'إسبانيا')).toBe(true);
    expect(
      isHighlightCoverageFixture({
        leagueId: 7000025,
        leagueName: 'Germany, Bundesliga',
        leagueCountry: 'Germany',
        homeTeamName: 'Bayern Munich',
        awayTeamName: '1. FC Köln',
      }),
    ).toBe(true);
    expect(
      isHighlightCoverageFixture({
        leagueId: 7000011,
        leagueName: 'Spain, LaLiga',
        leagueCountry: 'Spain',
        homeTeamName: 'Athletic Bilbao',
        awayTeamName: 'Espanyol',
      }),
    ).toBe(true);
  });

  it('follows only Ahly, Zamalek and Pyramids in Egypt, plus the named clubs elsewhere', () => {
    expect(match('Egyptian Premier League', 'Al Ahly', 'ENPPI', 'Egypt')).toBe(true);
    expect(match('Egyptian Premier League', 'Pyramids FC', 'Ceramica Cleopatra', 'Egypt')).toBe(true);
    expect(match('Egyptian Premier League', 'Ismaily', 'Al Masry', 'Egypt')).toBe(false);
    expect(match('Botola Pro', 'Wydad Casablanca', 'FAR Rabat', 'Morocco')).toBe(true);
    expect(match('Ligue Professionnelle 1', 'Espérance de Tunis', 'Club Africain', 'Tunisia')).toBe(true);
    expect(match('Saudi Pro League', 'Al Nassr', 'Al Fateh', 'Saudi Arabia')).toBe(true);
    expect(match('Saudi Pro League', 'Al Hilal', 'Al Khaleej', 'Saudi Arabia')).toBe(true);
    expect(match('Saudi Pro League', 'Al Ettifaq', 'Al Fayha', 'Saudi Arabia')).toBe(false);
    expect(match('Brasileiro Serie A', 'Flamengo', 'Bahia', 'Brazil')).toBe(true);
    expect(match('Brasileiro Serie A', 'Cuiaba', 'Vitoria', 'Brazil')).toBe(false);
    expect(match('Liga MX', 'Club America', 'Puebla', 'Mexico')).toBe(true);
    expect(match('MLS', 'Inter Miami', 'Atlanta United', 'USA')).toBe(true);
  });

  it('rejects women, youth, friendlies, and lookalike leagues', () => {
    expect(match("Women's Premier League", 'Chelsea', 'Arsenal', 'England')).toBe(false);
    expect(match('FIFA Women World Cup', 'Spain', 'England')).toBe(false);
    expect(match('الدوري المصري سيدات', 'الأهلي', 'الزمالك', 'Egypt')).toBe(false);
    expect(match('UEFA European U21 Championship', 'Spain U21', 'Germany U21')).toBe(false);
    expect(match('Friendlies', 'Al Ahly', 'Zamalek')).toBe(false);
    expect(match('Premier League', 'Ismaily', 'Al Masry', 'Egypt')).toBe(false);
    expect(match('Serie A', 'Cuiaba', 'Vitoria', 'Brazil')).toBe(false);
    expect(match('2. Bundesliga', 'Hamburg', 'Schalke', 'Germany')).toBe(false);
    expect(match('FA Cup', 'Brentford', 'Bournemouth', 'England')).toBe(false);
    expect(match('كأس العالم تحت 17', 'مصر تحت 17', 'اليونان تحت 17')).toBe(false);
    expect(match('دولي, كأس العالم تحت 17', 'السنغال تحت 17', 'كرواتيا تحت 17')).toBe(false);
    expect(match('ألمانيا, الدوري الألماني الدرجة الثانية', 'بيليفيلت', 'ماغديبورغ', 'Germany')).toBe(
      false,
    );
    expect(match('إسبانيا, الدوري الاسباني الدرجة الثانية', 'أندورا', 'ليجانيس', 'Spain')).toBe(false);
  });
});
