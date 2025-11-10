// app/(tabs)/settings.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  Modal,
  Alert,
  Vibration,
  Platform,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  Bell,
  Moon,
  Sun,
  Globe,
  Lock,
  User,
  ChevronRight,
  Shield,
  Smartphone,
  Palette,
  Volume2,
  Wifi,
  Battery,
  HardDrive,
  AlertCircle,
  Star,
  Heart,
  Trophy,
  Zap,
  Eye,
  EyeOff,
  Fingerprint,
  Key,
  Settings as SettingsIcon,
  LogOut,
  Info,
  HelpCircle,
  MessageSquare,
  Share2,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  Check,
  X,
  Camera,
  Mic,
  MapPin,
  Bell as BellOff,
  BellRing,
  Users,
  Crown,
  Sparkles,
  Gamepad2,
  Timer,
  BarChart3,
  TrendingUp,
  Award,
  Target,
  Flag,
  Coins,
  CreditCard,
  Gift,
  Ticket,
  ShieldCheck,
  ShieldAlert,
  Languages,
  Type,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Cpu,
  Gauge,
  Layers,
  Package,
  Server,
  Database,
  Cloud,
  CloudOff,
  WifiOff,
  BatteryLow,
  Loader,
} from 'lucide-react-native';

// ✅ استيراد الـ Hooks والـ Types
import { 
  useAppSettings, 
  useTheme, 
  useLanguage, 
  useNotifications, 
  useSecurity, 
  useUI, 
  usePreferences,
  useFeatures,
  useAnalytics 
} from '../../src/store/useAppSettings';

