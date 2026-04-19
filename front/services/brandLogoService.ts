/**
 * Brand Logo Service
 * 
 * Provides real brand logos from CDN/API sources
 * Uses reliable CDN URLs for major sports brands
 */

import { logger } from '../utils/logger';

// Brand logo URLs by API ID (matching the apiId in brands.ts)
const BRAND_LOGOS_BY_API_ID: Record<number, string> = {
    1: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg', // Nike
    2: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg', // Adidas
    3: 'https://upload.wikimedia.org/wikipedia/en/d/da/Puma_complete_logo.svg', // Puma
    4: 'https://logos-world.net/wp-content/uploads/2020/09/New-Balance-Logo.png', // New Balance
};

// Brand logo URLs by brand name (using reliable CDN sources)
const BRAND_LOGOS_BY_NAME: Record<string, string> = {
    // ============ SPORTS BRANDS - TOP 4 ONLY ============
    'Nike': 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg',
    'Adidas': 'https://upload.wikimedia.org/wikipedia/commons/2/20/Adidas_Logo.svg',
    'Puma': 'https://upload.wikimedia.org/wikipedia/en/d/da/Puma_complete_logo.svg',
    'New Balance': 'https://logos-world.net/wp-content/uploads/2020/09/New-Balance-Logo.png',
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

