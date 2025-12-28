import { StyleSheet, Dimensions, Platform } from 'react-native';
import { COLORS, EFFECTS } from '../reels/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
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
  sideMenu: { position: 'absolute', right: 0, top: 0, bottom: 0, width: SCREEN_WIDTH * 0.75, backgroundColor: '#0a0a0a', borderLeftWidth: 1, borderLeftColor: 'rgba(34, 197, 94, 0.3)', shadowColor: '#22c55e', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 20 },
});