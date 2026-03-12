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
  age: { label: 'العمر', required: false, weight: 5 },
  height: { label: 'الطول', required: false, weight: 5 },
  weight: { label: 'الوزن', required: false, weight: 5 },
  foot: { label: 'القدم المفضلة', required: false, weight: 5 },
  brand: { label: 'البراند المفضل', required: false, weight: 5 },
  socialLinks: { label: 'روابط السوشيال ميديا', required: false, weight: 5 },
};

export class ProfileCompletionService {
  /**
   * Calculate profile completion status for a user
   */
  static async getCompletionStatus(userId: string): Promise<ProfileCompletionStatus> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
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

      if (!user) {
        throw new Error('User not found');
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

      // Age
      const ageCompleted = !!user.age && user.age > 0;
      steps.push({
        id: 'age',
        label: PROFILE_STEPS.age.label,
        completed: ageCompleted,
        required: PROFILE_STEPS.age.required,
        weight: PROFILE_STEPS.age.weight,
      });
      if (ageCompleted) {
        completedCount++;
        totalPercentage += PROFILE_STEPS.age.weight;
      }

      // Height
      const heightCompleted = !!user.height && user.height > 0;
      steps.push({
        id: 'height',
        label: PROFILE_STEPS.height.label,
        completed: heightCompleted,
        required: PROFILE_STEPS.height.required,
        weight: PROFILE_STEPS.height.weight,
      });
      if (heightCompleted) {
        completedCount++;
        totalPercentage += PROFILE_STEPS.height.weight;
      }

      // Weight
      const weightCompleted = !!user.weight && user.weight > 0;
      steps.push({
        id: 'weight',
        label: PROFILE_STEPS.weight.label,
        completed: weightCompleted,
        required: PROFILE_STEPS.weight.required,
        weight: PROFILE_STEPS.weight.weight,
      });
      if (weightCompleted) {
        completedCount++;
        totalPercentage += PROFILE_STEPS.weight.weight;
      }

      // Foot
      const footCompleted = !!user.preferredFoot && ['R', 'L', 'B'].includes(user.preferredFoot);
      steps.push({
        id: 'foot',
        label: PROFILE_STEPS.foot.label,
        completed: footCompleted,
        required: PROFILE_STEPS.foot.required,
        weight: PROFILE_STEPS.foot.weight,
      });
      if (footCompleted) {
        completedCount++;
        totalPercentage += PROFILE_STEPS.foot.weight;
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

      // Update user's completion percentage in database
      await prisma.user.update({
        where: { id: userId },
        data: {
          profileCompletionPercentage: Math.round(totalPercentage),
          profileCompletionSteps: steps.reduce((acc, step) => {
            acc[step.id] = step.completed;
            return acc;
          }, {} as Record<string, boolean>),
        },
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
  static async markStepCompleted(userId: string, stepId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { profileCompletionSteps: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const steps = (user.profileCompletionSteps as Record<string, boolean>) || {};
      steps[stepId] = true;

      await prisma.user.update({
        where: { id: userId },
        data: { profileCompletionSteps: steps },
      });

      // Recalculate completion percentage
      await this.getCompletionStatus(userId);
    } catch (error) {
      logger.error('Error marking step completed:', error);
      throw error;
    }
  }
}
