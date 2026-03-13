/**
 * Profile Completion Service
 * Tracks and calculates user profile completion percentage
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

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

// Define profile completion steps
const PROFILE_STEPS = {
  avatar: { label: 'صورة البروفايل', required: true, weight: 20 },
  country: { label: 'البلد', required: true, weight: 15 },
  club: { label: 'النادي المفضل', required: true, weight: 15 },
  bio: { label: 'النبذة التعريفية', required: false, weight: 10 },
  position: { label: 'المركز', required: false, weight: 10 },
  cardData: { label: 'بيانات الكارت', required: false, weight: 20 }, // Combined: age, height, weight, foot
  brand: { label: 'البراند المفضل', required: false, weight: 5 },
  socialLinks: { label: 'روابط السوشيال ميديا', required: false, weight: 5 },
};

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

      // If user doesn't exist, create a basic profile
      if (!user) {
        logger.warn(`User not found for clerkUserId: ${clerkUserId}, creating basic profile`);
        
        // Create user with minimal data
        user = await prisma.user.create({
          data: {
            clerkUserId: clerkUserId,
            username: `user_${clerkUserId.slice(0, 8)}`, // Temporary username
            email: '', // Will be updated by webhook
            profileCompletionSteps: {},
            profileCompletionPercentage: 0,
          },
          select: {
            id: true,
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
      }

      // Check each step
      const steps: ProfileCompletionStep[] = [];
      let completedCount = 0;
      let totalPercentage = 0;
      const missingRequired: string[] = [];

      // Avatar
      const avatarCompleted = !!user.avatar && user.avatar.trim() !== '';
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

      // Country
      const countryCompleted = !!user.countryFlag && !!user.country;
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

      // Update user's completion percentage in database using internal ID
      await prisma.user.update({
        where: { id: user.id },
        data: {
          profileCompletionPercentage: Math.round(totalPercentage),
          profileCompletionSteps: completionStepsObj,
        },
      });

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
      throw error;
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

      // If user doesn't exist, create basic profile first
      if (!user) {
        logger.warn(`User not found for clerkUserId: ${clerkUserId}, creating basic profile`);
        
        user = await prisma.user.create({
          data: {
            clerkUserId: clerkUserId,
            username: `user_${clerkUserId.slice(0, 8)}`,
            email: '',
            profileCompletionSteps: { [stepId]: true },
            profileCompletionPercentage: 0,
          },
          select: { 
            id: true,
            profileCompletionSteps: true 
          },
        });
      } else {
        // Update existing user
        const steps = (user.profileCompletionSteps as Record<string, boolean>) || {};
        steps[stepId] = true;

        await prisma.user.update({
          where: { id: user.id },
          data: { profileCompletionSteps: steps },
        });
      }

      // Recalculate completion percentage
      await this.getCompletionStatus(clerkUserId);
    } catch (error) {
      logger.error('Error marking step completed:', error);
      throw error;
    }
  }
}
