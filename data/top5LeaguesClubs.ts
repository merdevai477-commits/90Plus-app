/**
 * Top 5 European Leagues Clubs
 * الدوريات الخمسة الكبرى
 *
 * ⚠️ APPLE COMPLIANCE: All clubs are fictional. Names, logos, and colors are original.
 * No real club names, logos, or trademarks are used.
 */

export interface TopClub {
    id: string;
    name: string;    // English name
    nameAr: string;  // Arabic name
    logo: string;    // Emoji badge - original design
    league: 'Premier League' | 'La Liga' | 'Serie A' | 'Bundesliga' | 'Ligue 1';
    country: string;
    color: string;
}

// ============ FICTIONAL CLUBS - ORIGINAL NAMES ============
// 5 fictional clubs with bilingual names and original emoji badges

export const TOP_5_LEAGUES_CLUBS: TopClub[] = [
    {
        id: 'golden-eagles-fc',
        name: 'Golden Eagles FC',
        nameAr: 'نادي النسور الذهبية',
        logo: '🦅',
        league: 'Premier League',
        country: 'England',
        color: '#FFD700',
    },
    {
        id: 'blue-wolves-united',
        name: 'Blue Wolves United',
        nameAr: 'الذئاب الزرقاء المتحدة',
        logo: '🐺',
        league: 'La Liga',
        country: 'Spain',
        color: '#1E90FF',
    },
    {
        id: 'red-lions-city',
        name: 'Red Lions City',
        nameAr: 'مدينة الأسود الحمراء',
        logo: '🦁',
        league: 'Serie A',
        country: 'Italy',
        color: '#DC143C',
    },
    {
        id: 'silver-falcons-sc',
        name: 'Silver Falcons SC',
        nameAr: 'نادي الصقور الفضية',
        logo: '🦆',
        league: 'Bundesliga',
        country: 'Germany',
        color: '#C0C0C0',
    },
    {
        id: 'green-dragons-fc',
        name: 'Green Dragons FC',
        nameAr: 'نادي التنانين الخضراء',
        logo: '🐉',
        league: 'Ligue 1',
        country: 'France',
        color: '#228B22',
    },
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
