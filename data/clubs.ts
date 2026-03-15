export interface Club {
    id: string;
    name: string;
    logo: string;
    league: string;
    country: string;
    color: string;
    apiId?: number; // API-Football team ID for fetching real logo
}

// الأندية الـ 10 الكبرى في العالم + الأندية العربية المشهورة
// Top 10 biggest clubs in the world + popular Arab clubs
// Logos will be fetched from API-Football using apiId

// أكبر 10 أندية في أوروبا
// Top 10 biggest clubs in Europe
// Logos will be fetched from API-Football using apiId

export const CLUBS: Club[] = [
    // ============ TOP 10 BIGGEST CLUBS IN EUROPE ============
    { id: 'real-madrid', name: 'Real Madrid', logo: '', league: 'La Liga', country: 'Spain', color: '#FFFFFF', apiId: 541 },
    { id: 'barcelona', name: 'FC Barcelona', logo: '', league: 'La Liga', country: 'Spain', color: '#A50044', apiId: 529 },
    { id: 'manchester-united', name: 'Manchester United', logo: '', league: 'Premier League', country: 'England', color: '#DA020E', apiId: 33 },
    { id: 'liverpool', name: 'Liverpool FC', logo: '', league: 'Premier League', country: 'England', color: '#C8102E', apiId: 40 },
    { id: 'bayern-munich', name: 'Bayern Munich', logo: '', league: 'Bundesliga', country: 'Germany', color: '#DC052D', apiId: 157 },
    { id: 'juventus', name: 'Juventus', logo: '', league: 'Serie A', country: 'Italy', color: '#000000', apiId: 496 },
    { id: 'psg', name: 'Paris Saint-Germain', logo: '', league: 'Ligue 1', country: 'France', color: '#004170', apiId: 85 },
    { id: 'manchester-city', name: 'Manchester City', logo: '', league: 'Premier League', country: 'England', color: '#6CABDD', apiId: 50 },
    { id: 'chelsea', name: 'Chelsea FC', logo: '', league: 'Premier League', country: 'England', color: '#034694', apiId: 49 },
    { id: 'arsenal', name: 'Arsenal FC', logo: '', league: 'Premier League', country: 'England', color: '#EF0107', apiId: 42 },
];
