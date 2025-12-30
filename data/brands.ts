import { getBrandLogo } from '../services/brandLogoService';

export interface Brand {
    id: string;
    name: string;
    logo: string;
    color: string;
    apiId?: number; // API ID for fetching real logo
}

// Brand data with real logos from CDN
// Logos are loaded from brandLogoService at runtime

const BRAND_DATA = [
    { id: '1', name: 'Nike', color: '#111111' },
    { id: '2', name: 'Adidas', color: '#000000' },
    { id: '3', name: 'Puma', color: '#E4002B' },
    { id: '4', name: 'Under Armour', color: '#1D1D1D' },
    { id: '5', name: 'New Balance', color: '#CF0A2C' },
    { id: '6', name: 'Reebok', color: '#CC0000' },
    { id: '7', name: 'Umbro', color: '#1E3264' },
    { id: '8', name: 'Kappa', color: '#003DA5' },
    { id: '9', name: 'Joma', color: '#E30613' },
    { id: '10', name: 'Hummel', color: '#000000' },
    { id: '11', name: 'Mizuno', color: '#003DA5' },
    { id: '12', name: 'Diadora', color: '#003DA5' },
];

// Initialize brands with real logos
export const BRANDS: Brand[] = BRAND_DATA.map(brand => ({
    ...brand,
    logo: getBrandLogo(brand.name) || '',
}));
