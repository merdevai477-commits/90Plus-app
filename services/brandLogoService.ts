/**
 * Brand Logo Service
 * 
 * Provides real brand logos from CDN/API sources
 * Uses reliable CDN URLs for major sports brands
 */

import { logger } from '../utils/logger';

// Brand logo URLs by API ID (matching the apiId in brands.ts)
const BRAND_LOGOS_BY_API_ID: Record<number, string> = {
    1: 'https://logos-world.net/wp-content/uploads/2020/04/Nike-Logo.png', // Nike
    2: 'https://logos-world.net/wp-content/uploads/2020/04/Adidas-Logo.png', // Adidas
    3: 'https://logos-world.net/wp-content/uploads/2020/04/Puma-Logo.png', // Puma
    4: 'https://logos-world.net/wp-content/uploads/2020/04/Under-Armour-Logo.png', // Under Armour
    5: 'https://logos-world.net/wp-content/uploads/2020/04/New-Balance-Logo.png', // New Balance
    6: 'https://logos-world.net/wp-content/uploads/2020/04/Reebok-Logo.png', // Reebok
    7: 'https://logos-world.net/wp-content/uploads/2020/04/Umbro-Logo.png', // Umbro
    8: 'https://logos-world.net/wp-content/uploads/2020/04/Kappa-Logo.png', // Kappa
    9: 'https://logos-world.net/wp-content/uploads/2020/04/Joma-Logo.png', // Joma
    10: 'https://logos-world.net/wp-content/uploads/2020/04/Hummel-Logo.png', // Hummel
    11: 'https://logos-world.net/wp-content/uploads/2020/04/Mizuno-Logo.png', // Mizuno
    12: 'https://logos-world.net/wp-content/uploads/2020/04/Diadora-Logo.png', // Diadora
};

// Brand logo URLs by brand name (for backward compatibility)
const BRAND_LOGOS_BY_NAME: Record<string, string> = {
    'Nike': 'https://logos-world.net/wp-content/uploads/2020/04/Nike-Logo.png',
    'Adidas': 'https://logos-world.net/wp-content/uploads/2020/04/Adidas-Logo.png',
    'Puma': 'https://logos-world.net/wp-content/uploads/2020/04/Puma-Logo.png',
    'Under Armour': 'https://logos-world.net/wp-content/uploads/2020/04/Under-Armour-Logo.png',
    'New Balance': 'https://logos-world.net/wp-content/uploads/2020/04/New-Balance-Logo.png',
    'Reebok': 'https://logos-world.net/wp-content/uploads/2020/04/Reebok-Logo.png',
    'Umbro': 'https://logos-world.net/wp-content/uploads/2020/04/Umbro-Logo.png',
    'Kappa': 'https://logos-world.net/wp-content/uploads/2020/04/Kappa-Logo.png',
    'Joma': 'https://logos-world.net/wp-content/uploads/2020/04/Joma-Logo.png',
    'Hummel': 'https://logos-world.net/wp-content/uploads/2020/04/Hummel-Logo.png',
    'Mizuno': 'https://logos-world.net/wp-content/uploads/2020/04/Mizuno-Logo.png',
    'Diadora': 'https://logos-world.net/wp-content/uploads/2020/04/Diadora-Logo.png',
};

/**
 * Fetch brand logo by API ID (primary method)
 */
export const brandLogoService = {
    async fetchBrandLogo(apiId: number): Promise<string | null> {
        try {
            const logoUrl = BRAND_LOGOS_BY_API_ID[apiId];
            if (logoUrl) {
                logger.debug(`Fetched real logo for brand API ID ${apiId}: ${logoUrl}`);
                return logoUrl;
            }
            logger.warn(`No real logo found for brand API ID ${apiId}`);
            return null;
        } catch (error) {
            logger.error(`Error fetching brand logo for API ID ${apiId}:`, error);
            return null;
        }
    }
};

/**
 * Get brand logo URL by brand name (for backward compatibility)
 */
export function getBrandLogo(brandName: string): string | null {
    return BRAND_LOGOS_BY_NAME[brandName] || null;
}

/**
 * Get all brand logos
 */
export function getAllBrandLogos(): Record<string, string> {
    return BRAND_LOGOS_BY_NAME;
}

