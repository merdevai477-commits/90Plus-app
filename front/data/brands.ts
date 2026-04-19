// Fictional sports brands for App Store compliance
// براندات رياضية وهمية للامتثال لمتجر التطبيقات
// ⚠️ APPLE COMPLIANCE: No real trademarked names used

export interface Brand {
    id: string;
    name: string;
    logo: string;
    color: string;
    category: string;
    apiId?: number; // Optional - used for logo fetching
}

export const BRANDS: Brand[] = [
    { id: '1', name: 'Swift Sports',  logo: '⚡', color: '#111111', category: 'Sports' },
    { id: '2', name: 'Triple Stripe', logo: '〰️', color: '#000000', category: 'Sports' },
    { id: '3', name: 'Wild Cat',      logo: '🐆', color: '#E4002B', category: 'Sports' },
    { id: '4', name: 'Balance Pro',   logo: '⚖️', color: '#CF0A2C', category: 'Sports' },
    { id: '5', name: 'Iron Shield',   logo: '🛡️', color: '#1C1C1C', category: 'Sports' },
    { id: '6', name: 'Retro Kick',    logo: '👟', color: '#333333', category: 'Sports' },
    { id: '7', name: 'Peak Runner',   logo: '🏃', color: '#0033A0', category: 'Sports' },
    { id: '8', name: 'Wave Sport',    logo: '🌊', color: '#003DA5', category: 'Sports' },
];

export const getBrandsByCategory = (category: string): Brand[] =>
    BRANDS.filter(brand => brand.category === category);

export const getBrandCategories = (): string[] =>
    [...new Set(BRANDS.map(brand => brand.category))];
