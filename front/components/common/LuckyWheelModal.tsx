import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  Vibration,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Coins, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { G, Path, Text as SvgText, Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Line } from 'react-native-svg';
import { Lock } from 'lucide-react-native';
import { useAuth } from '@clerk/clerk-expo';
import Constants from 'expo-constants';
import { useCoins } from '../../contexts/CoinsContext';
import { useTranslation } from '../../src/i18n';
import { getApiUrl } from '../../config/api.config';

const API_URL = getApiUrl();
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WHEEL_SIZE = SCREEN_WIDTH * 0.8;

// Brand palette: alternating Purple (primary) + Gold (accent) for a premium look
// كل قسم بلون متناوب - بنفسجي وذهبي (هوية 90Plus)
const PRIZES = [
  { coins: 5, probability: 35, label: '5', colorLight: '#A855F7', colorDark: '#6D28D9' },
  { coins: 10, probability: 25, label: '10', colorLight: '#F5C518', colorDark: '#B8860B' },
  { coins: 25, probability: 15, label: '25', colorLight: '#A855F7', colorDark: '#6D28D9' },
  { coins: 50, probability: 12, label: '50', colorLight: '#F5C518', colorDark: '#B8860B' },
  { coins: 100, probability: 8, label: '100', colorLight: '#A855F7', colorDark: '#6D28D9' },
  { coins: 200, probability: 4, label: '200', colorLight: '#F5C518', colorDark: '#B8860B' },
  { coins: 5, probability: 0.8, label: '5', colorLight: '#A855F7', colorDark: '#6D28D9' },
  { coins: 10, probability: 0.2, label: '10', colorLight: '#F5C518', colorDark: '#B8860B' },
];

interface LuckyWheelModalProps {
  visible: boolean;
  onClose: () => void;
  onCoinsWon?: (coins: number, newBalance: number) => void;
}

