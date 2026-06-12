export interface League {
    id: number;
    name: string;
    nameAr: string;
    logo: string;
    country: string;
    countryFlag: string;
}

export const LEAGUES: League[] = [
    // Top European Leagues
    { id: 39, name: 'Premier League', nameAr: 'الدوري الإنجليزي', logo: 'https://media.api-sports.io/football/leagues/39.png', country: 'England', countryFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { id: 140, name: 'La Liga', nameAr: 'الدوري الإسباني', logo: 'https://media.api-sports.io/football/leagues/140.png', country: 'Spain', countryFlag: '🇪🇸' },
    { id: 135, name: 'Serie A', nameAr: 'الدوري الإيطالي', logo: 'https://media.api-sports.io/football/leagues/135.png', country: 'Italy', countryFlag: '🇮🇹' },
    { id: 78, name: 'Bundesliga', nameAr: 'الدوري الألماني', logo: 'https://media.api-sports.io/football/leagues/78.png', country: 'Germany', countryFlag: '🇩🇪' },
    { id: 61, name: 'Ligue 1', nameAr: 'الدوري الفرنسي', logo: 'https://media.api-sports.io/football/leagues/61.png', country: 'France', countryFlag: '🇫🇷' },
    { id: 94, name: 'Primeira Liga', nameAr: 'الدوري البرتغالي', logo: 'https://media.api-sports.io/football/leagues/94.png', country: 'Portugal', countryFlag: '🇵🇹' },
    { id: 88, name: 'Eredivisie', nameAr: 'الدوري الهولندي', logo: 'https://media.api-sports.io/football/leagues/88.png', country: 'Netherlands', countryFlag: '🇳🇱' },
    
    // UEFA Competitions
    { id: 2, name: 'UEFA Champions League', nameAr: 'دوري أبطال أوروبا', logo: 'https://media.api-sports.io/football/leagues/2.png', country: 'Europe', countryFlag: '🇪🇺' },
    { id: 3, name: 'UEFA Europa League', nameAr: 'الدوري الأوروبي', logo: 'https://media.api-sports.io/football/leagues/3.png', country: 'Europe', countryFlag: '🇪🇺' },
    
    // Arab Leagues
    { id: 233, name: 'Egyptian Premier League', nameAr: 'الدوري المصري', logo: 'https://media.api-sports.io/football/leagues/233.png', country: 'Egypt', countryFlag: '🇪🇬' },
    { id: 307, name: 'Saudi Pro League', nameAr: 'دوري روشن السعودي', logo: 'https://media.api-sports.io/football/leagues/307.png', country: 'Saudi Arabia', countryFlag: '🇸🇦' },
    { id: 551, name: 'UAE Pro League', nameAr: 'دوري الخليج العربي', logo: 'https://media.api-sports.io/football/leagues/551.png', country: 'UAE', countryFlag: '🇦🇪' },
    { id: 536, name: 'Qatar Stars League', nameAr: 'دوري نجوم قطر', logo: 'https://media.api-sports.io/football/leagues/536.png', country: 'Qatar', countryFlag: '🇶🇦' },
    { id: 200, name: 'Botola Pro', nameAr: 'الدوري المغربي', logo: 'https://media.api-sports.io/football/leagues/200.png', country: 'Morocco', countryFlag: '🇲🇦' },
    { id: 202, name: 'Ligue 1 Tunisia', nameAr: 'الدوري التونسي', logo: 'https://media.api-sports.io/football/leagues/202.png', country: 'Tunisia', countryFlag: '🇹🇳' },
    { id: 201, name: 'Ligue 1 Algeria', nameAr: 'الدوري الجزائري', logo: 'https://media.api-sports.io/football/leagues/201.png', country: 'Algeria', countryFlag: '🇩🇿' },
    { id: 357, name: 'Iraqi Premier League', nameAr: 'الدوري العراقي', logo: 'https://media.api-sports.io/football/leagues/357.png', country: 'Iraq', countryFlag: '🇮🇶' },
    { id: 366, name: 'Jordanian Pro League', nameAr: 'الدوري الأردني', logo: 'https://media.api-sports.io/football/leagues/366.png', country: 'Jordan', countryFlag: '🇯🇴' },
    
    // Other Popular Leagues
    { id: 203, name: 'Turkish Süper Lig', nameAr: 'الدوري التركي', logo: 'https://media.api-sports.io/football/leagues/203.png', country: 'Turkey', countryFlag: '🇹🇷' },
    { id: 71, name: 'Brasileirão', nameAr: 'الدوري البرازيلي', logo: 'https://media.api-sports.io/football/leagues/71.png', country: 'Brazil', countryFlag: '🇧🇷' },
    { id: 128, name: 'Liga Argentina', nameAr: 'الدوري الأرجنتيني', logo: 'https://media.api-sports.io/football/leagues/128.png', country: 'Argentina', countryFlag: '🇦🇷' },

    // Oceania / Asia / Americas
    { id: 188, name: 'A-League', nameAr: 'الدوري الأسترالي', logo: 'https://media.api-sports.io/football/leagues/188.png', country: 'Australia', countryFlag: '🇦🇺' },
    { id: 98, name: 'J1 League', nameAr: 'الدوري الياباني', logo: 'https://media.api-sports.io/football/leagues/98.png', country: 'Japan', countryFlag: '🇯🇵' },
    { id: 253, name: 'Major League Soccer', nameAr: 'الدوري الأمريكي', logo: 'https://media.api-sports.io/football/leagues/253.png', country: 'USA', countryFlag: '🇺🇸' },
    { id: 262, name: 'Liga MX', nameAr: 'الدوري المكسيكي', logo: 'https://media.api-sports.io/football/leagues/262.png', country: 'Mexico', countryFlag: '🇲🇽' },

    // UK secondary
    { id: 40, name: 'Championship', nameAr: 'الدرجة الأولى الإنجليزية', logo: 'https://media.api-sports.io/football/leagues/40.png', country: 'England', countryFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { id: 179, name: 'Premiership', nameAr: 'الدوري الاسكتلندي', logo: 'https://media.api-sports.io/football/leagues/179.png', country: 'Scotland', countryFlag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
];
