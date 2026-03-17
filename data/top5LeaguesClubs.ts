/**
 * Top 5 European Leagues Clubs with Local Logos
 * الدوريات الخمسة الكبرى - أهم الأندية مع الشعارات المحلية
 * 
 * This file contains the most important clubs from the top 5 European leagues
 * with local logo URLs for offline support
 */

export interface TopClub {
    id: string;
    name: string;
    nameAr: string;
    logo: string; // Local logo URL
    league: 'Premier League' | 'La Liga' | 'Serie A' | 'Bundesliga' | 'Ligue 1';
    country: string;
    color: string;
    apiId?: number; // For future API integration
}

// ============ PREMIER LEAGUE (England) ============
const PREMIER_LEAGUE_CLUBS: TopClub[] = [
    {
        id: 'manchester-city',
        name: 'Manchester City',
        nameAr: 'مانشستر سيتي',
        logo: 'https://media.api-sports.io/football/teams/50.png',
        league: 'Premier League',
        country: 'England',
        color: '#6CABDD',
        apiId: 50
    },
    {
        id: 'arsenal',
        name: 'Arsenal',
        nameAr: 'أرسنال',
        logo: 'https://media.api-sports.io/football/teams/42.png',
        league: 'Premier League',
        country: 'England',
        color: '#EF0107',
        apiId: 42
    },
    {
        id: 'liverpool',
        name: 'Liverpool',
        nameAr: 'ليفربول',
        logo: 'https://media.api-sports.io/football/teams/40.png',
        league: 'Premier League',
        country: 'England',
        color: '#C8102E',
        apiId: 40
    },
    {
        id: 'manchester-united',
        name: 'Manchester United',
        nameAr: 'مانشستر يونايتد',
        logo: 'https://media.api-sports.io/football/teams/33.png',
        league: 'Premier League',
        country: 'England',
        color: '#DA020E',
        apiId: 33
    },
    {
        id: 'chelsea',
        name: 'Chelsea',
        nameAr: 'تشيلسي',
        logo: 'https://media.api-sports.io/football/teams/49.png',
        league: 'Premier League',
        country: 'England',
        color: '#034694',
        apiId: 49
    },
    {
        id: 'tottenham',
        name: 'Tottenham',
        nameAr: 'توتنهام',
        logo: 'https://media.api-sports.io/football/teams/47.png',
        league: 'Premier League',
        country: 'England',
        color: '#132257',
        apiId: 47
    },
    {
        id: 'newcastle',
        name: 'Newcastle United',
        nameAr: 'نيوكاسل يونايتد',
        logo: 'https://media.api-sports.io/football/teams/34.png',
        league: 'Premier League',
        country: 'England',
        color: '#241F20',
        apiId: 34
    },
    {
        id: 'aston-villa',
        name: 'Aston Villa',
        nameAr: 'أستون فيلا',
        logo: 'https://media.api-sports.io/football/teams/66.png',
        league: 'Premier League',
        country: 'England',
        color: '#95BFE5',
        apiId: 66
    },
];

// ============ LA LIGA (Spain) ============
const LA_LIGA_CLUBS: TopClub[] = [
    {
        id: 'real-madrid',
        name: 'Real Madrid',
        nameAr: 'ريال مدريد',
        logo: 'https://media.api-sports.io/football/teams/541.png',
        league: 'La Liga',
        country: 'Spain',
        color: '#FFFFFF',
        apiId: 541
    },
    {
        id: 'barcelona',
        name: 'FC Barcelona',
        nameAr: 'برشلونة',
        logo: 'https://media.api-sports.io/football/teams/529.png',
        league: 'La Liga',
        country: 'Spain',
        color: '#A50044',
        apiId: 529
    },
    {
        id: 'atletico-madrid',
        name: 'Atlético Madrid',
        nameAr: 'أتلتيكو مدريد',
        logo: 'https://media.api-sports.io/football/teams/530.png',
        league: 'La Liga',
        country: 'Spain',
        color: '#CB3524',
        apiId: 530
    },
    {
        id: 'sevilla',
        name: 'Sevilla',
        nameAr: 'إشبيلية',
        logo: 'https://media.api-sports.io/football/teams/536.png',
        league: 'La Liga',
        country: 'Spain',
        color: '#F43333',
        apiId: 536
    },
    {
        id: 'real-sociedad',
        name: 'Real Sociedad',
        nameAr: 'ريال سوسيداد',
        logo: 'https://media.api-sports.io/football/teams/548.png',
        league: 'La Liga',
        country: 'Spain',
        color: '#0A3A82',
        apiId: 548
    },
    {
        id: 'villarreal',
        name: 'Villarreal',
        nameAr: 'فياريال',
        logo: 'https://media.api-sports.io/football/teams/533.png',
        league: 'La Liga',
        country: 'Spain',
        color: '#FFE667',
        apiId: 533
    },
    {
        id: 'athletic-bilbao',
        name: 'Athletic Bilbao',
        nameAr: 'أتلتيك بلباو',
        logo: 'https://media.api-sports.io/football/teams/531.png',
        league: 'La Liga',
        country: 'Spain',
        color: '#EE2523',
        apiId: 531
    },
    {
        id: 'real-betis',
        name: 'Real Betis',
        nameAr: 'ريال بيتيس',
        logo: 'https://media.api-sports.io/football/teams/543.png',
        league: 'La Liga',
        country: 'Spain',
        color: '#00954C',
        apiId: 543
    },
];

