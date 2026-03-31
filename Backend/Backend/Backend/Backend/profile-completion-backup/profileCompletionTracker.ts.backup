/**
 * Profile Completion Tracker
 * تتبع تلقائي لإكمال مهام البروفايل
 * 
 * يقوم بمراقبة الأحداث التالية وتحديث المهام تلقائياً:
 * 1. رفع صورة البروفايل
 * 2. اختيار البلد
 * 3. اختيار النادي المفضل
 * 4. كتابة البايو
 * 5. اختيار المركز
 * 6. إدخال بيانات الكارت
 * 7. اختيار البراند المفضل
 * 8. إضافة روابط السوشيال ميديا
 */

import { useAuth } from '@clerk/clerk-expo';
import { ProfileService } from '../src/services/authService';
import { logger } from './logger';

export interface ProfileCompletionEvent {
    stepId: string;
    action: string;
    data?: any;
}

class ProfileCompletionTrackerClass {
    private isEnabled = true;
    private pendingUpdates = new Set<string>();

    /**
     * Enable/disable the tracker
     */
    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        logger.debug('[ProfileTracker] Tracker', enabled ? 'enabled' : 'disabled');
    }

    /**
     * Track a profile completion event
     */
    async trackEvent(event: ProfileCompletionEvent, token?: string): Promise<void> {
        if (!this.isEnabled) {
            logger.debug('[ProfileTracker] Tracker disabled, skipping event:', event.stepId);
            return;
        }

        // Prevent duplicate updates for the same step
        if (this.pendingUpdates.has(event.stepId)) {
            logger.debug('[ProfileTracker] Update already pending for step:', event.stepId);
            return;
        }

        try {
            this.pendingUpdates.add(event.stepId);

            logger.info('[ProfileTracker] Tracking completion event:', {
                stepId: event.stepId,
                action: event.action,
            });

            if (!token) {
                logger.warn('[ProfileTracker] No token provided, cannot update completion');
                return;
            }

            // Mark the step as completed
            const result = await ProfileService.markStepCompleted(token, event.stepId);
            
            if (result.success) {
                logger.info('[ProfileTracker] Step marked as completed:', {
                    stepId: event.stepId,
                    newPercentage: result.data?.percentage,
                });
            } else {
                logger.warn('[ProfileTracker] Failed to mark step as completed:', event.stepId);
            }
        } catch (error: any) {
            logger.error('[ProfileTracker] Error tracking event:', {
                stepId: event.stepId,
                error: error.message,
            });
        } finally {
            this.pendingUpdates.delete(event.stepId);
        }
    }

    /**
     * Track avatar upload
     */
    async trackAvatarUpload(avatarUrl: string, token?: string): Promise<void> {
        if (avatarUrl && avatarUrl.trim() !== '') {
            await this.trackEvent({
                stepId: 'avatar',
                action: 'avatar_uploaded',
                data: { avatarUrl },
            }, token);
        }
    }

    /**
     * Track country selection
     */
    async trackCountrySelection(country: string, countryFlag?: string, token?: string): Promise<void> {
        if ((country && country.trim() !== '') || (countryFlag && countryFlag.trim() !== '')) {
            await this.trackEvent({
                stepId: 'country',
                action: 'country_selected',
                data: { country, countryFlag },
            }, token);
        }
    }

    /**
     * Track club selection
     */
    async trackClubSelection(clubLogo: string, clubName?: string, token?: string): Promise<void> {
        if (clubLogo && clubLogo.trim() !== '') {
            await this.trackEvent({
                stepId: 'club',
                action: 'club_selected',
                data: { clubLogo, clubName },
            }, token);
        }
    }

    /**
     * Track bio update
     */
    async trackBioUpdate(bio: string, token?: string): Promise<void> {
        if (bio && bio.trim() !== '') {
            await this.trackEvent({
                stepId: 'bio',
                action: 'bio_updated',
                data: { bio },
            }, token);
        }
    }

    /**
     * Track position selection
     */
    async trackPositionSelection(position: string, token?: string): Promise<void> {
        if (position && position.trim() !== '') {
            await this.trackEvent({
                stepId: 'position',
                action: 'position_selected',
                data: { position },
            }, token);
        }
    }

    /**
     * Track card data completion
     */
    async trackCardDataCompletion(cardData: {
        age?: number;
        height?: number;
        weight?: number;
        preferredFoot?: string;
    }, token?: string): Promise<void> {
        const { age, height, weight, preferredFoot } = cardData;
        
        // Check if all card data fields are completed
        if (age && age > 0 && height && height > 0 && weight && weight > 0 && 
            preferredFoot && ['R', 'L', 'B'].includes(preferredFoot)) {
            await this.trackEvent({
                stepId: 'cardData',
                action: 'card_data_completed',
                data: cardData,
            }, token);
        }
    }

    /**
     * Track brand selection
     */
    async trackBrandSelection(brandLogo: string, brandName?: string, token?: string): Promise<void> {
        if (brandLogo && brandLogo.trim() !== '') {
            await this.trackEvent({
                stepId: 'brand',
                action: 'brand_selected',
                data: { brandLogo, brandName },
            }, token);
        }
    }

    /**
     * Track social links addition
     */
    async trackSocialLinksUpdate(socialLinks: any, token?: string): Promise<void> {
        if (socialLinks && Object.keys(socialLinks).length > 0) {
            await this.trackEvent({
                stepId: 'socialLinks',
                action: 'social_links_updated',
                data: { socialLinks },
            }, token);
        }
    }

    /**
     * Track multiple profile updates at once
     */
    async trackProfileUpdate(updates: {
        avatar?: string;
        country?: string;
        countryFlag?: string;
        clubLogo?: string;
        bio?: string;
        position?: string;
        age?: number;
        height?: number;
        weight?: number;
        preferredFoot?: string;
        brandLogo?: string;
        socialLinks?: any;
    }, token?: string): Promise<void> {
        const promises: Promise<void>[] = [];

        // Track each field that was updated
        if (updates.avatar) {
            promises.push(this.trackAvatarUpload(updates.avatar, token));
        }

        if (updates.country || updates.countryFlag) {
            promises.push(this.trackCountrySelection(updates.country || '', updates.countryFlag, token));
        }

        if (updates.clubLogo) {
            promises.push(this.trackClubSelection(updates.clubLogo, undefined, token));
        }

        if (updates.bio) {
            promises.push(this.trackBioUpdate(updates.bio, token));
        }

        if (updates.position) {
            promises.push(this.trackPositionSelection(updates.position, token));
        }

        if (updates.age || updates.height || updates.weight || updates.preferredFoot) {
            promises.push(this.trackCardDataCompletion({
                age: updates.age,
                height: updates.height,
                weight: updates.weight,
                preferredFoot: updates.preferredFoot,
            }, token));
        }

        if (updates.brandLogo) {
            promises.push(this.trackBrandSelection(updates.brandLogo, undefined, token));
        }

        if (updates.socialLinks) {
            promises.push(this.trackSocialLinksUpdate(updates.socialLinks, token));
        }

        // Execute all tracking operations in parallel
        await Promise.allSettled(promises);
    }

    /**
     * Get pending updates count
     */
    getPendingUpdatesCount(): number {
        return this.pendingUpdates.size;
    }

    /**
     * Clear pending updates (for cleanup)
     */
    clearPendingUpdates(): void {
        this.pendingUpdates.clear();
    }
}

