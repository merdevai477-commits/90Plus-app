export interface Club {
    id: string;
    name: string;
    nameAr: string; // Arabic name for the club
    logo: string;
    league: string;
    country: string;
    color: string;
    // Removed apiId - no longer fetching real logos
}

// أندية عامة مستوحاة من الأندية الكبرى (بدون استخدام أسماء أو شعارات محمية)
// Generic clubs inspired by major clubs (without using protected names or logos)
// Using generic names based on city/color to avoid trademark issues

export const CLUBS: Club[] = [
    // ============ GENERIC EUROPEAN CLUBS ============
    { id: 'royal-madrid', name: 'Royal Madrid FC', nameAr: 'رويال مدريد', logo: 'RM', league: 'Spanish League', country: 'Spain', color: '#FFFFFF' },
    { id: 'barcelona-stars', name: 'Barcelona Stars', nameAr: 'نجوم برشلونة', logo: 'BS', league: 'Spanish League', country: 'Spain', color: '#A50044' },
    { id: 'manchester-reds', name: 'Manchester Reds', nameAr: 'مانشستر الأحمر', logo: 'MR', league: 'English League', country: 'England', color: '#DA020E' },
    { id: 'liverpool-reds', name: 'Liverpool Reds', nameAr: 'ليفربول الأحمر', logo: 'LR', league: 'English League', country: 'England', color: '#C8102E' },
    { id: 'munich-giants', name: 'Munich Giants', nameAr: 'عمالقة ميونخ', logo: 'MG', league: 'German League', country: 'Germany', color: '#DC052D' },
    { id: 'turin-stripes', name: 'Turin Stripes', nameAr: 'خطوط تورينو', logo: 'TS', league: 'Italian League', country: 'Italy', color: '#000000' },
    { id: 'paris-fc', name: 'Paris FC', nameAr: 'باريس', logo: 'PFC', league: 'French League', country: 'France', color: '#004170' },
    { id: 'manchester-blues', name: 'Manchester Blues', nameAr: 'مانشستر الأزرق', logo: 'MB', league: 'English League', country: 'England', color: '#6CABDD' },
    { id: 'london-blues', name: 'London Blues', nameAr: 'لندن الأزرق', logo: 'LB', league: 'English League', country: 'England', color: '#034694' },
    { id: 'north-london', name: 'North London FC', nameAr: 'شمال لندن', logo: 'NL', league: 'English League', country: 'England', color: '#EF0107' },
];
