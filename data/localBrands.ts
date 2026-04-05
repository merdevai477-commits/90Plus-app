/**
 * Sports Brands - Fictional names for App Store compliance
 * براندات رياضية - أسماء وهمية للامتثال لمتجر التطبيقات
 * 
 * ⚠️ APPLE COMPLIANCE: No real brand names or logos used
 * These are fictional brands inspired by the sports industry
 */

export interface LocalBrand {
    id: string;
    name: string;
    nameAr: string;
    logo: string; // Emoji used instead of real logos
    color: string;
    category: 'Sports' | 'Fashion' | 'Tech';
}

export const LOCAL_BRANDS: LocalBrand[] = [
    {
        id: 'swift-sports',
        name: 'Swift Sports',
        nameAr: 'سويفت سبورتس',
        logo: '⚡',
        color: '#111111',
        category: 'Sports'
    },
    {
        id: 'triple-stripe',
        name: 'Triple Stripe',
        nameAr: 'تريبل سترايب',
        logo: '〰️',
        color: '#000000',
        category: 'Sports'
    },
    {
        id: 'wild-cat',
        name: 'Wild Cat',
        nameAr: 'وايلد كات',
        logo: '🐆',
        color: '#E4002B',
        category: 'Sports'
    },
    {
        id: 'balance-pro',
        name: 'Balance Pro',
        nameAr: 'بالانس برو',
        logo: '⚖️',
        color: '#CF0A2C',
        category: 'Sports'
    },
    {
        id: 'iron-shield',
        name: 'Iron Shield',
        nameAr: 'آيرون شيلد',
        logo: '🛡️',
        color: '#1C1C1C',
        category: 'Sports'
    },
    {
        id: 'retro-kick',
        name: 'Retro Kick',
        nameAr: 'ريترو كيك',
        logo: '👟',
        color: '#333333',
        category: 'Sports'
    },
    {
        id: 'peak-runner',
        name: 'Peak Runner',
        nameAr: 'بيك رانر',
        logo: '🏃',
        color: '#0033A0',
        category: 'Sports'
    },
    {
        id: 'wave-sport',
        name: 'Wave Sport',
        nameAr: 'ويف سبورت',
        logo: '🌊',
        color: '#003DA5',
        category: 'Sports'
    },
];

// Helper functions
export const getBrandById = (id: string): LocalBrand | undefined => {
    return LOCAL_BRANDS.find(brand => brand.id === id);
};

export const getBrandByName = (name: string): LocalBrand | undefined => {
    return LOCAL_BRANDS.find(
        brand => brand.name.toLowerCase() === name.toLowerCase() ||
                brand.nameAr === name
    );
};

export const getBrandsByCategory = (category: string): LocalBrand[] => {
    return LOCAL_BRANDS.filter(brand => brand.category === category);
};
