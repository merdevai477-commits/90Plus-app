/**
 * Local Brands with Logos
 * البراندات المحلية مع الشعارات
 * 
 * This file contains popular sports brands with local logo URLs
 * for offline support and better performance
 */

export interface LocalBrand {
    id: string;
    name: string;
    nameAr: string;
    logo: string; // Local logo URL
    color: string;
    category: 'Sports' | 'Fashion' | 'Tech';
}

export const LOCAL_BRANDS: LocalBrand[] = [
    // ============ SPORTS BRANDS ============
    {
        id: 'nike',
        name: 'Nike',
        nameAr: 'نايكي',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg',
        color: '#111111',
        category: 'Sports'
    },
    {
        id: 'adidas',
        name: 'Adidas',
        nameAr: 'أديداس',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg',
        color: '#000000',
        category: 'Sports'
    },
    {
        id: 'puma',
        name: 'Puma',
        nameAr: 'بوما',
        logo: 'https://upload.wikimedia.org/wikipedia/en/d/da/Puma_complete_logo.svg',
        color: '#E4002B',
        category: 'Sports'
    },
    {
        id: 'new-balance',
        name: 'New Balance',
        nameAr: 'نيو بالانس',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/New_Balance_logo.svg',
        color: '#CF0A2C',
        category: 'Sports'
    },
    {
        id: 'under-armour',
        name: 'Under Armour',
        nameAr: 'أندر أرمور',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Under_armour_logo.svg',
        color: '#000000',
        category: 'Sports'
    },
    {
        id: 'reebok',
        name: 'Reebok',
        nameAr: 'ريبوك',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Reebok_logo.svg',
        color: '#000000',
        category: 'Sports'
    },
    {
        id: 'asics',
        name: 'ASICS',
        nameAr: 'أسيكس',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Asics_Logo.svg',
        color: '#0033A0',
        category: 'Sports'
    },
    {
        id: 'mizuno',
        name: 'Mizuno',
        nameAr: 'ميزونو',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Mizuno_logo.svg',
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
