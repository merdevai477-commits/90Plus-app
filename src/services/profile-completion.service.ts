/**
 * Profile Completion Service
 * Tracks and calculates user profile completion percentage
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { ClerkUserService } from './clerk-user.service';

export interface ProfileCompletionStep {
  id: string;
  label: string;
  completed: boolean;
  required: boolean; // Required to upload videos
  weight: number; // Percentage weight (total should be 100)
}

export interface ProfileCompletionStatus {
  percentage: number;
  completedSteps: number;
  totalSteps: number;
  steps: ProfileCompletionStep[];
  canUploadVideo: boolean; // true if at least 3 required steps completed
  missingRequiredSteps: string[]; // List of missing required steps
}

// Define profile completion steps. Labels are English fallbacks only —
// the frontend resolves the localized display string from `id` via
// `getProfileCompletionStepLabel(stepId, language)`. The label is kept
// for legacy clients and admin tooling that surface the raw payload.
const PROFILE_STEPS = {
  avatar: { label: 'Profile picture', required: true, weight: 20 },
  country: { label: 'Country', required: true, weight: 15 },
  club: { label: 'Favorite club', required: true, weight: 15 },
  bio: { label: 'Bio', required: false, weight: 10 },
  position: { label: 'Playing position', required: false, weight: 10 },
  cardData: { label: 'Player card stats', required: false, weight: 20 }, // Combined: age, height, weight, foot
  brand: { label: 'Favorite brand', required: false, weight: 5 },
  socialLinks: { label: 'Social links', required: false, weight: 5 },
};

function buildFallbackCompletionStatus(): ProfileCompletionStatus {
  return {
    percentage: 0,
    completedSteps: 0,
    totalSteps: Object.keys(PROFILE_STEPS).length,
    steps: Object.keys(PROFILE_STEPS).map(id => ({
      id,
      label: (PROFILE_STEPS as Record<string, { label: string; required: boolean; weight: number }>)[id].label,
      completed: false,
      required: (PROFILE_STEPS as Record<string, { label: string; required: boolean; weight: number }>)[id].required,
      weight: (PROFILE_STEPS as Record<string, { label: string; required: boolean; weight: number }>)[id].weight,
    })),
    canUploadVideo: false,
    missingRequiredSteps: Object.values(PROFILE_STEPS).filter(s => s.required).map(s => s.label),
  };
}

export class ProfileCompletionService {
  /**
   * Calculate profile completion status for a user
   */
  static async getCompletionStatus(clerkUserId: string): Promise<ProfileCompletionStatus> {
    try {
      // Find user by clerkUserId instead of id
      let user = await prisma.user.findUnique({
        where: { clerkUserId: clerkUserId },
        select: {
          id: true, // We need the internal ID for updates
          avatar: true,
          countryFlag: true,
          country: true,
          clubLogo: true,
          bio: true,
          position: true,
          age: true,
          height: true,
          weight: true,
          preferredFoot: true,
          brandLogo: true,
          socialLinks: true,
          profileCompletionSteps: true,
        },
      });

      // If user doesn't exist, sync via ClerkUserService (unique email/username; never use empty email)
      if (!user) {
        logger.warn(`User not found for clerkUserId: ${clerkUserId}, syncing from Clerk`);
        try {
          await ClerkUserService.findOrCreateUser(clerkUserId);
          user = await prisma.user.findUnique({
            where: { clerkUserId },
            select: {
              id: true, avatar: true, countryFlag: true, country: true, clubLogo: true,
              bio: true, position: true, age: true, height: true, weight: true,
              preferredFoot: true, brandLogo: true, socialLinks: true, profileCompletionSteps: true,
            },
          });
        } catch (syncError) {
          logger.error(`Error syncing user ${clerkUserId} during profile completion:`, syncError);
        }

        // If user still doesn't exist, fallback to an empty/default response to avoid 500 errors crashing frontend
        if (!user) {
          logger.warn(`Fallback: Returning empty profile completion for ${clerkUserId}`);
          return buildFallbackCompletionStatus();
        }
      }

      // Check each step
      const steps: ProfileCompletionStep[] = [];
      let completedCount = 0;
      let totalPercentage = 0;
      const missingRequired: string[] = [];

      // Avatar - Check if avatar exists and is not empty/default
      const avatarCompleted = !!user.avatar && 
        user.avatar.trim() !== '' && 
        !user.avatar.includes('default') && 
        !user.avatar.includes('placeholder');
      steps.push({
        id: 'avatar',
        label: PROFILE_STEPS.avatar.label,
        completed: avatarCompleted,
        required: PROFILE_STEPS.avatar.required,
        weight: PROFILE_STEPS.avatar.weight,
      });
      if (avatarCompleted) {
        completedCount++;
        totalPercentage += PROFILE_STEPS.avatar.weight;
      } else if (PROFILE_STEPS.avatar.required) {
        missingRequired.push(PROFILE_STEPS.avatar.label);
      }

      // Country - Check if EITHER countryFlag OR country exists (more flexible)
      const countryCompleted = (!!user.countryFlag && user.countryFlag.trim() !== '') || 
        (!!user.country && user.country.trim() !== '');
      steps.push({
        id: 'country',
        label: PROFILE_STEPS.country.label,
        completed: countryCompleted,
        required: PROFILE_STEPS.country.required,
        weight: PROFILE_STEPS.country.weight,
      });
      if (countryCompleted) {
        completedCount++;
        totalPercentage += PROFILE_STEPS.country.weight;
      } else if (PROFILE_STEPS.country.required) {
        missingRequired.push(PROFILE_STEPS.country.label);
      }

      // Club
      const clubCompleted = !!user.clubLogo && user.clubLogo.trim() !== '';
      steps.push({
        id: 'club',
        label: PROFILE_STEPS.club.label,
        completed: clubCompleted,
        required: PROFILE_STEPS.club.required,
        weight: PROFILE_STEPS.club.weight,
      });
      if (clubCompleted) {
        completedCount++;
        totalPercentage += PROFILE_STEPS.club.weight;
      } else if (PROFILE_STEPS.club.required) {
        missingRequired.push(PROFILE_STEPS.club.label);
      }

      // Bio
      const bioCompleted = !!user.bio && user.bio.trim() !== '';
      steps.push({
        id: 'bio',
        label: PROFILE_STEPS.bio.label,
        completed: bioCompleted,
        required: PROFILE_STEPS.bio.required,
        weight: PROFILE_STEPS.bio.weight,
      });
      if (bioCompleted) {
        completedCount++;
        totalPercentage += PROFILE_STEPS.bio.weight;
      }

      // Position
      const positionCompleted = !!user.position && user.position.trim() !== '';
      steps.push({
        id: 'position',
        label: PROFILE_STEPS.position.label,
        completed: positionCompleted,
        required: PROFILE_STEPS.position.required,
        weight: PROFILE_STEPS.position.weight,
      });
      if (positionCompleted) {
        completedCount++;
        totalPercentage += PROFILE_STEPS.position.weight;
      }

      // Card Data (Age, Height, Weight, Foot) - Combined into one step
      const ageCompleted = !!user.age && user.age > 0;
      const heightCompleted = !!user.height && user.height > 0;
      const weightCompleted = !!user.weight && user.weight > 0;
      const footCompleted = !!user.preferredFoot && ['R', 'L', 'B'].includes(user.preferredFoot);
      
      // Card data is complete if ALL fields are filled
      const cardDataCompleted = ageCompleted && heightCompleted && weightCompleted && footCompleted;
      
      steps.push({
        id: 'cardData',
        label: PROFILE_STEPS.cardData.label,
        completed: cardDataCompleted,
        required: PROFILE_STEPS.cardData.required,
        weight: PROFILE_STEPS.cardData.weight,
      });
      if (cardDataCompleted) {
        completedCount++;
        totalPercentage += PROFILE_STEPS.cardData.weight;
      }

      // Brand
      const brandCompleted = !!user.brandLogo && user.brandLogo.trim() !== '';
      steps.push({
        id: 'brand',
        label: PROFILE_STEPS.brand.label,
        completed: brandCompleted,
        required: PROFILE_STEPS.brand.required,
        weight: PROFILE_STEPS.brand.weight,
      });
      if (brandCompleted) {
        completedCount++;
        totalPercentage += PROFILE_STEPS.brand.weight;
      }

      // Social Links
      const socialLinksCompleted = !!user.socialLinks && Object.keys(user.socialLinks as any).length > 0;
      steps.push({
        id: 'socialLinks',
        label: PROFILE_STEPS.socialLinks.label,
        completed: socialLinksCompleted,
        required: PROFILE_STEPS.socialLinks.required,
        weight: PROFILE_STEPS.socialLinks.weight,
      });
      if (socialLinksCompleted) {
        completedCount++;
        totalPercentage += PROFILE_STEPS.socialLinks.weight;
      }

      // Check if user can upload video (at least 3 required steps completed)
      const requiredStepsCompleted = steps.filter(s => s.required && s.completed).length;
      const canUploadVideo = requiredStepsCompleted >= 3;

      // Prepare completion steps object
      const completionStepsObj = steps.reduce((acc, step) => {
        acc[step.id] = step.completed;
        return acc;
      }, {} as Record<string, boolean>);

      // ✅ Skip the DB update if nothing actually changed. The previous
      // code wrote on every GET, which under polling pressure (frontend hits
      // the endpoint on every focus) caused row-level lock contention with
      // legitimate user.update calls and showed up as 30s timeouts.
      try {
        // Find user by clerkUserId AGAIN to read current persisted values.
        // We already have `user.id`; this is a single PK lookup.
        const persisted = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            profileCompletionPercentage: true,
            profileCompletionSteps: true,
          },
        });
        const newPct = Math.round(totalPercentage);
        const oldPct = persisted?.profileCompletionPercentage ?? null;
        const oldSteps = (persisted?.profileCompletionSteps as Record<string, boolean>) || {};
        const stepsChanged =
          Object.keys(completionStepsObj).length !== Object.keys(oldSteps).length ||
          Object.entries(completionStepsObj).some(([k, v]) => oldSteps[k] !== v);

        if (oldPct !== newPct || stepsChanged) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              profileCompletionPercentage: newPct,
              profileCompletionSteps: completionStepsObj,
            },
          });
        }
      } catch (persistErr) {
        logger.error(`Profile completion DB persist failed for ${clerkUserId}:`, persistErr);
        // Still return computed status so clients are not stuck on 500
      }

      logger.info(`Profile completion updated for user ${clerkUserId}:`, {
        percentage: Math.round(totalPercentage),
        completedSteps: completedCount,
        totalSteps: steps.length,
      });

      return {
        percentage: Math.round(totalPercentage),
        completedSteps: completedCount,
        totalSteps: steps.length,
        steps,
        canUploadVideo,
        missingRequiredSteps: missingRequired,
      };
    } catch (error) {
      logger.error('Error calculating profile completion:', error);
      return buildFallbackCompletionStatus();
    }
  }

  /**
   * Mark a step as completed
   */
  static async markStepCompleted(clerkUserId: string, stepId: string): Promise<void> {
    try {
      // Find user by clerkUserId and get internal ID
      let user = await prisma.user.findUnique({
        where: { clerkUserId: clerkUserId },
        select: { 
          id: true,
          profileCompletionSteps: true 
        },
      });

      // Never insert email: '' — violates @unique and breaks a second user; use same path as /clerk/me
      if (!user) {
        logger.warn(`User not found for clerkUserId: ${clerkUserId}, syncing via ClerkUserService`);
        await ClerkUserService.findOrCreateUser(clerkUserId);
        user = await prisma.user.findUnique({
          where: { clerkUserId: clerkUserId },
          select: {
            id: true,
            profileCompletionSteps: true,
          },
        });
      }

      if (!user) {
        throw new Error('User could not be loaded after sync');
      }

      const steps = (user.profileCompletionSteps as Record<string, boolean>) || {};
      steps[stepId] = true;
      await prisma.user.update({
        where: { id: user.id },
        data: { profileCompletionSteps: steps },
      });

      // Recalculate completion percentage
      await this.getCompletionStatus(clerkUserId);
    } catch (error) {
      logger.error('Error marking step completed:', error);
      throw error;
    }
  }
}
