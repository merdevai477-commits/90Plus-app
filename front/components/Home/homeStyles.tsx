import { StyleSheet, Dimensions, Platform } from 'react-native';
import { COLORS, EFFECTS } from '../reels/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Updated: Added skeletonContainer and horizontalList styles
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepBlack,
  },

  // ====================
  // HEADER STYLES
  // ====================
  headerContainer: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    zIndex: 100,
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
    height: 150,
    zIndex: -1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: COLORS.deepBlack,
  },
  levelRing: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.neonGreen,
    opacity: 0.8,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.neonGreen,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.deepBlack,
  },
  levelText: {
    color: COLORS.deepBlack,
    fontSize: 10,
    fontWeight: 'bold',
  },
  greetingContainer: {
    justifyContent: 'center',
  },
  greetingText: {
    color: COLORS.textTertiary,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  usernameText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    maxWidth: 150,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(50, 205, 50, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(50, 205, 50, 0.3)',
  },
  pointsText: {
    color: COLORS.electricGreen,
    fontSize: 12,
    fontWeight: 'bold',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.error,
    borderWidth: 1,
    borderColor: COLORS.deepBlack,
  },

  // ====================
  // HERO SECTION STYLES
  // ====================
  heroContainer: {
    marginBottom: 24,
  },
  heroScrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  heroCard: {
    width: SCREEN_WIDTH * 0.85,
    height: 200,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.mediumGray,
    position: 'relative',
    ...EFFECTS.softShadow,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 20,
    justifyContent: 'flex-end',
  },
  heroTag: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: COLORS.neonGreen,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  heroTagText: {
    color: COLORS.deepBlack,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    ...Platform.select({
      web: {
        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
      },
      default: {
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
      },
    }),
  },
  heroSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },

  // ====================
  // QUICK ACTIONS STYLES
  // ====================
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 32,
  },
  actionCard: {
    flex: 1,
    minWidth: (SCREEN_WIDTH - 52) / 2,
    height: 100,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  actionGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(50, 205, 50, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  actionArrow: {
    position: 'absolute',
    top: 16,
    right: 16,
    opacity: 0.5,
  },

  // ====================
  // SECTION STYLES
  // ====================
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  viewAllText: {
    color: COLORS.neonGreen,
    fontSize: 12,
    fontWeight: '600',
  },
  skeletonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  horizontalList: {
    paddingHorizontal: 20,
  },

  // ====================
  // VIDEO CARD STYLES
  // ====================
  videoCard: {
    width: 160,
    marginRight: 12,
    backgroundColor: COLORS.mediumGray,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  videoThumbnailContainer: {
    position: 'relative',
    width: '100%',
    height: 120,
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    color: COLORS.white,
    fontWeight: '600',
  },
  videoTitle: {
    padding: 10,
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  videoStats: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },

  // ====================
  // TEAM OF THE MONTH STYLES
  // ====================
  teamOfMonthContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  fullWidthTeamCard: {
    backgroundColor: COLORS.mediumGray,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  teamFormation: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  largeFootballField: {
    width: '100%',
    height: 300,
    backgroundColor: '#1a4d2e',
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  fieldBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  centerCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    transform: [{ translateX: -40 }, { translateY: -40 }],
  },
  centerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  goalArea: {
    position: 'absolute',
    top: '40%',
    left: 0,
    width: 40,
    height: '20%',
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  penaltyArea: {
    position: 'absolute',
    top: '30%',
    left: 0,
    width: 80,
    height: '40%',
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  playerDot: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  playerDotImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.neonGreen,
    backgroundColor: COLORS.mediumGray,
  },
  playerDotName: {
    marginTop: 4,
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },

  // ====================
  // PLAYER CARD STYLES
  // ====================
  playerCard: {
    width: 140,
    height: 220,
    backgroundColor: COLORS.mediumGray,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  playerImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  errorPlaceholder: {
    backgroundColor: COLORS.darkGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerInfo: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  playerName: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  playerPosition: {
    color: COLORS.neonGreen,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  playerTeam: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  rating: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Legacy styles for compatibility (can be refactored later)
  scrollView: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  overlayIconWrap: { width: 160, height: 160, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#3a2a0a', backgroundColor: 'rgba(0,0,0,0.6)' },
  
  // ====================
  // SIDE MENU STYLES
  // ====================
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  sideMenu: { 
    position: 'absolute', 
    right: 0, 
    top: 0, 
    bottom: 0, 
    width: SCREEN_WIDTH * 0.75, 
    backgroundColor: '#0a0a0a', 
    borderLeftWidth: 1, 
    borderLeftColor: 'rgba(34, 197, 94, 0.3)', 
    ...Platform.select({
      web: {
        boxShadow: '-4px 0 12px rgba(34, 197, 94, 0.4)',
      },
      default: {
        shadowColor: '#22c55e',
        shadowOffset: { width: -4, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
    }),
    elevation: 20,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  sideMenuHeader: {
    marginBottom: 32,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sideMenuTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  sideMenuItems: {
    flex: 1,
  },
  sideMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 16,
  },
  sideMenuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    marginTop: 'auto',
    marginBottom: 16,
  },
  logoutText: {
    color: '#ff3b30',
  },
  sideMenuFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});