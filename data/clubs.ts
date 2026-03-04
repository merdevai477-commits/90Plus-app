export interface Club {
    id: string;
    name: string;
    logo: string;
    league: string;
    country: string;
    color: string;
    apiId?: number; // API-Football team ID for fetching real logo
}

// الأندية الأكثر جماهيرية في كل دوري عربي + الدوريات الأوروبية الكبرى
// Logos will be fetched from API-Football using apiId
// Use initializeClubLogos() to load real logos on app start

export const CLUBS: Club[] = [
    // ============ Egyptian League ============
    { id: 'egypt-team-1', name: 'Egyptian Team 1', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#C8102E', apiId: 1020 },
    { id: 'egypt-team-2', name: 'Egyptian Team 2', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#FFFFFF', apiId: 1021 },
    { id: 'egypt-team-3', name: 'Egyptian Team 3', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#00A651', apiId: 5765 },
    { id: 'egypt-team-4', name: 'Egyptian Team 4', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#FFD700', apiId: 1022 },
    { id: 'egypt-team-5', name: 'Egyptian Team 5', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#006633', apiId: 1026 },
    { id: 'egypt-team-6', name: 'Egyptian Team 6', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#FF0000', apiId: 1023 },
    { id: 'egypt-team-7', name: 'Egyptian Team 7', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#0000FF', apiId: 1024 },
    { id: 'egypt-team-8', name: 'Egyptian Team 8', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#FFA500', apiId: 1025 },
    { id: 'egypt-team-9', name: 'Egyptian Team 9', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#800080', apiId: 5766 },
    { id: 'egypt-team-10', name: 'Egyptian Team 10', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#00CED1', apiId: 5767 },
    { id: 'egypt-team-11', name: 'Egyptian Team 11', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#FF6347', apiId: 1027 },
    { id: 'egypt-team-12', name: 'Egyptian Team 12', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#32CD32', apiId: 1028 },
    { id: 'egypt-team-13', name: 'Egyptian Team 13', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#4169E1', apiId: 1029 },
    { id: 'egypt-team-14', name: 'Egyptian Team 14', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#FF1493', apiId: 5768 },
    { id: 'egypt-team-15', name: 'Egyptian Team 15', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#228B22', apiId: 5769 },

    // ============ Saudi League ============
    { id: 'saudi-team-1', name: 'Saudi Team 1', logo: '', league: 'Saudi Pro League', country: 'Saudi Arabia', color: '#003DA5', apiId: 2932 },
    { id: 'saudi-team-2', name: 'Saudi Team 2', logo: '', league: 'Saudi Pro League', country: 'Saudi Arabia', color: '#FFD700', apiId: 2939 },
    { id: 'saudi-team-3', name: 'Saudi Team 3', logo: '', league: 'Saudi Pro League', country: 'Saudi Arabia', color: '#000000', apiId: 2934 },
    { id: 'saudi-team-4', name: 'Saudi Team 4', logo: '', league: 'Saudi Pro League', country: 'Saudi Arabia', color: '#006633', apiId: 2930 },
    { id: 'saudi-team-5', name: 'Saudi Team 5', logo: '', league: 'Saudi Pro League', country: 'Saudi Arabia', color: '#FFFFFF', apiId: 2944 },

    // ============ UAE League ============
    { id: 'uae-team-1', name: 'UAE Team 1', logo: '', league: 'UAE Pro League', country: 'UAE', color: '#800080', apiId: 2896 },
    { id: 'uae-team-2', name: 'UAE Team 2', logo: '', league: 'UAE Pro League', country: 'UAE', color: '#C8102E', apiId: 2897 },
    { id: 'uae-team-3', name: 'UAE Team 3', logo: '', league: 'UAE Pro League', country: 'UAE', color: '#006633', apiId: 2903 },
    { id: 'uae-team-4', name: 'UAE Team 4', logo: '', league: 'UAE Pro League', country: 'UAE', color: '#FFFFFF', apiId: 2899 },

    // ============ Qatar League ============
    { id: 'qatar-team-1', name: 'Qatar Team 1', logo: '', league: 'Qatar Stars League', country: 'Qatar', color: '#000000', apiId: 2879 },
    { id: 'qatar-team-2', name: 'Qatar Team 2', logo: '', league: 'Qatar Stars League', country: 'Qatar', color: '#C8102E', apiId: 2873 },
    { id: 'qatar-team-3', name: 'Qatar Team 3', logo: '', league: 'Qatar Stars League', country: 'Qatar', color: '#800000', apiId: 2878 },
    { id: 'qatar-team-4', name: 'Qatar Team 4', logo: '', league: 'Qatar Stars League', country: 'Qatar', color: '#006633', apiId: 2871 },

    // ============ Moroccan League ============
    { id: 'morocco-team-1', name: 'Moroccan Team 1', logo: '', league: 'Botola Pro', country: 'Morocco', color: '#C8102E', apiId: 968 },
    { id: 'morocco-team-2', name: 'Moroccan Team 2', logo: '', league: 'Botola Pro', country: 'Morocco', color: '#006633', apiId: 967 },
    { id: 'morocco-team-3', name: 'Moroccan Team 3', logo: '', league: 'Botola Pro', country: 'Morocco', color: '#006633', apiId: 960 },
    { id: 'morocco-team-4', name: 'Moroccan Team 4', logo: '', league: 'Botola Pro', country: 'Morocco', color: '#FF6600', apiId: 4934 },

    // ============ Algerian League ============
    { id: 'algeria-team-1', name: 'Algerian Team 1', logo: '', league: 'Ligue 1 Algeria', country: 'Algeria', color: '#C8102E', apiId: 901 },
    { id: 'algeria-team-2', name: 'Algerian Team 2', logo: '', league: 'Ligue 1 Algeria', country: 'Algeria', color: '#006633', apiId: 898 },
    { id: 'algeria-team-3', name: 'Algerian Team 3', logo: '', league: 'Ligue 1 Algeria', country: 'Algeria', color: '#FFD700', apiId: 895 },
    { id: 'algeria-team-4', name: 'Algerian Team 4', logo: '', league: 'Ligue 1 Algeria', country: 'Algeria', color: '#C8102E', apiId: 892 },

    // ============ Tunisian League ============
    { id: 'tunisia-team-1', name: 'Tunisian Team 1', logo: '', league: 'Ligue 1 Tunisia', country: 'Tunisia', color: '#FFD700', apiId: 1068 },
    { id: 'tunisia-team-2', name: 'Tunisian Team 2', logo: '', league: 'Ligue 1 Tunisia', country: 'Tunisia', color: '#C8102E', apiId: 1066 },
    { id: 'tunisia-team-3', name: 'Tunisian Team 3', logo: '', league: 'Ligue 1 Tunisia', country: 'Tunisia', color: '#C8102E', apiId: 1067 },
    { id: 'tunisia-team-4', name: 'Tunisian Team 4', logo: '', league: 'Ligue 1 Tunisia', country: 'Tunisia', color: '#000000', apiId: 1065 },

    // ============ Iraqi League ============
    { id: 'iraq-team-1', name: 'Iraqi Team 1', logo: '', league: 'Iraqi League', country: 'Iraq', color: '#003DA5', apiId: 3178 },
    { id: 'iraq-team-2', name: 'Iraqi Team 2', logo: '', league: 'Iraqi League', country: 'Iraq', color: '#FFFFFF', apiId: 3179 },
    { id: 'iraq-team-3', name: 'Iraqi Team 3', logo: '', league: 'Iraqi League', country: 'Iraq', color: '#003DA5', apiId: 3177 },

    // ============ Jordanian League ============
    { id: 'jordan-team-1', name: 'Jordanian Team 1', logo: '', league: 'Jordan League', country: 'Jordan', color: '#003DA5', apiId: 3456 },
    { id: 'jordan-team-2', name: 'Jordanian Team 2', logo: '', league: 'Jordan League', country: 'Jordan', color: '#006633', apiId: 3457 },

    // ============ Kuwaiti League ============
    { id: 'kuwait-team-1', name: 'Kuwaiti Team 1', logo: '', league: 'Kuwait League', country: 'Kuwait', color: '#FFD700', apiId: 2855 },
    { id: 'kuwait-team-2', name: 'Kuwaiti Team 2', logo: '', league: 'Kuwait League', country: 'Kuwait', color: '#006633', apiId: 2851 },
    { id: 'kuwait-team-3', name: 'Kuwaiti Team 3', logo: '', league: 'Kuwait League', country: 'Kuwait', color: '#003DA5', apiId: 2856 },

    // ============ English League ============
    { id: 'england-team-1', name: 'English Team 1', logo: '', league: 'English League 1', country: 'England', color: '#C8102E', apiId: 40 },
    { id: 'england-team-2', name: 'English Team 2', logo: '', league: 'English League 1', country: 'England', color: '#6CABDD', apiId: 50 },
    { id: 'england-team-3', name: 'English Team 3', logo: '', league: 'English League 1', country: 'England', color: '#DA291C', apiId: 33 },
    { id: 'england-team-4', name: 'English Team 4', logo: '', league: 'English League 1', country: 'England', color: '#EF0107', apiId: 42 },
    { id: 'england-team-5', name: 'English Team 5', logo: '', league: 'English League 1', country: 'England', color: '#034694', apiId: 49 },

    // ============ Spanish League ============
    { id: 'spain-team-1', name: 'Spanish Team 1', logo: '', league: 'Spanish League 1', country: 'Spain', color: '#FFFFFF', apiId: 541 },
    { id: 'spain-team-2', name: 'Spanish Team 2', logo: '', league: 'Spanish League 1', country: 'Spain', color: '#A50044', apiId: 529 },
    { id: 'spain-team-3', name: 'Spanish Team 3', logo: '', league: 'Spanish League 1', country: 'Spain', color: '#CB3524', apiId: 530 },

    // ============ German League ============
    { id: 'germany-team-1', name: 'German Team 1', logo: '', league: 'German League 1', country: 'Germany', color: '#DC052D', apiId: 157 },
    { id: 'germany-team-2', name: 'German Team 2', logo: '', league: 'German League 1', country: 'Germany', color: '#FDE100', apiId: 165 },

    // ============ Italian League ============
    { id: 'italy-team-1', name: 'Italian Team 1', logo: '', league: 'Italian League 1', country: 'Italy', color: '#000000', apiId: 496 },
    { id: 'italy-team-2', name: 'Italian Team 2', logo: '', league: 'Italian League 1', country: 'Italy', color: '#FB090B', apiId: 489 },
    { id: 'italy-team-3', name: 'Italian Team 3', logo: '', league: 'Italian League 1', country: 'Italy', color: '#0068A8', apiId: 505 },

    // ============ French League ============
    { id: 'france-team-1', name: 'French Team 1', logo: '', league: 'French League 1', country: 'France', color: '#004170', apiId: 85 },
    { id: 'france-team-2', name: 'French Team 2', logo: '', league: 'French League 1', country: 'France', color: '#2FAEE0', apiId: 81 },

    // ============ Other Popular Teams ============
    { id: 'turkey-team-1', name: 'Turkish Team 1', logo: '', league: 'Turkish League', country: 'Turkey', color: '#FDB913', apiId: 645 },
    { id: 'turkey-team-2', name: 'Turkish Team 2', logo: '', league: 'Turkish League', country: 'Turkey', color: '#FFED00', apiId: 611 },
    { id: 'brazil-team-1', name: 'Brazilian Team 1', logo: '', league: 'Brazilian League', country: 'Brazil', color: '#C8102E', apiId: 127 },
    { id: 'argentina-team-1', name: 'Argentinian Team 1', logo: '', league: 'Argentinian League', country: 'Argentina', color: '#003DA5', apiId: 451 },
];