// ============ SERIE A (Italy) ============
const SERIE_A_CLUBS: TopClub[] = [
    {
        id: 'inter-milan',
        name: 'Inter Milan',
        nameAr: 'إنتر ميلان',
        logo: 'https://media.api-sports.io/football/teams/505.png',
        league: 'Serie A',
        country: 'Italy',
        color: '#0068A8',
        apiId: 505
    },
    {
        id: 'ac-milan',
        name: 'AC Milan',
        nameAr: 'ميلان',
        logo: 'https://media.api-sports.io/football/teams/489.png',
        league: 'Serie A',
        country: 'Italy',
        color: '#FB090B',
        apiId: 489
    },
    {
        id: 'juventus',
        name: 'Juventus',
        nameAr: 'يوفنتوس',
        logo: 'https://media.api-sports.io/football/teams/496.png',
        league: 'Serie A',
        country: 'Italy',
        color: '#000000',
        apiId: 496
    },
    {
        id: 'napoli',
        name: 'Napoli',
        nameAr: 'نابولي',
        logo: 'https://media.api-sports.io/football/teams/492.png',
        league: 'Serie A',
        country: 'Italy',
        color: '#0067B5',
        apiId: 492
    },
    {
        id: 'roma',
        name: 'AS Roma',
        nameAr: 'روما',
        logo: 'https://media.api-sports.io/football/teams/497.png',
        league: 'Serie A',
        country: 'Italy',
        color: '#8B0304',
        apiId: 497
    },
    {
        id: 'lazio',
        name: 'Lazio',
        nameAr: 'لاتسيو',
        logo: 'https://media.api-sports.io/football/teams/487.png',
        league: 'Serie A',
        country: 'Italy',
        color: '#87D8F7',
        apiId: 487
    },
    {
        id: 'atalanta',
        name: 'Atalanta',
        nameAr: 'أتالانتا',
        logo: 'https://media.api-sports.io/football/teams/499.png',
        league: 'Serie A',
        country: 'Italy',
        color: '#1B5497',
        apiId: 499
    },
    {
        id: 'fiorentina',
        name: 'Fiorentina',
        nameAr: 'فيورنتينا',
        logo: 'https://media.api-sports.io/football/teams/502.png',
        league: 'Serie A',
        country: 'Italy',
        color: '#5D2E8C',
        apiId: 502
    },
];

// ============ BUNDESLIGA (Germany) ============
const BUNDESLIGA_CLUBS: TopClub[] = [
    {
        id: 'bayern-munich',
        name: 'Bayern Munich',
        nameAr: 'بايرن ميونخ',
        logo: 'https://media.api-sports.io/football/teams/157.png',
        league: 'Bundesliga',
        country: 'Germany',
        color: '#DC052D',
        apiId: 157
    },
    {
        id: 'borussia-dortmund',
        name: 'Borussia Dortmund',
        nameAr: 'بوروسيا دورتموند',
        logo: 'https://media.api-sports.io/football/teams/165.png',
        league: 'Bundesliga',
        country: 'Germany',
        color: '#FDE100',
        apiId: 165
    },
    {
        id: 'rb-leipzig',
        name: 'RB Leipzig',
        nameAr: 'لايبزيغ',
        logo: 'https://media.api-sports.io/football/teams/173.png',
        league: 'Bundesliga',
        country: 'Germany',
        color: '#DD0741',
        apiId: 173
    },
    {
        id: 'bayer-leverkusen',
        name: 'Bayer Leverkusen',
        nameAr: 'باير ليفركوزن',
        logo: 'https://media.api-sports.io/football/teams/168.png',
        league: 'Bundesliga',
        country: 'Germany',
        color: '#E32221',
        apiId: 168
    },
    {
        id: 'borussia-monchengladbach',
        name: 'Borussia M\'gladbach',
        nameAr: 'بوروسيا مونشنغلادباخ',
        logo: 'https://media.api-sports.io/football/teams/163.png',
        league: 'Bundesliga',
        country: 'Germany',
        color: '#000000',
        apiId: 163
    },
    {
        id: 'eintracht-frankfurt',
        name: 'Eintracht Frankfurt',
        nameAr: 'آينتراخت فرانكفورت',
        logo: 'https://media.api-sports.io/football/teams/169.png',
        league: 'Bundesliga',
        country: 'Germany',
        color: '#E1000F',
        apiId: 169
    },
    {
        id: 'vfb-stuttgart',
        name: 'VfB Stuttgart',
        nameAr: 'شتوتغارت',
        logo: 'https://media.api-sports.io/football/teams/160.png',
        league: 'Bundesliga',
        country: 'Germany',
        color: '#E32219',
        apiId: 160
    },
    {
        id: 'wolfsburg',
        name: 'VfL Wolfsburg',
        nameAr: 'فولفسبورغ',
        logo: 'https://media.api-sports.io/football/teams/178.png',
        league: 'Bundesliga',
        country: 'Germany',
        color: '#65B32E',
        apiId: 178
    },
];

