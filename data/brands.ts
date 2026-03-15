import { getBrandLogo } from '../services/brandLogoService';

export interface Brand {
    id: string;
    name: string;
    logo: string;
    color: string;
    category: string; // Sports, Fashion, Tech, etc.
}

// أشهر البراندات العالمية مع شعاراتها الحقيقية
// Most famous global brands with real logos

const BRAND_DATA = [
    // ============ SPORTS BRANDS - TOP 4 ONLY ============
    { id: '1', name: 'Nike', color: '#111111', category: 'Sports' },
    { id: '2', name: 'Adidas', color: '#000000', category: 'Sports' },
    { id: '3', name: 'Puma', color: '#E4002B', category: 'Sports' },
    { id: '4', name: 'New Balance', color: '#CF0A2C', category: 'Sports' },
];

// Initialize brands with real logos
export const BRANDS: Brand[] = BRAND_DATA.map(brand => ({
    ...brand,
    logo: getBrandLogo(brand.name) || '',
}));

// Helper function to get brands by category
export const getBrandsByCategory = (category: string): Brand[] => {
    return BRANDS.filter(brand => brand.category === category);
};

// Get all available categories
export const getBrandCategories = (): string[] => {
    return [...new Set(BRANDS.map(brand => brand.category))];
};
