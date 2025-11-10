import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { 
  Star, 
  Trophy, 
  Award, 
  Shield, 
  Crown,
  CheckCircle,
  Users,
  Heart,
  MessageCircle,
  Share
} from 'lucide-react-native';
import { useFadeIn, useSlideIn, usePulse } from '../leagues/Animations';
import { useHapticFeedback } from '../leagues/HapticFeedback';

const { width } = Dimensions.get('window');

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  weight: number;
  height: number;
  strongFoot: 'left' | 'right';
  position: string;
  favoriteClub: {
    name: string;
    logo: string;
    country: string;
  };
  cardType: 'bronze' | 'silver' | 'gold' | 'diamond';
  isVerified: boolean;
  followers: number;
  bio: string;
  stats: {
    predictions: number;
    questions: number;
    interactions: number;
    level: number;
  };
  isOwner?: boolean;
}

interface FifaCardProps {
  profile: UserProfile;
  onPress?: () => void;
  showActions?: boolean;
}

const FifaCard: React.FC<FifaCardProps> = ({ 
  profile, 
  onPress, 
  showActions = true 
}) => {
  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(800);
  const slideAnim = useSlideIn('up', 600);
  const pulseAnim = usePulse(1, 1.05, 2000);

  const getCardGradient = () => {
    switch (profile.cardType) {
      case 'bronze':
        return ['#CD7F32', '#B8860B', '#DAA520'];
      case 'silver':
        return ['#C0C0C0', '#A8A8A8', '#808080'];
      case 'gold':
        return ['#FFD700', '#FFA500', '#FF8C00'];
      case 'diamond':
        return ['#B9F2FF', '#00BFFF', '#1E90FF'];
      default:
        return ['#22c55e', '#16a34a', '#15803d'];
    }
  };

  const getCardStyle = () => {
    const gradient = getCardGradient();
    return {
      backgroundColor: gradient[0],
      borderColor: gradient[1],
      shadowColor: gradient[2],
    };
  };

  const getCardIcon = () => {
    switch (profile.cardType) {
      case 'bronze':
        return <Award size={24} color="#CD7F32" />;
      case 'silver':
        return <Shield size={24} color="#C0C0C0" />;
      case 'gold':
        return <Trophy size={24} color="#FFD700" />;
      case 'diamond':
        return <Crown size={24} color="#B9F2FF" />;
      default:
        return <Star size={24} color="#22c55e" />;
    }
  };

  const handlePress = () => {
    haptic.cardTap();
    onPress?.();
  };

  const handleAction = (action: string) => {
    haptic.buttonPress();
    console.log(`${action} for ${profile.username}`);
  };

  return (
    <Animated.View 
      style={[
        styles.container,
        getCardStyle(),
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: pulseAnim }
          ]
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.cardContent}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: profile.avatar }} style={styles.avatar} />
              {profile.isVerified && (
                <View style={styles.verifiedBadge}>
                  <CheckCircle size={16} color="#1DA1F2" />
                </View>
              )}
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.displayName}>{profile.displayName}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
              {profile.isOwner && (
                <View style={styles.ownerBadge}>
                  <Crown size={12} color="#FFD700" />
                  <Text style={styles.ownerText}>مالك التطبيق</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.cardTypeContainer}>
            {getCardIcon()}
            <Text style={styles.cardTypeText}>
              {profile.cardType === 'diamond' ? 'ماسي' :
               profile.cardType === 'gold' ? 'ذهبي' :
               profile.cardType === 'silver' ? 'فضي' : 'برونزي'}
            </Text>
          </View>
        </View>

        {/* Player Stats */}
        <View style={styles.playerStats}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>الوزن</Text>
            <Text style={styles.statValue}>{profile.weight} كجم</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>الطول</Text>
            <Text style={styles.statValue}>{profile.height} سم</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>القدم القوية</Text>
            <Text style={styles.statValue}>
              {profile.strongFoot === 'right' ? 'يمنى' : 'يسرى'}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>المركز</Text>
            <Text style={styles.statValue}>{profile.position}</Text>
          </View>
        </View>

        {/* Favorite Club */}
        <View style={styles.clubSection}>
          <View style={styles.clubInfo}>
            <Image source={{ uri: profile.favoriteClub.logo }} style={styles.clubLogo} />
            <View style={styles.clubDetails}>
              <Text style={styles.clubName}>{profile.favoriteClub.name}</Text>
              <Text style={styles.clubCountry}>{profile.favoriteClub.country}</Text>
            </View>
          </View>
        </View>

        {/* Bio */}
        <View style={styles.bioSection}>
          <Text style={styles.bioText}>{profile.bio}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.stats.predictions}</Text>
            <Text style={styles.statLabelSmall}>توقعات</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.stats.questions}</Text>
            <Text style={styles.statLabelSmall}>أسئلة</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.stats.interactions}</Text>
            <Text style={styles.statLabelSmall}>تفاعلات</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile.stats.level}</Text>
            <Text style={styles.statLabelSmall}>المستوى</Text>
          </View>
        </View>

        {/* Followers */}
        <View style={styles.followersSection}>
          <Users size={16} color="#666" />
          <Text style={styles.followersText}>
            {profile.followers.toLocaleString()} متابع
          </Text>
        </View>
      </TouchableOpacity>

      {/* Action Buttons */}
      {showActions && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleAction('like')}
          >
            <Heart size={20} color="#ff4444" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleAction('comment')}
          >
            <MessageCircle size={20} color="#3b82f6" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleAction('share')}
          >
            <Share size={20} color="#22c55e" />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  cardContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#fff',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 2,
  },
  userDetails: {
    flex: 1,
  },
  displayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    gap: 4,
  },
  ownerText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardTypeContainer: {
    alignItems: 'center',
    gap: 4,
  },
  cardTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  playerStats: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  clubSection: {
    marginBottom: 15,
  },
  clubInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
  },
  clubLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  clubDetails: {
    flex: 1,
  },
  clubName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  clubCountry: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  bioSection: {
    marginBottom: 15,
  },
  bioText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabelSmall: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  followersSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  followersText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionButton: {
    padding: 12,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export default FifaCard;