// ============ LIGUE 1 (France) ============
const LIGUE_1_CLUBS: TopClub[] = [
    {
        id: 'psg',
        name: 'Paris Saint-Germain',
        nameAr: 'باريس سان جيرمان',
        logo: 'https://media.api-sports.io/football/teams/85.png',
        league: 'Ligue 1',
        country: 'France',
        color: '#004170',
        apiId: 85
    },
    {
        id: 'marseille',
        name: 'Olympique Marseille',
        nameAr: 'مارسيليا',
        logo: 'https://media.api-sports.io/football/teams/81.png',
        league: 'Ligue 1',
        country: 'France',
        color: '#2FAEE0',
        apiId: 81
    },
    {
        id: 'lyon',
        name: 'Olympique Lyon',
        nameAr: 'ليون',
        logo: 'https://media.api-sports.io/football/teams/80.png',
        league: 'Ligue 1',
        country: 'France',
        color: '#DA020E',
        apiId: 80
    },
    {
        id: 'monaco',
        name: 'AS Monaco',
        nameAr: 'موناكو',
        logo: 'https://media.api-sports.io/football/teams/91.png',
        league: 'Ligue 1',
        country: 'France',
        color: '#E2001A',
        apiId: 91
    },
    {
        id: 'lille',
        name: 'Lille OSC',
        nameAr: 'ليل',
        logo: 'https://media.api-sports.io/football/teams/79.png',
        league: 'Ligue 1',
        country: 'France',
        color: '#E30613',
        apiId: 79
    },
    {
        id: 'nice',
        name: 'OGC Nice',
        nameAr: 'نيس',
        logo: 'https://media.api-sports.io/football/teams/82.png',
        league: 'Ligue 1',
        country: 'France',
        color: '#ED1C24',
        apiId: 82
    },
    {
        id: 'lens',
        name: 'RC Lens',
        nameAr: 'لانس',
        logo: 'https://media.api-sports.io/football/teams/116.png',
        league: 'Ligue 1',
        country: 'France',
        color: '#FFC600',
        apiId: 116
    },
    {
        id: 'rennes',
        name: 'Stade Rennais',
        nameAr: 'رين',
        logo: 'https://media.api-sports.io/football/teams/94.png',
        league: 'Ligue 1',
        country: 'France',
        color: '#E30613',
        apiId: 94
    },
];

// ============ COMBINED EXPORT ============
export const TOP_5_LEAGUES_CLUBS: TopClub[] = [
    ...PREMIER_LEAGUE_CLUBS,
    ...LA_LIGA_CLUBS,
    ...SERIE_A_CLUBS,
    ...BUNDESLIGA_CLUBS,
    ...LIGUE_1_CLUBS,
];

// Helper functions
export const getClubsByLeague = (league: string): TopClub[] => {
    return TOP_5_LEAGUES_CLUBS.filter(club => club.league === league);
};

export const getClubById = (id: string): TopClub | undefined => {
    return TOP_5_LEAGUES_CLUBS.find(club => club.id === id);
};

export const getClubByName = (name: string): TopClub | undefined => {
    return TOP_5_LEAGUES_CLUBS.find(
        club => club.name.toLowerCase() === name.toLowerCase() || 
                club.nameAr === name
    );
};

export const getAllLeagues = (): string[] => {
    return ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1'];
};
