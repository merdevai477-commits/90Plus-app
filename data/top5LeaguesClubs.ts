/**
 * Top 5 European Leagues Clubs
 * الدوريات الخمسة الكبرى
 * 
 * ⚠️ APPLE COMPLIANCE: Club names are factual sports data (allowed).
 * Logos use emoji instead of trademarked images.
 */

export interface TopClub {
    id: string;
    name: string;
    nameAr: string;
    logo: string; // Emoji - no trademarked images
    league: 'Premier League' | 'La Liga' | 'Serie A' | 'Bundesliga' | 'Ligue 1';
    country: string;
    color: string;
    apiId?: number;
}

// ============ PREMIER LEAGUE ============
const PREMIER_LEAGUE_CLUBS: TopClub[] = [
    { id: 'manchester-city',    name: 'Manchester City',    nameAr: 'مانشستر سيتي',       logo: '🔵', league: 'Premier League', country: 'England', color: '#6CABDD', apiId: 50 },
    { id: 'arsenal',            name: 'Arsenal',            nameAr: 'أرسنال',              logo: '🔴', league: 'Premier League', country: 'England', color: '#EF0107', apiId: 42 },
    { id: 'liverpool',          name: 'Liverpool',          nameAr: 'ليفربول',             logo: '🔴', league: 'Premier League', country: 'England', color: '#C8102E', apiId: 40 },
    { id: 'manchester-united',  name: 'Manchester United',  nameAr: 'مانشستر يونايتد',    logo: '🔴', league: 'Premier League', country: 'England', color: '#DA020E', apiId: 33 },
    { id: 'chelsea',            name: 'Chelsea',            nameAr: 'تشيلسي',             logo: '🔵', league: 'Premier League', country: 'England', color: '#034694', apiId: 49 },
    { id: 'tottenham',          name: 'Tottenham',          nameAr: 'توتنهام',             logo: '⚪', league: 'Premier League', country: 'England', color: '#132257', apiId: 47 },
    { id: 'newcastle',          name: 'Newcastle United',   nameAr: 'نيوكاسل يونايتد',   logo: '⚫', league: 'Premier League', country: 'England', color: '#241F20', apiId: 34 },
    { id: 'aston-villa',        name: 'Aston Villa',        nameAr: 'أستون فيلا',         logo: '🟣', league: 'Premier League', country: 'England', color: '#95BFE5', apiId: 66 },
];

// ============ LA LIGA ============
const LA_LIGA_CLUBS: TopClub[] = [
    { id: 'real-madrid',        name: 'Real Madrid',        nameAr: 'ريال مدريد',         logo: '⚪', league: 'La Liga', country: 'Spain', color: '#FEBE10', apiId: 541 },
    { id: 'barcelona',          name: 'FC Barcelona',       nameAr: 'برشلونة',            logo: '🔵', league: 'La Liga', country: 'Spain', color: '#A50044', apiId: 529 },
    { id: 'atletico-madrid',    name: 'Atlético Madrid',    nameAr: 'أتلتيكو مدريد',     logo: '🔴', league: 'La Liga', country: 'Spain', color: '#CB3524', apiId: 530 },
    { id: 'sevilla',            name: 'Sevilla',            nameAr: 'إشبيلية',            logo: '⚪', league: 'La Liga', country: 'Spain', color: '#F43333', apiId: 536 },
    { id: 'real-sociedad',      name: 'Real Sociedad',      nameAr: 'ريال سوسيداد',      logo: '🔵', league: 'La Liga', country: 'Spain', color: '#0A3A82', apiId: 548 },
    { id: 'villarreal',         name: 'Villarreal',         nameAr: 'فياريال',            logo: '🟡', league: 'La Liga', country: 'Spain', color: '#FFE667', apiId: 533 },
    { id: 'athletic-bilbao',    name: 'Athletic Bilbao',    nameAr: 'أتلتيك بلباو',      logo: '🔴', league: 'La Liga', country: 'Spain', color: '#EE2523', apiId: 531 },
    { id: 'real-betis',         name: 'Real Betis',         nameAr: 'ريال بيتيس',        logo: '🟢', league: 'La Liga', country: 'Spain', color: '#00954C', apiId: 543 },
];

// ============ SERIE A ============
const SERIE_A_CLUBS: TopClub[] = [
    { id: 'inter-milan',        name: 'Inter Milan',        nameAr: 'إنتر ميلان',        logo: '🔵', league: 'Serie A', country: 'Italy', color: '#0068A8', apiId: 505 },
    { id: 'ac-milan',           name: 'AC Milan',           nameAr: 'ميلان',              logo: '🔴', league: 'Serie A', country: 'Italy', color: '#FB090B', apiId: 489 },
    { id: 'juventus',           name: 'Juventus',           nameAr: 'يوفنتوس',           logo: '⚫', league: 'Serie A', country: 'Italy', color: '#000000', apiId: 496 },
    { id: 'napoli',             name: 'Napoli',             nameAr: 'نابولي',             logo: '🔵', league: 'Serie A', country: 'Italy', color: '#0067B5', apiId: 492 },
    { id: 'roma',               name: 'AS Roma',            nameAr: 'روما',               logo: '🔴', league: 'Serie A', country: 'Italy', color: '#8B0304', apiId: 497 },
    { id: 'lazio',              name: 'Lazio',              nameAr: 'لاتسيو',             logo: '🔵', league: 'Serie A', country: 'Italy', color: '#87D8F7', apiId: 487 },
    { id: 'atalanta',           name: 'Atalanta',           nameAr: 'أتالانتا',          logo: '🔵', league: 'Serie A', country: 'Italy', color: '#1B5497', apiId: 499 },
    { id: 'fiorentina',         name: 'Fiorentina',         nameAr: 'فيورنتينا',         logo: '🟣', league: 'Serie A', country: 'Italy', color: '#5D2E8C', apiId: 502 },
];

