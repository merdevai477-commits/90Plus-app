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
    // ============ الدوري المصري ============
    // ✅ الأندية الكبرى أولاً (الأهلي والزمالك)
    { id: 'al-ahly', name: 'النادي الأهلي', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#C8102E', apiId: 1020 },
    { id: 'zamalek', name: 'نادي الزمالك', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#FFFFFF', apiId: 1021 },
    { id: 'pyramids', name: 'بيراميدز', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#00A651', apiId: 5765 },
    { id: 'ismaily', name: 'الإسماعيلي', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#FFD700', apiId: 1022 },
    { id: 'al-masry', name: 'المصري', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#006633', apiId: 1026 },
    { id: 'al-ittihad-alexandria', name: 'الاتحاد السكندري', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#FF0000', apiId: 1023 },
    { id: 'smouha', name: 'سموحة', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#0000FF', apiId: 1024 },
    { id: 'enppi', name: 'إنبي', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#FFA500', apiId: 1025 },
    { id: 'ceramica-cleopatra', name: 'سيراميكا كليوباترا', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#800080', apiId: 5766 },
    { id: 'future', name: 'فوتشر', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#00CED1', apiId: 5767 },
    { id: 'al-mokawloon', name: 'المقاولون العرب', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#FF6347', apiId: 1027 },
    { id: 'wadi-degla', name: 'ودي دجلة', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#32CD32', apiId: 1028 },
    { id: 'al-ahly-masry', name: 'الأهلي المصري', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#4169E1', apiId: 1029 },
    { id: 'pharco', name: 'فاركو', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#FF1493', apiId: 5768 },
    { id: 'national-bank', name: 'البنك الأهلي', logo: '', league: 'Egyptian League', country: 'Egypt', color: '#228B22', apiId: 5769 },

    // ============ الدوري السعودي ============
    { id: 'al-hilal', name: 'الهلال', logo: '', league: 'Saudi Pro League', country: 'Saudi Arabia', color: '#003DA5', apiId: 2932 },
    { id: 'al-nassr', name: 'النصر', logo: '', league: 'Saudi Pro League', country: 'Saudi Arabia', color: '#FFD700', apiId: 2939 },
    { id: 'al-ittihad', name: 'الاتحاد', logo: '', league: 'Saudi Pro League', country: 'Saudi Arabia', color: '#000000', apiId: 2934 },
    { id: 'al-ahli-jeddah', name: 'الأهلي السعودي', logo: '', league: 'Saudi Pro League', country: 'Saudi Arabia', color: '#006633', apiId: 2930 },
    { id: 'al-shabab', name: 'الشباب', logo: '', league: 'Saudi Pro League', country: 'Saudi Arabia', color: '#FFFFFF', apiId: 2944 },

    // ============ دوري الإمارات ============
    { id: 'al-ain', name: 'العين', logo: '', league: 'UAE Pro League', country: 'UAE', color: '#800080', apiId: 2896 },
    { id: 'shabab-al-ahli', name: 'شباب الأهلي', logo: '', league: 'UAE Pro League', country: 'UAE', color: '#C8102E', apiId: 2897 },
    { id: 'al-wahda', name: 'الوحدة', logo: '', league: 'UAE Pro League', country: 'UAE', color: '#006633', apiId: 2903 },
    { id: 'al-jazira', name: 'الجزيرة', logo: '', league: 'UAE Pro League', country: 'UAE', color: '#FFFFFF', apiId: 2899 },

    // ============ دوري قطر ============
    { id: 'al-sadd', name: 'السد', logo: '', league: 'Qatar Stars League', country: 'Qatar', color: '#000000', apiId: 2879 },
    { id: 'al-duhail', name: 'الدحيل', logo: '', league: 'Qatar Stars League', country: 'Qatar', color: '#C8102E', apiId: 2873 },
    { id: 'al-rayyan', name: 'الريان', logo: '', league: 'Qatar Stars League', country: 'Qatar', color: '#800000', apiId: 2878 },
    { id: 'al-arabi', name: 'العربي', logo: '', league: 'Qatar Stars League', country: 'Qatar', color: '#006633', apiId: 2871 },

    // ============ الدوري المغربي ============
    { id: 'wydad', name: 'الوداد', logo: '', league: 'Botola Pro', country: 'Morocco', color: '#C8102E', apiId: 968 },
    { id: 'raja', name: 'الرجاء', logo: '', league: 'Botola Pro', country: 'Morocco', color: '#006633', apiId: 967 },
    { id: 'far-rabat', name: 'الجيش الملكي', logo: '', league: 'Botola Pro', country: 'Morocco', color: '#006633', apiId: 960 },
    { id: 'rs-berkane', name: 'نهضة بركان', logo: '', league: 'Botola Pro', country: 'Morocco', color: '#FF6600', apiId: 4934 },

    // ============ الدوري الجزائري ============
    { id: 'usm-alger', name: 'اتحاد الجزائر', logo: '', league: 'Ligue 1 Algeria', country: 'Algeria', color: '#C8102E', apiId: 901 },
    { id: 'mc-alger', name: 'مولودية الجزائر', logo: '', league: 'Ligue 1 Algeria', country: 'Algeria', color: '#006633', apiId: 898 },
    { id: 'js-kabylie', name: 'شبيبة القبائل', logo: '', league: 'Ligue 1 Algeria', country: 'Algeria', color: '#FFD700', apiId: 895 },
    { id: 'cr-belouizdad', name: 'شباب بلوزداد', logo: '', league: 'Ligue 1 Algeria', country: 'Algeria', color: '#C8102E', apiId: 892 },

    // ============ الدوري التونسي ============
    { id: 'esperance', name: 'الترجي', logo: '', league: 'Ligue 1 Tunisia', country: 'Tunisia', color: '#FFD700', apiId: 1068 },
    { id: 'club-africain', name: 'النادي الإفريقي', logo: '', league: 'Ligue 1 Tunisia', country: 'Tunisia', color: '#C8102E', apiId: 1066 },
    { id: 'etoile-sahel', name: 'النجم الساحلي', logo: '', league: 'Ligue 1 Tunisia', country: 'Tunisia', color: '#C8102E', apiId: 1067 },
    { id: 'sfaxien', name: 'الصفاقسي', logo: '', league: 'Ligue 1 Tunisia', country: 'Tunisia', color: '#000000', apiId: 1065 },

    // ============ الدوري العراقي ============
    { id: 'al-shorta', name: 'الشرطة', logo: '', league: 'Iraqi League', country: 'Iraq', color: '#003DA5', apiId: 3178 },
    { id: 'al-zawraa', name: 'الزوراء', logo: '', league: 'Iraqi League', country: 'Iraq', color: '#FFFFFF', apiId: 3179 },
    { id: 'al-quwa-al-jawiya', name: 'القوة الجوية', logo: '', league: 'Iraqi League', country: 'Iraq', color: '#003DA5', apiId: 3177 },

    // ============ الدوري الأردني ============
    { id: 'al-faisaly', name: 'الفيصلي', logo: '', league: 'Jordan League', country: 'Jordan', color: '#003DA5', apiId: 3456 },
    { id: 'al-wehdat', name: 'الوحدات', logo: '', league: 'Jordan League', country: 'Jordan', color: '#006633', apiId: 3457 },

    // ============ الدوري الكويتي ============
    { id: 'al-qadsia', name: 'القادسية', logo: '', league: 'Kuwait League', country: 'Kuwait', color: '#FFD700', apiId: 2855 },
    { id: 'al-arabi-kw', name: 'العربي الكويتي', logo: '', league: 'Kuwait League', country: 'Kuwait', color: '#006633', apiId: 2851 },
    { id: 'al-kuwait', name: 'الكويت', logo: '', league: 'Kuwait League', country: 'Kuwait', color: '#003DA5', apiId: 2856 },

    // ============ الدوري الإنجليزي ============
    { id: 'liverpool', name: 'ليفربول', logo: '', league: 'Premier League', country: 'England', color: '#C8102E', apiId: 40 },
    { id: 'manchester-city', name: 'مانشستر سيتي', logo: '', league: 'Premier League', country: 'England', color: '#6CABDD', apiId: 50 },
    { id: 'manchester-united', name: 'مانشستر يونايتد', logo: '', league: 'Premier League', country: 'England', color: '#DA291C', apiId: 33 },
    { id: 'arsenal', name: 'آرسنال', logo: '', league: 'Premier League', country: 'England', color: '#EF0107', apiId: 42 },
    { id: 'chelsea', name: 'تشيلسي', logo: '', league: 'Premier League', country: 'England', color: '#034694', apiId: 49 },

    // ============ الدوري الإسباني ============
    { id: 'real-madrid', name: 'ريال مدريد', logo: '', league: 'La Liga', country: 'Spain', color: '#FFFFFF', apiId: 541 },
    { id: 'barcelona', name: 'برشلونة', logo: '', league: 'La Liga', country: 'Spain', color: '#A50044', apiId: 529 },
    { id: 'atletico-madrid', name: 'أتلتيكو مدريد', logo: '', league: 'La Liga', country: 'Spain', color: '#CB3524', apiId: 530 },

    // ============ الدوري الألماني ============
    { id: 'bayern-munich', name: 'بايرن ميونخ', logo: '', league: 'Bundesliga', country: 'Germany', color: '#DC052D', apiId: 157 },
    { id: 'borussia-dortmund', name: 'دورتموند', logo: '', league: 'Bundesliga', country: 'Germany', color: '#FDE100', apiId: 165 },

    // ============ الدوري الإيطالي ============
    { id: 'juventus', name: 'يوفنتوس', logo: '', league: 'Serie A', country: 'Italy', color: '#000000', apiId: 496 },
    { id: 'ac-milan', name: 'ميلان', logo: '', league: 'Serie A', country: 'Italy', color: '#FB090B', apiId: 489 },
    { id: 'inter-milan', name: 'إنتر ميلان', logo: '', league: 'Serie A', country: 'Italy', color: '#0068A8', apiId: 505 },

    // ============ الدوري الفرنسي ============
    { id: 'psg', name: 'باريس سان جيرمان', logo: '', league: 'Ligue 1', country: 'France', color: '#004170', apiId: 85 },
    { id: 'marseille', name: 'مارسيليا', logo: '', league: 'Ligue 1', country: 'France', color: '#2FAEE0', apiId: 81 },

    // ============ أندية أخرى مشهورة ============
    { id: 'galatasaray', name: 'غلطة سراي', logo: '', league: 'Super Lig', country: 'Turkey', color: '#FDB913', apiId: 645 },
    { id: 'fenerbahce', name: 'فنربخشة', logo: '', league: 'Super Lig', country: 'Turkey', color: '#FFED00', apiId: 611 },
    { id: 'flamengo', name: 'فلامنغو', logo: '', league: 'Serie A Brazil', country: 'Brazil', color: '#C8102E', apiId: 127 },
    { id: 'boca-juniors', name: 'بوكا جونيورز', logo: '', league: 'Primera Division', country: 'Argentina', color: '#003DA5', apiId: 451 },
];