// ✅ استيراد المكونات الجديدة
import { 
  AdvancedSecuritySettings, 
  BackupRestoreSettings, 
  PerformanceSettings, 
  AdvancedSearchSettings,
  NotificationSettingsComponent, 
  ThemeSettingsComponent, 
  LanguageSettingsComponent,
  PremiumFeaturesComponent, 
  SmartNotificationsComponent, 
  PerformanceMonitorComponent 
} from '../../components/Settings';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Animated Components
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function AdvancedSettings() {
  // ✅ استخدام الـ Hooks الصحيحة
  const { 
    toggleTheme, 
    setTheme,
    setLanguage, 
    setDirection,
    autoDetectLanguage,
    toggleNotifications,
    toggleNotificationType,
    setPIN,
    setBiometric,
    setPermission,
    showSnackbar,
    hideSnackbar,
    setLoading,
    showModal,
    hideModal,
    setFontScale,
    setColors,
    setAutoLock,
    setDefaultTab,
    setLastScrollPosition,
    setThemeOverrides,
    toggleFeature,
    setFeature,
    setAnalyticsEnabled,
    logEvent,
    resetSettings,
    loadSettings,
    saveSettings,
    setPushToken,
    fetchRemoteConfig,
  } = useAppSettings();
  
  // ✅ استخدام الـ State من الـ Store
  const theme = useTheme();
  const language = useLanguage();
  const notifications = useNotifications();
  const security = useSecurity();
  const ui = useUI();
  const preferences = usePreferences();
  const features = useFeatures();
  const analytics = useAnalytics();

  // Local States
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Animations
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // ✅ Premium Features Animation
  useEffect(() => {
    if (features.betaFeatures) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [features.betaFeatures]);

  // ✅ Load settings on mount
  useEffect(() => {
    loadSettings();
    logEvent('settings_opened');
  }, []);

  // ✅ Save scroll position
useEffect(() => {
  return () => {
    const currentY = (scrollY as any)._value ?? 0;
    setLastScrollPosition('settings', currentY);
  };
}, []);
  // Header Scroll Animation
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [120, 70],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  // ✅ Handle Functions مع Analytics
  const handleHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (preferences.animations === false) return; // Check if animations enabled
    
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(
        type === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy :
        type === 'medium' ? Haptics.ImpactFeedbackStyle.Medium :
        Haptics.ImpactFeedbackStyle.Light
      );
    } else {
      Vibration.vibrate(type === 'heavy' ? 50 : type === 'medium' ? 30 : 10);
    }
  };

  const handleThemeToggle = () => {
    handleHaptic('medium');
    Animated.sequence([
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    toggleTheme();
    const newMode = theme.mode === 'light' ? 'dark' : 'light';
    showSnackbar(`تم التبديل إلى الوضع ${newMode === 'dark' ? 'الليلي' : 'النهاري'}`, 'success');
    logEvent('theme_changed', { from: theme.mode, to: newMode });
  };

  const handleBiometricToggle = async () => {
    handleHaptic('heavy');
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    if (!hasHardware || !isEnrolled) {
      Alert.alert(
        'غير متاح',
        'البصمة أو Face ID غير متاح على هذا الجهاز',
        [{ text: 'حسناً' }]
      );
      logEvent('biometric_not_available');
      return;
    }
    
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'تأكيد الهوية',
      fallbackLabel: 'استخدم رمز المرور',
    });
    
    if (result.success) {
      setBiometric(!security.biometricEnabled);
      showSnackbar('تم تحديث إعدادات الأمان', 'success');
      logEvent('biometric_toggled', { enabled: !security.biometricEnabled });
    }
  };

  const handleResetSettings = () => {
    Alert.alert(
      'إعادة تعيين الإعدادات',
      'هل أنت متأكد من إعادة جميع الإعدادات إلى الوضع الافتراضي؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { 
          text: 'إعادة تعيين', 
          style: 'destructive',
          onPress: () => {
            handleHaptic('heavy');
            resetSettings();
            showSnackbar('تم إعادة تعيين الإعدادات', 'info');
            logEvent('settings_reset');
          }
        }
      ]
    );
  };

  const handleSectionPress = (section: string) => {
    handleHaptic('light');
    Animated.timing(scaleAnim, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
    setExpandedSection(expandedSection === section ? null : section);
    logEvent('section_expanded', { section });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchRemoteConfig();
    await loadSettings();
    setTimeout(() => {
      setIsRefreshing(false);
      showSnackbar('تم تحديث الإعدادات', 'success');
    }, 1000);
  };

  // ✅ Language Modal
  const renderLanguageModal = () => (
    <Modal
      visible={showLanguageModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowLanguageModal(false)}
    >
      <BlurView intensity={20} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>اختر اللغة</Text>
          {language.available.map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.languageItem,
                language.current === lang && styles.languageItemActive
              ]}
              onPress={() => {
                setLanguage(lang);
                setShowLanguageModal(false);
                showSnackbar(`تم تغيير اللغة إلى ${lang === 'ar' ? 'العربية' : 'English'}`, 'success');
                logEvent('language_changed', { language: lang });
              }}
            >
              <Text style={[
                styles.languageText,
                language.current === lang && styles.languageTextActive
              ]}>
                {lang === 'ar' ? '🇸🇦 العربية' : '🇬🇧 English'}
              </Text>
              {language.current === lang && <Check size={20} color="#22c55e" />}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowLanguageModal(false)}
          >
            <Text style={styles.modalCloseText}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );

  // ✅ Theme Colors Modal
  const renderThemeModal = () => (
    <Modal
      visible={showThemeModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowThemeModal(false)}
    >
      <BlurView intensity={20} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>تخصيص الألوان</Text>
          <View style={styles.colorGrid}>
            {[
              { name: 'الأخضر', color: '#22c55e' },
              { name: 'الأزرق', color: '#3B82F6' },
              { name: 'البنفسجي', color: '#A855F7' },
              { name: 'الأحمر', color: '#EF4444' },
              { name: 'البرتقالي', color: '#F59E0B' },
              { name: 'الوردي', color: '#EC4899' },
            ].map((item) => (
              <TouchableOpacity
                key={item.color}
                style={[
                  styles.colorItem,
                  { backgroundColor: item.color },
                  theme.colors.primary === item.color && styles.colorItemActive
                ]}
                onPress={() => {
                  setColors({ primary: item.color });
                  showSnackbar(`تم تغيير اللون إلى ${item.name}`, 'success');
                  logEvent('theme_color_changed', { color: item.color });
                }}
              >
                {theme.colors.primary === item.color && (
                  <Check size={24} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowThemeModal(false)}
          >
            <Text style={styles.modalCloseText}>إغلاق</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );

  // ✅ Settings Sections Data (محدثة بناء على الـ State الفعلي)
  const generalSettings = [
    {
      icon: Globe,
      label: 'اللغة',
      subtitle: language.current === 'ar' ? 'العربية' : 'English',
      type: 'value',
      value: language.current === 'ar' ? 'العربية' : 'English',
      onPress: () => setShowLanguageModal(true),
    },
    {
      icon: Type,
      label: 'حجم الخط',
      subtitle: `${Math.round(theme.fontScale * 100)}%`,
      type: 'value',
      value: `${Math.round(theme.fontScale * 100)}%`,
      onPress: () => {
        Alert.alert(
          'حجم الخط',
          '',
          [
            { text: 'صغير (80%)', onPress: () => {
              setFontScale(0.8);
              logEvent('font_scale_changed', { scale: 0.8 });
            }},
            { text: 'عادي (100%)', onPress: () => {
              setFontScale(1);
              logEvent('font_scale_changed', { scale: 1 });
            }},
            { text: 'كبير (120%)', onPress: () => {
              setFontScale(1.2);
              logEvent('font_scale_changed', { scale: 1.2 });
            }},
            { text: 'كبير جداً (140%)', onPress: () => {
              setFontScale(1.4);
              logEvent('font_scale_changed', { scale: 1.4 });
            }},
          ]
        );
      }
    },
    {
      icon: Languages,
      label: 'الكشف التلقائي للغة',
      type: 'switch',
      value: language.autoDetect,
      onChange: () => {
        autoDetectLanguage();
        showSnackbar('تم تفعيل الكشف التلقائي للغة', 'success');
      },
    },
    {
      icon: Timer,
      label: 'تنسيق الوقت',
      subtitle: preferences.timeFormat === '24h' ? '24 ساعة' : '12 ساعة',
      type: 'value',
      value: preferences.timeFormat,
      onPress: () => {
        const newFormat = preferences.timeFormat === '24h' ? '12h' : '24h';
        // Update time format in preferences
        showSnackbar(`تم تغيير تنسيق الوقت إلى ${newFormat}`, 'success');
      }
    },
  ];

  const notificationSettings = [
    {
      icon: Bell,
      label: 'تفعيل الإشعارات',
      subtitle: notifications.enabled ? 'مفعل' : 'معطل',
      type: 'switch',
      value: notifications.enabled,
      onChange: (value: boolean) => {
        toggleNotifications(value);
        logEvent('notifications_toggled', { enabled: value });
      },
    },
    {
      icon: MessageSquare,
      label: 'إشعارات الرسائل',
      type: 'switch',
      value: notifications.types.messages,
      onChange: () => {
        toggleNotificationType('messages');
        logEvent('notification_type_toggled', { type: 'messages' });
      },
    },
    {
      icon: TrendingUp,
      label: 'إشعارات المباريات',
      type: 'switch',
      value: notifications.types.system,
      onChange: () => {
        toggleNotificationType('system');
        logEvent('notification_type_toggled', { type: 'system' });
      },
    },
    {
      icon: Gift,
      label: 'العروض والتخفيضات',
      type: 'switch',
      value: notifications.types.marketing,
      onChange: () => {
        toggleNotificationType('marketing');
        logEvent('notification_type_toggled', { type: 'marketing' });
      },
    },
    {
      icon: Volume2,
      label: 'الصوت',
      type: 'switch',
      value: notifications.sound,
      onChange: () => {
        // Toggle sound
        showSnackbar('تم تحديث إعدادات الصوت', 'success');
      },
    },
    {
      icon: Smartphone,
      label: 'الاهتزاز',
      type: 'switch',
      value: notifications.vibration,
      onChange: () => {
        // Toggle vibration
        handleHaptic('medium');
        showSnackbar('تم تحديث إعدادات الاهتزاز', 'success');
      },
    },
  ];

  const securitySettings = [
    {
      icon: Fingerprint,
      label: 'البصمة / Face ID',
      subtitle: security.biometricEnabled ? 'مفعل' : 'معطل',
      type: 'switch',
      value: security.biometricEnabled,
      onChange: handleBiometricToggle,
      iconColor: '#EF4444',
    },
    {
      icon: Key,
      label: 'رمز PIN',
      subtitle: security.pinEnabled ? 'مفعل' : 'معطل',
      type: 'switch',
      value: security.pinEnabled,
      onChange: (value: boolean) => {
        if (value) {
          setShowSecurityModal(true);
        } else {
          setPIN(false);
          showSnackbar('تم إلغاء رمز PIN', 'info');
        }
        logEvent('pin_toggled', { enabled: value });
      },
      iconColor: '#EF4444',
    },
    {
      icon: Timer,
      label: 'القفل التلقائي',
      subtitle: `بعد ${security.autoLockMinutes} دقائق`,
      type: 'value',
      value: `${security.autoLockMinutes} دقائق`,
      iconColor: '#EF4444',
      onPress: () => {
        Alert.alert(
          'القفل التلقائي',
          '',
          [
            { text: 'فوري', onPress: () => {
              setAutoLock(0);
              logEvent('auto_lock_changed', { minutes: 0 });
            }},
            { text: '1 دقيقة', onPress: () => {
              setAutoLock(1);
              logEvent('auto_lock_changed', { minutes: 1 });
            }},
            { text: '5 دقائق', onPress: () => {
              setAutoLock(5);
              logEvent('auto_lock_changed', { minutes: 5 });
            }},
            { text: '15 دقيقة', onPress: () => {
              setAutoLock(15);
              logEvent('auto_lock_changed', { minutes: 15 });
            }},
            { text: 'أبداً', onPress: () => {
              setAutoLock(999);
              logEvent('auto_lock_changed', { minutes: 999 });
            }},
          ]
        );
      }
    },
    {
      icon: ShieldAlert,
      label: 'حجب لقطات الشاشة',
      subtitle: security.secureScreenshot ? 'مفعل' : 'معطل',
      type: 'switch',
      value: security.secureScreenshot,
      onChange: () => {
        // Toggle secure screenshot
        showSnackbar('تم تحديث إعدادات الأمان', 'success');
        logEvent('secure_screenshot_toggled');
      },
      iconColor: '#EF4444',
    },
  ];

  const appearanceSettings = [
    {
      icon: theme.mode === 'dark' ? Sun : Moon,
      label: 'الوضع الليلي',
      subtitle: theme.mode === 'dark' ? 'مفعل' : 'معطل',
      type: 'switch',
      value: theme.mode === 'dark',
      onChange: handleThemeToggle,
      iconColor: '#A855F7',
    },
    {
      icon: Palette,
      label: 'اللون الرئيسي',
      type: 'value',
      value: theme.colors.primary,
      iconColor: '#A855F7',
      onPress: () => setShowThemeModal(true),
    },
    {
      icon: Sparkles,
      label: 'تأثيرات الحركة',
      subtitle: preferences.animations ? 'مفعل' : 'معطل',
      type: 'switch',
      value: preferences.animations,
      onChange: () => {
        // Toggle animations
        showSnackbar(`تم ${preferences.animations ? 'إيقاف' : 'تفعيل'} التأثيرات`, 'success');
        logEvent('animations_toggled', { enabled: !preferences.animations });
      },
      iconColor: '#A855F7',
    },
    {
      icon: Layers,
      label: 'الوضع المضغوط',
      subtitle: preferences.compactMode ? 'مفعل' : 'معطل',
      type: 'switch',
      value: preferences.compactMode,
      onChange: () => {
        // Toggle compact mode
        showSnackbar(`تم ${preferences.compactMode ? 'إيقاف' : 'تفعيل'} الوضع المضغوط`, 'success');
        logEvent('compact_mode_toggled', { enabled: !preferences.compactMode });
      },
      iconColor: '#A855F7',
    },
  ];

  const privacySettings = [
    {
      icon: Camera,
      label: 'الكاميرا',
      subtitle: security.permissions.camera ? 'مسموح' : 'محظور',
      type: 'switch',
      value: security.permissions.camera,
      onChange: (value: boolean) => {
        setPermission('camera', value);
        logEvent('permission_changed', { type: 'camera', value });
      },
      iconColor: '#3B82F6',
    },
    {
      icon: MapPin,
      label: 'الموقع',
      subtitle: security.permissions.location ? 'مسموح' : 'محظور',
      type: 'switch',
      value: security.permissions.location,
      onChange: (value: boolean) => {
        setPermission('location', value);
        logEvent('permission_changed', { type: 'location', value });
      },
      iconColor: '#3B82F6',
    },
    {
      icon: Mic,
      label: 'الميكروفون',
      subtitle: security.permissions.microphone ? 'مسموح' : 'محظور',
      type: 'switch',
      value: security.permissions.microphone,
      onChange: (value: boolean) => {
        setPermission('microphone', value);
        logEvent('permission_changed', { type: 'microphone', value });
      },
      iconColor: '#3B82F6',
    },
    {
      icon: Users,
      label: 'جهات الاتصال',
      subtitle: security.permissions.contacts ? 'مسموح' : 'محظور',
      type: 'switch',
      value: security.permissions.contacts,
      onChange: (value: boolean) => {
        setPermission('contacts', value);
        logEvent('permission_changed', { type: 'contacts', value });
      },
      iconColor: '#3B82F6',
    },
    {
      icon: HardDrive,
      label: 'التخزين',
      subtitle: security.permissions.storage ? 'مسموح' : 'محظور',
      type: 'switch',
      value: security.permissions.storage,
      onChange: (value: boolean) => {
        setPermission('storage', value);
        logEvent('permission_changed', { type: 'storage', value });
      },
      iconColor: '#3B82F6',
    },
  ];

  const advancedSettings = [
    {
      icon: BarChart3,
      label: 'تحليلات الاستخدام',
      subtitle: analytics.enabled ? 'مفعل' : 'معطل',
      type: 'switch',
      value: analytics.enabled,
      onChange: (value: boolean) => {
        setAnalyticsEnabled(value);
        showSnackbar(`تم ${value ? 'تفعيل' : 'إيقاف'} التحليلات`, 'info');
        logEvent('analytics_toggled', { enabled: value });
      },
      iconColor: '#F59E0B',
    },
    {
      icon: AlertCircle,
      label: 'تقارير الأخطاء',
      subtitle: analytics.crashReporting ? 'مفعل' : 'معطل',
      type: 'switch',
      value: analytics.crashReporting,
      onChange: () => {
        showSnackbar('تم تحديث إعدادات تقارير الأخطاء', 'success');
        logEvent('crash_reporting_toggled');
      },
      iconColor: '#F59E0B',
    },
    {
      icon: Gauge,
      label: 'مراقبة الأداء',
      subtitle: analytics.performanceMonitoring ? 'مفعل' : 'معطل',
      type: 'switch',
      value: analytics.performanceMonitoring,
      onChange: () => {
        showSnackbar('تم تحديث إعدادات مراقبة الأداء', 'success');
        logEvent('performance_monitoring_toggled');
      },
      iconColor: '#F59E0B',
    },
    {
      icon: Gamepad2,
      label: 'وضع التطوير',
      subtitle: features.debugMode ? 'مفعل' : 'معطل',
      type: 'switch',
      value: features.debugMode,
      onChange: () => {
        toggleFeature('debugMode');
        showSnackbar(`وضع التطوير ${features.debugMode ? 'معطل' : 'مفعل'}`, 'warning');
        logEvent('debug_mode_toggled');
      },
      iconColor: '#F59E0B',
    },
    {
      icon: Database,
      label: 'مسح البيانات المؤقتة',
      subtitle: 'تحرير المساحة',
      type: 'button',
      buttonText: 'مسح',
      buttonColor: '#F59E0B',
      iconColor: '#F59E0B',
      onPress: () => {
        Alert.alert('مسح البيانات المؤقتة', 'سيتم مسح جميع البيانات المؤقتة', [
          { text: 'إلغاء', style: 'cancel' },
          { 
            text: 'مسح', 
            style: 'destructive', 
            onPress: () => {
              setLoading(true);
              setTimeout(() => {
                setLoading(false);
                showSnackbar('تم مسح البيانات المؤقتة', 'success');
                logEvent('cache_cleared');
              }, 2000);
            }
          }
        ]);
      }
    },
  ];

  const experimentalSettings = [
    {
      icon: Zap,
      label: 'الميزات التجريبية',
      subtitle: features.experimentsEnabled ? 'مفعل' : 'معطل',
      type: 'switch',
      value: features.experimentsEnabled,
      onChange: () => {
        toggleFeature('experimentsEnabled');
        showSnackbar('تم تحديث الميزات التجريبية', 'info');
        logEvent('experiments_toggled');
      },
      iconColor: '#FFD700',
    },
    {
      icon: Crown,
      label: 'ميزات Beta',
      subtitle: features.betaFeatures ? 'مفعل' : 'معطل',
      type: 'switch',
      value: features.betaFeatures,
      onChange: () => {
        toggleFeature('betaFeatures');
        showSnackbar('تم تحديث ميزات Beta', 'info');
        logEvent('beta_features_toggled');
      },
      iconColor: '#FFD700',
    },
  ];

  // ✅ Render Functions
  const renderHeader = () => (
    <Animated.View style={[
      styles.header,
      {
        height: headerHeight,
        opacity: headerOpacity,
      }
    ]}>
      <LinearGradient
        colors={theme.mode === 'dark' ? ['#000', '#0a0a0a'] : ['#fff', '#f5f5f5']}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              الإعدادات
            </Text>
            <View style={styles.headerIcons}>
              {features.betaFeatures && (
                <TouchableOpacity 
                  onPress={() => setShowPremiumModal(true)}
                  style={styles.premiumButton}
                >
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Crown size={24} color="#FFD700" />
                  </Animated.View>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleRefresh}>
                <RefreshCw size={24} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Advanced Search */}
          <AdvancedSearchSettings 
            theme={theme}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={(query) => {
              logEvent('settings_searched', { query });
            }}
          />
        </View>
      </LinearGradient>
    </Animated.View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActions}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickActionsContent}
      >
        {[
          { 
            icon: theme.mode === 'dark' ? Sun : Moon, 
            label: 'الوضع', 
            onPress: handleThemeToggle, 
            color: theme.mode === 'dark' ? '#FFD700' : '#6366F1' 
          },
          { 
            icon: notifications.enabled ? BellRing : BellOff, 
            label: 'الإشعارات', 
            onPress: () => toggleNotifications(!notifications.enabled), 
            color: '#22c55e' 
          },
          { 
            icon: Globe, 
            label: language.current === 'ar' ? 'العربية' : 'English', 
            onPress: () => setShowLanguageModal(true), 
            color: '#3B82F6' 
          },
          { 
            icon: Shield, 
            label: 'الأمان', 
            onPress: () => handleSectionPress('security'), 
            color: '#EF4444' 
          },
          { 
            icon: Palette, 
            label: 'المظهر', 
            onPress: () => setShowThemeModal(true), 
            color: '#A855F7' 
          },
        ].map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.quickActionItem}
            onPress={() => {
              handleHaptic('light');
              action.onPress();
            }}
          >
            <Animated.View style={[
              styles.quickActionIcon,
              { backgroundColor: `${action.color}20` },
              theme.mode === 'dark' && index === 0 && {
                transform: [{ 
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg']
                  })
                }]
              }
            ]}>
              <action.icon size={24} color={action.color} />
            </Animated.View>
            <Text style={[styles.quickActionLabel, { color: theme.colors.textSecondary }]}>
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderSection = (title: string, icon: any, items: any[], sectionKey: string, isPremium = false) => {
    const isExpanded = expandedSection === sectionKey;
    
    return (
      <Animated.View style={[
        styles.section,
        { 
          transform: [{ scale: scaleAnim }],
          backgroundColor: theme.mode === 'dark' ? '#0a0a0a' : '#fff',
          borderColor: theme.mode === 'dark' ? '#1a1a1a' : '#e5e5e5',
        }
      ]}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => handleSectionPress(sectionKey)}
        >
          <View style={styles.sectionHeaderLeft}>
            <View style={[styles.sectionIcon, isPremium && styles.premiumIcon]}>
              {React.createElement(icon, { 
                size: 24, 
                color: isPremium ? '#FFD700' : theme.colors.primary 
              })}
            </View>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {title}
              </Text>
              {isPremium && features.betaFeatures && (
                <Text style={styles.premiumBadge}>Premium</Text>
              )}
            </View>
          </View>
          <Animated.View style={{
            transform: [{
              rotate: isExpanded ? '90deg' : '0deg'
            }]
          }}>
            <ChevronRight size={20} color={theme.colors.textSecondary} />
          </Animated.View>
        </TouchableOpacity>
        
        {isExpanded && (
          <Animated.View style={styles.sectionContent}>
            {items.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.settingItem,
                  index === items.length - 1 && styles.lastItem,
                  { borderBottomColor: theme.mode === 'dark' ? '#1a1a1a' : '#e5e5e5' }
                ]}
                onPress={() => {
                  handleHaptic('light');
                  item.onPress && item.onPress();
                }}
              >
                <View style={styles.settingLeft}>
                  <View style={[
                    styles.settingIconWrapper, 
                    { backgroundColor: `${item.iconColor || theme.colors.primary}20` }
                  ]}>
                    {React.createElement(item.icon, { 
                      size: 20, 
                      color: item.iconColor || theme.colors.primary 
                    })}
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingText, { color: theme.colors.text }]}>
                      {item.label}
                    </Text>
                    {item.subtitle && (
                      <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                        {item.subtitle}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.settingRight}>
                  {item.type === 'switch' ? (
                    <Switch
                      value={item.value}
                      onValueChange={(value) => {
                        handleHaptic('light');
                        item.onChange(value);
                      }}
                      trackColor={{ 
                        false: theme.mode === 'dark' ? '#333' : '#e5e5e5', 
                        true: theme.colors.primary 
                      }}
                      thumbColor={item.value ? '#fff' : '#666'}
                    />
                  ) : item.type === 'value' ? (
                    <View style={styles.valueContainer}>
                      <Text style={[styles.valueText, { color: theme.colors.textSecondary }]}>
                        {item.value}
                      </Text>
                      <ChevronRight size={16} color={theme.colors.textSecondary} />
                    </View>
                  ) : item.type === 'button' ? (
                    <View style={[
                      styles.actionButton, 
                      { backgroundColor: `${item.buttonColor || theme.colors.primary}20` }
                    ]}>
                      <Text style={[
                        styles.actionButtonText, 
                        { color: item.buttonColor || theme.colors.primary }
                      ]}>
                        {item.buttonText}
                      </Text>
                    </View>
                  ) : (
                    <ChevronRight size={20} color={theme.colors.textSecondary} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.mode === 'dark' ? '#000' : '#f5f5f5' }]}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />
      
      {renderHeader()}
      
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Quick Actions */}
        {renderQuickActions()}

        {/* Enhanced Settings Sections */}
        <NotificationSettingsComponent 
          theme={theme}
          notifications={notifications}
          toggleNotifications={toggleNotifications}
          toggleNotificationType={toggleNotificationType}
          logEvent={logEvent}
        />
        
        <ThemeSettingsComponent 
          theme={theme}
          setTheme={setTheme}
          setColors={setColors}
          setFontScale={setFontScale}
          logEvent={logEvent}
        />
        
        <LanguageSettingsComponent 
          theme={theme}
          language={language}
          setLanguage={setLanguage}
          autoDetectLanguage={autoDetectLanguage}
          logEvent={logEvent}
        />
        
        <AdvancedSecuritySettings 
          theme={theme}
          security={security}
          setPIN={setPIN}
          setBiometric={setBiometric}
          setPermission={setPermission}
          setAutoLock={setAutoLock}
          logEvent={logEvent}
        />
        
        <BackupRestoreSettings 
          theme={theme}
          logEvent={logEvent}
        />
        
        <PerformanceSettings 
          theme={theme}
          logEvent={logEvent}
        />
        
        <PremiumFeaturesComponent 
          theme={theme}
          features={features}
          toggleFeature={toggleFeature}
          logEvent={logEvent}
        />
        
        <SmartNotificationsComponent 
          theme={theme}
          notifications={notifications}
          logEvent={logEvent}
        />
        
        <PerformanceMonitorComponent 
          theme={theme}
          logEvent={logEvent}
        />
        
        {/* Original Settings Sections */}
        {renderSection('الإعدادات العامة', SettingsIcon, generalSettings, 'general')}
        {renderSection('الأذونات', Lock, privacySettings, 'privacy')}
        {renderSection('متقدم', Sliders, advancedSettings, 'advanced')}
        
        {/* Experimental Features */}
        {features.debugMode && (
          renderSection('تجريبي', Zap, experimentalSettings, 'experimental', true)
        )}

        {/* Version Info */}
        <View style={styles.versionInfo}>
          <Text style={[styles.versionText, { color: theme.colors.textSecondary }]}>
            Football Pro v2.0.1
          </Text>
          <Text style={[styles.copyrightText, { color: theme.colors.textSecondary }]}>
            © 2024 جميع الحقوق محفوظة
          </Text>
        </View>
      </Animated.ScrollView>

      {/* Modals */}
      {renderLanguageModal()}
      {renderThemeModal()}
      
      {/* Snackbar */}
      {ui.snackbar.visible && (
        <Animated.View style={[
          styles.snackbar,
          { 
            backgroundColor: 
              ui.snackbar.type === 'success' ? '#22c55e' :
              ui.snackbar.type === 'error' ? '#EF4444' :
              ui.snackbar.type === 'warning' ? '#F59E0B' :
              '#3B82F6'
          }
        ]}>
          <Text style={styles.snackbarText}>{ui.snackbar.message}</Text>
        </Animated.View>
      )}
      
      {/* Loading Overlay */}
      {ui.loading && (
        <View style={styles.loadingOverlay}>
          <BlurView intensity={20} style={styles.loadingBlur}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.text }]}>
              {ui.loadingMessage || 'جاري التحميل...'}
            </Text>
          </BlurView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ✅ Header
  header: {
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 10,
  },
  headerGradient: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerContent: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  premiumButton: {
    marginRight: 10,
  },

  // ✅ Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginTop: 16,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },

  // ✅ Scroll & Sections
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 160,
    paddingBottom: 80,
    paddingHorizontal: 16,
  },

  section: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
    borderRadius: 14,
    marginVertical: 10,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
  width: 38,
  height: 38,
  borderRadius: 12,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 10,
  backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  premiumIcon: {
  backgroundColor: 'rgba(255, 215, 0, 0.15)',
  borderWidth: 1,
  borderColor: '#FFD700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  premiumBadge: {
    fontSize: 12,
    color: '#FFD700',
    marginTop: 2,
  },
  sectionContent: {
    paddingHorizontal: 16,
    backgroundColor: '#0f0f0f',
  },

  // ✅ Setting Items
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flexDirection: 'column',
  },
  settingRight: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-end',
  },
  settingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 14,
    color: '#666',
    marginRight: 6,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ✅ Quick Actions
  quickActions: {
    marginTop: 20,
    marginBottom: 20,
  },
  quickActionsContent: {
    paddingHorizontal: 12,
  },
  quickActionItem: {
    alignItems: 'center',
    marginHorizontal: 10,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#aaa',
  },

  // ✅ Modals
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#22c55e30',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  modalCloseButton: {
    marginTop: 16,
    alignSelf: 'center',
  },
  modalCloseText: {
    fontSize: 15,
    color: '#22c55e',
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  languageItemActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 10,
  },
  languageText: {
    color: '#ccc',
    fontSize: 16,
  },
  languageTextActive: {
    color: '#22c55e',
    fontWeight: '600',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  colorItem: {
    width: 50,
    height: 50,
    borderRadius: 25,
    margin: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorItemActive: {
    borderWidth: 3,
    borderColor: '#fff',
  },

  // ✅ Snackbar
  snackbar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  snackbarText: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },

  // ✅ Loading Overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBlur: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#fff',
  },

  // ✅ Footer
  versionInfo: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 60,
  },
  versionText: {
    color: '#666',
    fontSize: 13,
  },
  copyrightText: {
    color: '#444',
    fontSize: 11,
    marginTop: 4,
  },
});
