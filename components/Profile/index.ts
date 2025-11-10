// Export all Profile components
export { default as FifaCard } from './FifaCard';
export { default as ClubLogo, ClubList, arabicClubs, worldClubs } from './ClubLogos';
export { default as ProfileSections } from './ProfileSections';
export { 
  allProfiles, 
  profilesByType, 
  searchProfiles, 
  getPopularProfiles, 
  getProfilesByLevel,
  diamondProfile,
  goldProfile,
  goldProfile2,
  silverProfile,
  silverProfile2,
  bronzeProfile,
  bronzeProfile2,
  bronzeProfile3,
  mockVideos
} from './MockProfiles';

// Export new components
export { default as VideosSectionNew } from './VideosSection';
export { default as DiamondCard } from './DiamondCard';
export { default as Dashboard } from './Dashboard';
export { default as VideosSection } from './VideosSection';
export { default as NotificationsSystem } from './NotificationsSystem';

// Export Diamond Mock Data
export {
  mockDiamondProfile,
  mockDashboardStats,
  diamondProfiles,
  getDiamondProfileById,
  getDiamondProfilesByLevel,
  searchDiamondProfiles,
  getPopularDiamondProfiles,
  getDiamondProfilesByClub,
  getDiamondProfilesByPosition,
  getVideosByProfile,
  getPopularVideos,
  getRecentVideos,
  searchVideos
} from './DiamondMockData';

// Export types
export type { UserProfile } from './FifaCard';
export type { DiamondProfile } from './DiamondCard';
export type { DashboardStats } from './Dashboard';
export type { VideoItem } from './VideosSection';
export type { NotificationItem } from './NotificationsSystem';
export type { Club } from './ClubLogos';
export type { ContentItem, Achievement, Interaction } from './ProfileSections';