// ============ BUNDESLIGA ============
const BUNDESLIGA_CLUBS: TopClub[] = [
    { id: 'bayern-munich',              name: 'Bayern Munich',          nameAr: 'بايرن ميونخ',              logo: '🔴', league: 'Bundesliga', country: 'Germany', color: '#DC052D', apiId: 157 },
    { id: 'borussia-dortmund',          name: 'Borussia Dortmund',      nameAr: 'بوروسيا دورتموند',         logo: '🟡', league: 'Bundesliga', country: 'Germany', color: '#FDE100', apiId: 165 },
    { id: 'rb-leipzig',                 name: 'RB Leipzig',             nameAr: 'لايبزيغ',                  logo: '🔴', league: 'Bundesliga', country: 'Germany', color: '#DD0741', apiId: 173 },
    { id: 'bayer-leverkusen',           name: 'Bayer Leverkusen',       nameAr: 'باير ليفركوزن',            logo: '🔴', league: 'Bundesliga', country: 'Germany', color: '#E32221', apiId: 168 },
    { id: 'borussia-monchengladbach',   name: "Borussia M'gladbach",    nameAr: 'بوروسيا مونشنغلادباخ',    logo: '⚫', league: 'Bundesliga', country: 'Germany', color: '#000000', apiId: 163 },
    { id: 'eintracht-frankfurt',        name: 'Eintracht Frankfurt',    nameAr: 'آينتراخت فرانكفورت',      logo: '🔴', league: 'Bundesliga', country: 'Germany', color: '#E1000F', apiId: 169 },
    { id: 'vfb-stuttgart',              name: 'VfB Stuttgart',          nameAr: 'شتوتغارت',                 logo: '🔴', league: 'Bundesliga', country: 'Germany', color: '#E32219', apiId: 160 },
    { id: 'wolfsburg',                  name: 'VfL Wolfsburg',          nameAr: 'فولفسبورغ',                logo: '🟢', league: 'Bundesliga', country: 'Germany', color: '#65B32E', apiId: 178 },
];

// ============ LIGUE 1 ============
const LIGUE_1_CLUBS: TopClub[] = [
    { id: 'psg',        name: 'Paris Saint-Germain', nameAr: 'باريس سان جيرمان', logo: '🔵', league: 'Ligue 1', country: 'France', color: '#004170', apiId: 85 },
    { id: 'marseille',  name: 'Olympique Marseille', nameAr: 'مارسيليا',          logo: '🔵', league: 'Ligue 1', country: 'France', color: '#2FAEE0', apiId: 81 },
    { id: 'lyon',       name: 'Olympique Lyon',      nameAr: 'ليون',              logo: '🔴', league: 'Ligue 1', country: 'France', color: '#DA020E', apiId: 80 },
    { id: 'monaco',     name: 'AS Monaco',           nameAr: 'موناكو',            logo: '🔴', league: 'Ligue 1', country: 'France', color: '#E2001A', apiId: 91 },
    { id: 'lille',      name: 'Lille OSC',           nameAr: 'ليل',               logo: '🔴', league: 'Ligue 1', country: 'France', color: '#E30613', apiId: 79 },
    { id: 'nice',       name: 'OGC Nice',            nameAr: 'نيس',               logo: '🔴', league: 'Ligue 1', country: 'France', color: '#ED1C24', apiId: 82 },
    { id: 'lens',       name: 'RC Lens',             nameAr: 'لانس',              logo: '🟡', league: 'Ligue 1', country: 'France', color: '#FFC600', apiId: 116 },
    { id: 'rennes',     name: 'Stade Rennais',       nameAr: 'رين',               logo: '🔴', league: 'Ligue 1', country: 'France', color: '#E30613', apiId: 94 },
];

// ============ EXPORTS ============
export const TOP_5_LEAGUES_CLUBS: TopClub[] = [
    ...PREMIER_LEAGUE_CLUBS,
    ...LA_LIGA_CLUBS,
    ...SERIE_A_CLUBS,
    ...BUNDESLIGA_CLUBS,
    ...LIGUE_1_CLUBS,
];

export const getClubsByLeague = (league: string): TopClub[] =>
    TOP_5_LEAGUES_CLUBS.filter(club => club.league === league);

export const getClubById = (id: string): TopClub | undefined =>
    TOP_5_LEAGUES_CLUBS.find(club => club.id === id);

export const getClubByName = (name: string): TopClub | undefined =>
    TOP_5_LEAGUES_CLUBS.find(
        club => club.name.toLowerCase() === name.toLowerCase() || club.nameAr === name
    );

export const getAllLeagues = (): string[] =>
    ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1'];