// Export singleton instance
export const ProfileCompletionTracker = new ProfileCompletionTrackerClass();

/**
 * React Hook for Profile Completion Tracking
 */
export function useProfileCompletionTracker() {
    const { getToken } = useAuth();

    const trackWithAuth = async (trackingFunction: (token: string) => Promise<void>) => {
        try {
            const token = await getToken();
            if (token) {
                await trackingFunction(token);
            } else {
                logger.warn('[ProfileTracker] No auth token available');
            }
        } catch (error) {
            logger.error('[ProfileTracker] Error getting auth token:', error);
        }
    };

    return {
        trackAvatarUpload: (avatarUrl: string) => 
            trackWithAuth(token => ProfileCompletionTracker.trackAvatarUpload(avatarUrl, token)),
        
        trackCountrySelection: (country: string, countryFlag?: string) => 
            trackWithAuth(token => ProfileCompletionTracker.trackCountrySelection(country, countryFlag, token)),
        
        trackClubSelection: (clubLogo: string, clubName?: string) => 
            trackWithAuth(token => ProfileCompletionTracker.trackClubSelection(clubLogo, clubName, token)),
        
        trackBioUpdate: (bio: string) => 
            trackWithAuth(token => ProfileCompletionTracker.trackBioUpdate(bio, token)),
        
        trackPositionSelection: (position: string) => 
            trackWithAuth(token => ProfileCompletionTracker.trackPositionSelection(position, token)),
        
        trackCardDataCompletion: (cardData: any) => 
            trackWithAuth(token => ProfileCompletionTracker.trackCardDataCompletion(cardData, token)),
        
        trackBrandSelection: (brandLogo: string, brandName?: string) => 
            trackWithAuth(token => ProfileCompletionTracker.trackBrandSelection(brandLogo, brandName, token)),
        
        trackSocialLinksUpdate: (socialLinks: any) => 
            trackWithAuth(token => ProfileCompletionTracker.trackSocialLinksUpdate(socialLinks, token)),
        
        trackProfileUpdate: (updates: any) => 
            trackWithAuth(token => ProfileCompletionTracker.trackProfileUpdate(updates, token)),
        
        setEnabled: ProfileCompletionTracker.setEnabled.bind(ProfileCompletionTracker),
        getPendingUpdatesCount: ProfileCompletionTracker.getPendingUpdatesCount.bind(ProfileCompletionTracker),
    };
}

export default ProfileCompletionTracker;