export default function LuckyWheelModal({ visible, onClose, onCoinsWon }: LuckyWheelModalProps) {
  const { t } = useTranslation();
  const [isSpinning, setIsSpinning] = useState(false);
  const [canSpin, setCanSpin] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<{ hours: number; minutes: number } | null>(null);
  const [wonPrize, setWonPrize] = useState<{ coins: number } | null>(null);
  const [showResult, setShowResult] = useState(false);
  
  const spinAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const resultScaleAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const spinValueRef = useRef(0);
  const spinListenerRef = useRef<string | null>(null);
  const spinSequenceRef = useRef<Animated.CompositeAnimation | null>(null);
  const spinLoopActiveRef = useRef(false);
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const MIN_FULL_SPINS = 6;
  const SPIN_LOOP_MS = 850;
  const MIN_SPIN_BEFORE_STOP_MS = 2200;
  
  const { getToken } = useAuth();
  const { coins: currentCoins, addCoins } = useCoins();

  // جلب حالة العجلة
  const fetchStatus = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/daily-spin/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.status === 'SUCCESS') {
        setCanSpin(data.data.canSpin);
        setTimeRemaining(data.data.timeRemaining);
      }
    } catch (error) {
      console.error('Error fetching spin status:', error);
    }
  }, [getToken]);

  const stopAllSpinAnimations = useCallback(() => {
    spinLoopActiveRef.current = false;
    spinSequenceRef.current?.stop();
    spinSequenceRef.current = null;
    spinAnim.stopAnimation();
  }, [spinAnim]);

  /** Cumulative 360° steps — avoids Animated.loop resetting back to 0. */
  const startSpinLoop = useCallback(() => {
    spinLoopActiveRef.current = true;

    const tick = (fromAngle: number) => {
      if (!spinLoopActiveRef.current) return;

      Animated.timing(spinAnim, {
        toValue: fromAngle + 360,
        duration: SPIN_LOOP_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || !spinLoopActiveRef.current) return;
        tick(fromAngle + 360);
      });
    };

    const start = spinValueRef.current || 0;
    tick(start);
  }, [spinAnim]);

  useEffect(() => {
    if (visible) {
      fetchStatus();
      spinAnim.setValue(0);
      spinValueRef.current = 0;

      glowLoopRef.current?.stop();
      glowLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      glowLoopRef.current.start();
    } else {
      stopAllSpinAnimations();
      glowLoopRef.current?.stop();
      glowLoopRef.current = null;
    }
    return () => {
      stopAllSpinAnimations();
      glowLoopRef.current?.stop();
      glowLoopRef.current = null;
    };
  }, [visible, fetchStatus, stopAllSpinAnimations, spinAnim, glowAnim]);

  // Track current spin value for multi-phase animation
  useEffect(() => {
    if (spinListenerRef.current) {
      spinAnim.removeListener(spinListenerRef.current);
      spinListenerRef.current = null;
    }
    spinListenerRef.current = spinAnim.addListener(({ value }) => {
      spinValueRef.current = value;
    });
    return () => {
      if (spinListenerRef.current) {
        spinAnim.removeListener(spinListenerRef.current);
        spinListenerRef.current = null;
      }
    };
  }, [spinAnim]);

  const computeFinalRotation = (startAngle: number, prizeIndex: number): number => {
    const segmentAngle = 360 / PRIZES.length;
    // Segment center under the top pointer when rotation ≡ this angle (mod 360)
    const targetMod =
      ((360 - prizeIndex * segmentAngle - segmentAngle / 2) % 360 + 360) % 360;
    const startMod = ((startAngle % 360) + 360) % 360;
    let extra = (targetMod - startMod + 360) % 360;
    if (extra < 10) extra += 360;
    return startAngle + MIN_FULL_SPINS * 360 + extra;
  };

  const runDecelerationSequence = (
    startAngle: number,
    prizeIndex: number,
    prize: typeof PRIZES[0],
  ) => {
    const finalRotation = computeFinalRotation(startAngle, prizeIndex);
    const midRotation = startAngle + (finalRotation - startAngle) * 0.72;

    spinSequenceRef.current = Animated.sequence([
      Animated.timing(spinAnim, {
        toValue: midRotation,
        duration: 2800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(spinAnim, {
        toValue: finalRotation,
        duration: 1400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    spinSequenceRef.current.start(async ({ finished }) => {
      if (!finished) return;
      // Keep cumulative angle — do not modulo (prevents visible snap / short spin)
      spinAnim.setValue(finalRotation);
      spinValueRef.current = finalRotation;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (Platform.OS === 'android') {
        Vibration.vibrate([0, 100, 50, 100, 50, 200]);
      }

      setWonPrize({ coins: prize.coins });
      setCanSpin(false);
      setIsSpinning(false);

      try {
        await addCoins(prize.coins);
      } catch (e) {
        console.error('Add coins error:', e);
      }

      setTimeout(() => {
        setShowResult(true);
        Animated.spring(resultScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }).start();

        if (onCoinsWon) {
          onCoinsWon(prize.coins, currentCoins + prize.coins);
        }
      }, 300);
    });
  };

  // لف العجلة - يبدأ فوراً عند الضغط
  const spinWheel = async () => {
    if (isSpinning || !canSpin) return;

    setIsSpinning(true);
    setShowResult(false);
    setWonPrize(null);
    resultScaleAnim.setValue(0);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    stopAllSpinAnimations();
    spinAnim.setValue(0);
    spinValueRef.current = 0;

    startSpinLoop();

    const spinStartedAt = Date.now();
    let finalPrizeIndex = 0;
    let finalPrize = PRIZES[0];
    let apiSucceeded = false;

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      const response = await fetch(`${API_URL}/daily-spin/spin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();

      if (data?.status === 'SUCCESS') {
        const prizeIndex = data.data?.prize?.prizeIndex;
        const idx =
          typeof prizeIndex === 'number' && prizeIndex >= 0 && prizeIndex < PRIZES.length
            ? prizeIndex
            : 0;
        finalPrizeIndex = idx;
        finalPrize = PRIZES[idx];
        apiSucceeded = true;
      }
    } catch (error) {
      console.error('Spin API error:', error);
    }

    const elapsed = Date.now() - spinStartedAt;
    if (elapsed < MIN_SPIN_BEFORE_STOP_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_BEFORE_STOP_MS - elapsed));
    }

    spinLoopActiveRef.current = false;
    spinAnim.stopAnimation();

    if (!apiSucceeded) {
      setIsSpinning(false);
      return;
    }

    const currentAngle = spinValueRef.current;
    spinAnim.setValue(currentAngle);
    runDecelerationSequence(currentAngle, finalPrizeIndex, finalPrize);
  };

  // رسم العجلة بالتصميم الجديد (مع السلاسل لو مقفولة)
  const renderWheel = (isLocked: boolean = false) => {
    const segmentAngle = 360 / PRIZES.length;
    const outerRadius = WHEEL_SIZE / 2 - 5;
    const innerRadius = WHEEL_SIZE / 2 - 60;
    const centerX = WHEEL_SIZE / 2;
    const centerY = WHEEL_SIZE / 2;
    const gap = 3; // المسافة بين الأقسام

    // ألوان رمادية للحالة المقفولة
    const getSegmentColors = (prize: typeof PRIZES[0], locked: boolean) => {
      if (locked) {
        return { light: '#4a4a4a', dark: '#2a2a2a' };
      }
      return { light: prize.colorLight, dark: prize.colorDark };
    };

    return (
      <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
        <Defs>
          {PRIZES.map((prize, index) => {
            const colors = getSegmentColors(prize, isLocked);
            return (
              <SvgLinearGradient key={`grad-${index}`} id={`gradient-${index}${isLocked ? '-locked' : ''}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={colors.light} />
                <Stop offset="100%" stopColor={colors.dark} />
              </SvgLinearGradient>
            );
          })}
          <SvgLinearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={isLocked ? '#666' : '#F5D485'} />
            <Stop offset="50%" stopColor={isLocked ? '#555' : '#D4A84B'} />
            <Stop offset="100%" stopColor={isLocked ? '#444' : '#B8860B'} />
          </SvgLinearGradient>
          <SvgLinearGradient id="goldRingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={isLocked ? '#555' : '#D4A84B'} />
            <Stop offset="100%" stopColor={isLocked ? '#333' : '#8B6914'} />
          </SvgLinearGradient>
        </Defs>
        
        {/* الخلفية الداكنة */}
        <Circle cx={centerX} cy={centerY} r={outerRadius + 5} fill="#1a1a2e" />
        
        {/* الأقسام */}
        <G>
          {PRIZES.map((prize, index) => {
            const startAngle = index * segmentAngle - 90 + gap / 2;
            const endAngle = startAngle + segmentAngle - gap;
            
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;
            
            // النقاط الخارجية
            const outerX1 = centerX + outerRadius * Math.cos(startRad);
            const outerY1 = centerY + outerRadius * Math.sin(startRad);
            const outerX2 = centerX + outerRadius * Math.cos(endRad);
            const outerY2 = centerY + outerRadius * Math.sin(endRad);
            
            // النقاط الداخلية
            const innerX1 = centerX + innerRadius * Math.cos(startRad);
            const innerY1 = centerY + innerRadius * Math.sin(startRad);
            const innerX2 = centerX + innerRadius * Math.cos(endRad);
            const innerY2 = centerY + innerRadius * Math.sin(endRad);
            
            const largeArcFlag = segmentAngle - gap > 180 ? 1 : 0;
            
            // رسم القسم كـ arc segment
            const pathData = `
              M ${innerX1} ${innerY1}
              L ${outerX1} ${outerY1}
              A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerX2} ${outerY2}
              L ${innerX2} ${innerY2}
              A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerX1} ${innerY1}
              Z
            `;

            // موقع النص
            const midAngle = startAngle + (segmentAngle - gap) / 2;
            const midRad = (midAngle * Math.PI) / 180;
            const textRadius = (outerRadius + innerRadius) / 2;
            const textX = centerX + textRadius * Math.cos(midRad);
            const textY = centerY + textRadius * Math.sin(midRad);

            return (
              <G key={index}>
                <Path
                  d={pathData}
                  fill={`url(#gradient-${index}${isLocked ? '-locked' : ''})`}
                  opacity={isLocked ? 0.6 : 1}
                />
                {/* Badge للجائزة */}
                <G transform={`translate(${textX}, ${textY}) rotate(${midAngle + 90})`}>
                  {/* خلفية الـ badge */}
                  <Path
                    d="M -18 -10 Q -18 -16 -12 -16 L 12 -16 Q 18 -16 18 -10 L 18 10 Q 18 16 12 16 L -12 16 Q -18 16 -18 10 Z"
                    fill="rgba(255,255,255,0.2)"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth={1}
                  />
                  <SvgText
                    x={0}
                    y={5}
                    fill="#fff"
                    fontSize={14}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {prize.label}
                  </SvgText>
                </G>
              </G>
            );
          })}
        </G>
        
        {/* الدائرة الداخلية الداكنة */}
        <Circle cx={centerX} cy={centerY} r={innerRadius - 5} fill="#1a1a2e" />
        
        {/* الحلقة الذهبية */}
        <Circle 
          cx={centerX} 
          cy={centerY} 
          r={55} 
          fill="none"
          stroke="url(#goldRingGradient)"
          strokeWidth={4}
        />
        
        {/* زر SPIN الذهبي */}
        <Circle cx={centerX} cy={centerY} r={50} fill="url(#goldGradient)" />
        
        {/* نص SPIN أو القفل */}
        {!isLocked ? (
          <SvgText
            x={centerX}
            y={centerY + 8}
            fill="#8B4513"
            fontSize={22}
            fontWeight="bold"
            textAnchor="middle"
          >
            SPIN
          </SvgText>
        ) : (
          <>
            {/* رمز القفل */}
            <SvgText
              x={centerX}
              y={centerY + 10}
              fill="#666"
              fontSize={28}
              textAnchor="middle"
            >
              🔒
            </SvgText>
          </>
        )}

        {/* السلاسل حول العجلة لو مقفولة */}
        {isLocked && (
          <G>
            {/* سلسلة أفقية */}
            <Line x1={20} y1={centerY} x2={WHEEL_SIZE - 20} y2={centerY} stroke="#555" strokeWidth={8} strokeLinecap="round" />
            <Line x1={20} y1={centerY} x2={WHEEL_SIZE - 20} y2={centerY} stroke="#777" strokeWidth={4} strokeLinecap="round" />
            
            {/* سلسلة عمودية */}
            <Line x1={centerX} y1={20} x2={centerX} y2={WHEEL_SIZE - 20} stroke="#555" strokeWidth={8} strokeLinecap="round" />
            <Line x1={centerX} y1={20} x2={centerX} y2={WHEEL_SIZE - 20} stroke="#777" strokeWidth={4} strokeLinecap="round" />
            
            {/* حلقات السلسلة */}
            <Circle cx={centerX} cy={40} r={12} fill="none" stroke="#666" strokeWidth={6} />
            <Circle cx={centerX} cy={WHEEL_SIZE - 40} r={12} fill="none" stroke="#666" strokeWidth={6} />
            <Circle cx={40} cy={centerY} r={12} fill="none" stroke="#666" strokeWidth={6} />
            <Circle cx={WHEEL_SIZE - 40} cy={centerY} r={12} fill="none" stroke="#666" strokeWidth={6} />
          </G>
        )}
      </Svg>
    );
  };

  const spinRotation = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Layered background — deep app gradient + strong blur */}
        <LinearGradient
          colors={['rgba(5,1,13,0.98)', 'rgba(30,15,60,0.96)', 'rgba(5,1,13,0.98)']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <BlurView intensity={60} style={StyleSheet.absoluteFill} tint="dark" />

        {/* Ambient glow behind wheel */}
        <View style={styles.ambientGlow} pointerEvents="none" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
            <X size={22} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.coinsDisplay}>
            <Coins size={18} color="#F5C518" />
            <Text style={styles.coinsText}>{currentCoins}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Sparkles size={22} color="#F5C518" />
          <Text style={styles.title}>{t.luckyWheel?.title || 'عجلة الحظ'}</Text>
          <Sparkles size={22} color="#A855F7" />
        </View>

        {/* Wheel Container */}
        <View style={styles.wheelContainer}>
          {/* Glow Effect */}
          <Animated.View style={[styles.wheelGlow, { opacity: glowOpacity }]} />
          
          {/* Wheel */}
          <Animated.View
            style={[
              styles.wheel,
              { transform: [{ rotate: spinRotation }] }
            ]}
          >
            {renderWheel(!canSpin)}
          </Animated.View>

          {/* Pointer - المؤشر فوق زر SPIN */}
          <View style={styles.pointerContainer}>
            <View style={styles.pointer} />
          </View>
        </View>

        {/* Spin Button أو Timer */}
        {canSpin ? (
          <Animated.View style={{ transform: [{ scale: buttonScaleAnim }] }}>
            <TouchableOpacity
              onPress={spinWheel}
              disabled={isSpinning}
              activeOpacity={0.85}
              style={[styles.spinButtonOuter, { shadowColor: '#A855F7' }]}
            >
              <LinearGradient
                colors={isSpinning ? ['#555', '#333'] : ['#A855F7', '#7C3AED', '#5B21B6']}
                style={styles.spinButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Sparkles size={18} color="#fff" />
                <Text style={styles.spinButtonText}>
                  {isSpinning ? (t.luckyWheel?.spinning || 'جاري اللف...') : (t.luckyWheel?.spin ? t.luckyWheel.spin + '!' : 'لف العجلة!')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={styles.lockedContainer}>
            {/* زر رمادي مقفول */}
            <View style={styles.lockedButtonOuter}>
              <LinearGradient
                colors={['#555', '#333']}
                style={styles.spinButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Lock size={20} color="#888" />
                <Text style={styles.lockedButtonText}>{t.luckyWheel?.locked || 'مقفولة'}</Text>
              </LinearGradient>
            </View>
            
            {/* Timer */}
            <View style={styles.timerContainer}>
              <Text style={styles.timerLabel}>{t.luckyWheel?.availableIn || 'متاح بعد'}</Text>
              <Text style={styles.timerText}>
                {timeRemaining ? `${timeRemaining.hours}:${String(timeRemaining.minutes).padStart(2, '0')}` : '00:00'}
              </Text>
            </View>
          </View>
        )}

        {/* Result Modal */}
        {showResult && wonPrize && (
          <Animated.View
            style={[
              styles.resultOverlay,
              { transform: [{ scale: resultScaleAnim }] }
            ]}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.95)', 'rgba(0,0,0,0.9)']}
              style={styles.resultContainer}
            >
              <Text style={styles.resultEmoji}>🎉</Text>
              <Text style={styles.resultTitle}>{t.luckyWheel?.congratulations || 'مبروك!'}</Text>
              <View style={styles.resultCoins}>
                <Coins size={38} color="#F5C518" />
                <Text style={styles.resultCoinsText}>+{wonPrize.coins}</Text>
              </View>
              <Text style={styles.resultSubtext}>{t.luckyWheel?.youWon || 'كسبت'} {wonPrize.coins} {t.luckyWheel?.coins || 'كوينز'}!</Text>
              
              <TouchableOpacity 
                onPress={() => { setShowResult(false); onClose(); }} 
                style={[styles.resultButton, { shadowColor: '#A855F7' }]}
              >
                <LinearGradient
                  colors={['#A855F7', '#7C3AED']}
                  style={styles.resultButtonGradient}
                >
                  <Text style={styles.resultButtonText}>{t.luckyWheel?.great || 'رائع!'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(5, 1, 13, 0.95)',
  },
  ambientGlow: {
    position: 'absolute',
    width: WHEEL_SIZE * 1.3,
    height: WHEEL_SIZE * 1.3,
    borderRadius: WHEEL_SIZE * 0.65,
    backgroundColor: 'rgba(168,85,247,0.22)',
    top: '20%',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 80,
    elevation: 30,
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,197,24,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.4)',
  },
  coinsText: {
    color: '#F5C518',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.4,
  },
  wheelContainer: {
    width: WHEEL_SIZE + 40,
    height: WHEEL_SIZE + 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  wheelGlow: {
    position: 'absolute',
    width: WHEEL_SIZE + 50,
    height: WHEEL_SIZE + 50,
    borderRadius: (WHEEL_SIZE + 50) / 2,
    backgroundColor: '#A855F7',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 50,
    elevation: 24,
  },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
  },
  pointerContainer: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 24,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#F5D485',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  spinButtonOuter: {
    borderRadius: 30,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 10,
  },
  spinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 10,
  },
  spinButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  lockedContainer: {
    alignItems: 'center',
    gap: 16,
  },
  lockedButtonOuter: {
    borderRadius: 30,
    overflow: 'hidden',
    opacity: 0.7,
  },
  lockedButtonText: {
    color: '#888',
    fontSize: 18,
    fontWeight: 'bold',
  },
  timerContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  timerLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 4,
  },
  timerText: {
    color: '#A855F7',
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  resultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  resultContainer: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.55)',
    width: SCREEN_WIDTH * 0.85,
  },
  resultEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  resultCoins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.5)',
  },
  resultCoinsText: {
    color: '#F5C518',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(245,197,24,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  resultSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginBottom: 24,
  },
  resultButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  resultButtonGradient: {
    paddingHorizontal: 50,
    paddingVertical: 14,
  },
  resultButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
