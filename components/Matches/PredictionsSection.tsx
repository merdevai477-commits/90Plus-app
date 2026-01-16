/**
 * Predictions Section Component
 * مكون قسم التوقعات - لعرض المباريات القادمة وتوقعاتها
 */

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/clerk-expo';
import { MATCH_DETAILS_COLORS } from '../../constants/matchDetailsColors';
import { Match } from '../league-center/matchCardUtils';
import { PredictionsService, Prediction } from '../../services/predictions.service';
import { useCoins } from '../../contexts/CoinsContext';
import { logger } from '../../utils/logger';
import { MAJOR_LEAGUES } from '../../services/apiFootball';

interface PredictionsSectionProps {
  matches: Match[];
  onMatchPress?: (matchId: string) => void;
}

interface PredictionState {
  [matchId: string]: {
    prediction?: 'home' | 'draw' | 'away';
    isCorrect?: boolean;
    loading?: boolean;
  };
}

const PREDICTION_COST = 5; // تكلفة التوقع بالتذاكر
const MAX_PREDICTIONS_TO_SHOW = 10; // الحد الأقصى للمباريات المعروضة

const PredictionsSection: React.FC<PredictionsSectionProps> = ({ matches, onMatchPress }) => {
  const { getToken } = useAuth();
  const { coins, subtractCoins, addCoins } = useCoins();
  const [predictions, setPredictions] = useState<PredictionState>({});
  const [loading, setLoading] = useState(false);
  const [remainingPredictions, setRemainingPredictions] = useState<number | null>(null);

  // Filter and sort matches: Major leagues first, then alphabetically, then pick random 10
  const displayedMatches = useMemo(() => {
    // الدوريات الخمسة الكبرى
    const majorLeaguesSet = new Set([
      MAJOR_LEAGUES.PREMIER_LEAGUE,
      MAJOR_LEAGUES.LA_LIGA,
      MAJOR_LEAGUES.BUNDESLIGA,
      MAJOR_LEAGUES.SERIE_A,
      MAJOR_LEAGUES.LIGUE_1,
    ]);

    // ترتيب المباريات
    const sortedMatches = [...matches].sort((a, b) => {
      const aLeagueId = a.league?.id || 0;
      const bLeagueId = b.league?.id || 0;
      
      const aIsMajor = majorLeaguesSet.has(aLeagueId);
      const bIsMajor = majorLeaguesSet.has(bLeagueId);
      
      // الدوريات الكبرى أولاً
      if (aIsMajor && !bIsMajor) return -1;
      if (bIsMajor && !aIsMajor) return 1;
      
      // إذا كانت كلاهما من الدوريات الكبرى، حافظ على الترتيب
      if (aIsMajor && bIsMajor) {
        const majorOrder = [
          MAJOR_LEAGUES.PREMIER_LEAGUE,
          MAJOR_LEAGUES.LA_LIGA,
          MAJOR_LEAGUES.BUNDESLIGA,
          MAJOR_LEAGUES.SERIE_A,
          MAJOR_LEAGUES.LIGUE_1,
        ];
        const aIndex = majorOrder.indexOf(aLeagueId);
        const bIndex = majorOrder.indexOf(bLeagueId);
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
      }
      
      // ترتيب أبجدي للباقي
      const aLeagueName = a.league?.name || '';
      const bLeagueName = b.league?.name || '';
      return aLeagueName.localeCompare(bLeagueName, 'ar');
    });

    // اختيار 10 مباريات بشكل عشوائي من المباريات المرتبة
    // نأخذ مزيج من الدوريات الكبرى والباقي
    const majorLeagueMatches = sortedMatches.filter(m => 
      majorLeaguesSet.has(m.league?.id || 0)
    );
    const otherMatches = sortedMatches.filter(m => 
      !majorLeaguesSet.has(m.league?.id || 0)
    );

    // نأخذ 6-7 من الدوريات الكبرى (إذا متوفرة)
    const majorToTake = Math.min(7, majorLeagueMatches.length);
    const selectedMajor = shuffleArray(majorLeagueMatches).slice(0, majorToTake);
    
    // نكمل ل 10 من الباقي
    const othersToTake = Math.min(
      MAX_PREDICTIONS_TO_SHOW - selectedMajor.length,
      otherMatches.length
    );
    const selectedOthers = shuffleArray(otherMatches).slice(0, othersToTake);
    
    // دمج المباريات مع الحفاظ على الترتيب (الدوريات الكبرى أولاً)
    return [...selectedMajor, ...selectedOthers].slice(0, MAX_PREDICTIONS_TO_SHOW);
  }, [matches]);

  // Helper function to shuffle array (Fisher-Yates algorithm)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Load user predictions on mount
  useEffect(() => {
    loadUserPredictions();
    loadRemainingPredictions();
  }, []);

  const loadUserPredictions = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const { predictionsMap } = await PredictionsService.getUserPredictions(token);
      
      const newState: PredictionState = {};
      Object.keys(predictionsMap).forEach((matchId) => {
        const pred = predictionsMap[matchId];
        newState[matchId] = {
          prediction: pred.prediction.type,
          isCorrect: pred.isCorrect,
        };
      });
      
      setPredictions(newState);
    } catch (error) {
      logger.error('Error loading user predictions:', error);
    }
  };

  const loadRemainingPredictions = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const data = await PredictionsService.getRemainingPredictions(token);
      setRemainingPredictions(data.remaining);
    } catch (error) {
      logger.error('Error loading remaining predictions:', error);
    }
  };

  const handlePrediction = useCallback(
    async (match: Match, predictionType: 'home' | 'draw' | 'away') => {
      // Check if already predicted
      if (predictions[match.id]?.prediction) {
        Alert.alert(
          'تنبيه',
          'لقد قمت بالتوقع على هذه المباراة مسبقاً. لا يمكن تغيير التوقع.',
          [{ text: 'حسناً' }]
        );
        return;
      }

      // Check coins
      if (coins < PREDICTION_COST) {
        Alert.alert(
          'تذاكر غير كافية',
          `تحتاج إلى ${PREDICTION_COST} تذاكر للتوقع. رصيدك الحالي: ${coins}`,
          [{ text: 'حسناً' }]
        );
        return;
      }

      // Check remaining predictions
      if (remainingPredictions !== null && remainingPredictions <= 0) {
        Alert.alert(
          'حد التوقعات اليومي',
          'لقد وصلت إلى الحد الأقصى للتوقعات اليومية. جرب مرة أخرى غداً!',
          [{ text: 'حسناً' }]
        );
        return;
      }

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // Set loading state
        setPredictions((prev) => ({
          ...prev,
          [match.id]: { ...prev[match.id], loading: true },
        }));

        const token = await getToken();
        if (!token) throw new Error('No authentication token');

        // Submit prediction
        await PredictionsService.submitPrediction(token, {
          apiMatchId: match.id,
          predictionType,
          homeTeam: match.homeTeam?.name || 'Home',
          awayTeam: match.awayTeam?.name || 'Away',
          homeTeamLogo: match.homeTeam?.logo,
          awayTeamLogo: match.awayTeam?.logo,
          matchDate: match.fixtureDate || new Date().toISOString(),
          leagueName: match.league?.name,
        });

        // Deduct coins
        const success = await subtractCoins(PREDICTION_COST);
        if (!success) {
          throw new Error('Failed to deduct coins');
        }

        // Update state
        setPredictions((prev) => ({
          ...prev,
          [match.id]: { prediction: predictionType, loading: false },
        }));

        // Update remaining predictions
        if (remainingPredictions !== null) {
          setRemainingPredictions(remainingPredictions - 1);
        }

        Alert.alert(
          'تم التوقع بنجاح! 🎯',
          `تم خصم ${PREDICTION_COST} تذاكر. سيتم تحديث النتيجة بعد انتهاء المباراة.`,
          [{ text: 'رائع!' }]
        );
      } catch (error) {
        logger.error('Error submitting prediction:', error);
        
        // Reset loading state
        setPredictions((prev) => ({
          ...prev,
          [match.id]: { ...prev[match.id], loading: false },
        }));

        Alert.alert(
          'خطأ',
          'حدث خطأ أثناء إرسال التوقع. حاول مرة أخرى.',
          [{ text: 'حسناً' }]
        );
      }
    },
    [predictions, coins, remainingPredictions, getToken, subtractCoins]
  );

  const renderPredictionButtons = (match: Match) => {
    const matchPrediction = predictions[match.id];
    const isLoading = matchPrediction?.loading;
    const hasPredicted = !!matchPrediction?.prediction;

    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={MATCH_DETAILS_COLORS.accent} />
          <Text style={styles.loadingText}>جاري التوقع...</Text>
        </View>
      );
    }

    return (
      <View style={styles.predictionButtons}>
        {/* Home Win */}
        <TouchableOpacity
          style={[
            styles.predictionButton,
            matchPrediction?.prediction === 'home' && styles.predictionButtonActive,
            hasPredicted && matchPrediction?.prediction !== 'home' && styles.predictionButtonDisabled,
          ]}
          onPress={() => handlePrediction(match, 'home')}
          disabled={hasPredicted}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={
              matchPrediction?.prediction === 'home'
                ? ['rgba(34, 197, 94, 0.3)', 'rgba(34, 197, 94, 0.1)']
                : ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']
            }
            style={styles.buttonGradient}
          >
            <Text style={[
              styles.predictionButtonText,
              matchPrediction?.prediction === 'home' && styles.predictionButtonTextActive,
            ]}>
              فوز
            </Text>
            <Text style={styles.predictionButtonLabel}>
              {match.homeTeam?.name?.substring(0, 10)}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Draw */}
        <TouchableOpacity
          style={[
            styles.predictionButton,
            matchPrediction?.prediction === 'draw' && styles.predictionButtonActive,
            hasPredicted && matchPrediction?.prediction !== 'draw' && styles.predictionButtonDisabled,
          ]}
          onPress={() => handlePrediction(match, 'draw')}
          disabled={hasPredicted}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={
              matchPrediction?.prediction === 'draw'
                ? ['rgba(250, 204, 21, 0.3)', 'rgba(250, 204, 21, 0.1)']
                : ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']
            }
            style={styles.buttonGradient}
          >
            <Text style={[
              styles.predictionButtonText,
              matchPrediction?.prediction === 'draw' && styles.predictionButtonTextActive,
            ]}>
              تعادل
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Away Win */}
        <TouchableOpacity
          style={[
            styles.predictionButton,
            matchPrediction?.prediction === 'away' && styles.predictionButtonActive,
            hasPredicted && matchPrediction?.prediction !== 'away' && styles.predictionButtonDisabled,
          ]}
          onPress={() => handlePrediction(match, 'away')}
          disabled={hasPredicted}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={
              matchPrediction?.prediction === 'away'
                ? ['rgba(239, 68, 68, 0.3)', 'rgba(239, 68, 68, 0.1)']
                : ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']
            }
            style={styles.buttonGradient}
          >
            <Text style={[
              styles.predictionButtonText,
              matchPrediction?.prediction === 'away' && styles.predictionButtonTextActive,
            ]}>
              فوز
            </Text>
            <Text style={styles.predictionButtonLabel}>
              {match.awayTeam?.name?.substring(0, 10)}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMatchCard = (match: Match) => {
    const matchPrediction = predictions[match.id];
    
    return (
      <View key={match.id} style={styles.matchCard}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)']}
          style={styles.cardGradient}
        >
          {/* Match Header */}
          <View style={styles.matchHeader}>
            <Text style={styles.leagueName}>{match.league?.name}</Text>
            <Text style={styles.matchTime}>
              {new Date(match.fixtureDate || '').toLocaleDateString('ar-EG', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          {/* Teams */}
          <View style={styles.teamsContainer}>
            <View style={styles.team}>
              <Image
                source={{ uri: match.homeTeam?.logo }}
                style={styles.teamLogo}
                resizeMode="contain"
              />
              <Text style={styles.teamName} numberOfLines={1}>
                {match.homeTeam?.name}
              </Text>
            </View>

            <Text style={styles.vs}>VS</Text>

            <View style={styles.team}>
              <Image
                source={{ uri: match.awayTeam?.logo }}
                style={styles.teamLogo}
                resizeMode="contain"
              />
              <Text style={styles.teamName} numberOfLines={1}>
                {match.awayTeam?.name}
              </Text>
            </View>
          </View>

          {/* Prediction Buttons */}
          {renderPredictionButtons(match)}

          {/* Prediction Result */}
          {matchPrediction?.prediction && matchPrediction.isCorrect !== undefined && (
            <View style={[
              styles.resultBanner,
              matchPrediction.isCorrect ? styles.resultBannerSuccess : styles.resultBannerFail,
            ]}>
              <Text style={styles.resultText}>
                {matchPrediction.isCorrect ? '✅ توقع صحيح! +10 تذاكر' : '❌ توقع خاطئ'}
              </Text>
            </View>
          )}

          {/* Cost Info */}
          {!matchPrediction?.prediction && (
            <View style={styles.costInfo}>
              <Text style={styles.costText}>
                💎 التكلفة: {PREDICTION_COST} تذاكر
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={MATCH_DETAILS_COLORS.accent} />
        <Text style={styles.loadingText}>جاري تحميل المباريات...</Text>
      </View>
    );
  }

  if (displayedMatches.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🎯</Text>
        <Text style={styles.emptyTitle}>لا توجد مباريات قادمة</Text>
        <Text style={styles.emptyMessage}>
          لا توجد مباريات قادمة متاحة للتوقع حالياً
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🎯 توقع نتائج المباريات</Text>
        {remainingPredictions !== null && (
          <Text style={styles.remainingText}>
            التوقعات المتبقية اليوم: {remainingPredictions}
          </Text>
        )}
        <Text style={styles.subtitle}>
          اختر فوز الفريق المضيف، التعادل، أو فوز الضيف
        </Text>
        <Text style={styles.matchCountText}>
          📊 عرض {displayedMatches.length} مباراة من أصل {matches.length}
        </Text>
      </View>

      {/* Matches List */}
      {displayedMatches.map(renderMatchCard)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: MATCH_DETAILS_COLORS.text,
    marginBottom: 8,
  },
  remainingText: {
    fontSize: 14,
    color: MATCH_DETAILS_COLORS.accent,
    marginBottom: 4,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: MATCH_DETAILS_COLORS.textSecondary,
  },
  matchCountText: {
    fontSize: 12,
    color: MATCH_DETAILS_COLORS.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  matchCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leagueName: {
    fontSize: 12,
    color: MATCH_DETAILS_COLORS.textSecondary,
    fontWeight: '600',
  },
  matchTime: {
    fontSize: 12,
    color: MATCH_DETAILS_COLORS.textSecondary,
  },
  teamsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  team: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    width: 48,
    height: 48,
    marginBottom: 8,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: MATCH_DETAILS_COLORS.text,
    textAlign: 'center',
  },
  vs: {
    fontSize: 16,
    fontWeight: 'bold',
    color: MATCH_DETAILS_COLORS.textSecondary,
    marginHorizontal: 16,
  },
  predictionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  predictionButton: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  predictionButtonActive: {
    borderWidth: 2,
    borderColor: MATCH_DETAILS_COLORS.accent,
  },
  predictionButtonDisabled: {
    opacity: 0.4,
  },
  buttonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  predictionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: MATCH_DETAILS_COLORS.text,
    marginBottom: 2,
  },
  predictionButtonTextActive: {
    color: MATCH_DETAILS_COLORS.accent,
  },
  predictionButtonLabel: {
    fontSize: 10,
    color: MATCH_DETAILS_COLORS.textSecondary,
    textAlign: 'center',
  },
  resultBanner: {
    marginTop: 12,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  resultBannerSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  resultBannerFail: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  resultText: {
    fontSize: 14,
    fontWeight: '600',
    color: MATCH_DETAILS_COLORS.text,
  },
  costInfo: {
    marginTop: 8,
    alignItems: 'center',
  },
  costText: {
    fontSize: 12,
    color: MATCH_DETAILS_COLORS.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: MATCH_DETAILS_COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: MATCH_DETAILS_COLORS.text,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: MATCH_DETAILS_COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default PredictionsSection;
