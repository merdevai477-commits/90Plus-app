import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  Alert,
  Platform,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
  Slider,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  Star,
  Heart,
  Trophy,
  Crown,
  Sparkles,
  Zap,
  Gamepad2,
  Target,
  Award,
  TrendingUp,
  BarChart3,
  Gauge,
  Cpu,
  Battery,
  HardDrive,
  Wifi,
  Globe,
  MapPin,
  Camera,
  Mic,
  Users,
  Package,
  Server,
  Database,
  Cloud,
  CloudOff,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  Plus,
  Minus,
  Edit,
  Save,
  RotateCcw,
  Power,
  Moon,
  Sun,
  Palette,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Key,
  Fingerprint,
  Bell,
  BellOff,
  BellRing,
  Volume2,
  VolumeX,
  Smartphone,
  Settings,
  LogOut,
  HelpCircle,
  MessageSquare,
  Share2,
  Copy,
  ExternalLink,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  Languages,
  Type,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Layers,
  Timer,
  Loader,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Premium Features Component
export const PremiumFeaturesComponent = ({ theme, features, toggleFeature, logEvent }) => {
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

  const premiumFeatures = [
    {
      icon: Crown,
      title: 'ميزات Premium',
      description: 'وصول حصري للميزات المتقدمة',
      color: '#FFD700',
      available: true,
    },
    {
      icon: Sparkles,
      title: 'تأثيرات بصرية متقدمة',
      description: 'رسوم متحركة وتأثيرات احترافية',
      color: '#A855F7',
      available: features.betaFeatures,
    },
    {
      icon: Zap,
      title: 'أداء محسن',
      description: 'سرعة فائقة وتجربة سلسة',
      color: '#22c55e',
      available: features.betaFeatures,
    },
    {
      icon: Shield,
      title: 'أمان متقدم',
      description: 'حماية إضافية لبياناتك',
      color: '#EF4444',
      available: true,
    },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={[styles.sectionIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Crown size={24} color={theme.colors.primary} />
            </View>
          </Animated.View>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            الميزات المميزة
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.premiumButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => setShowPremiumModal(true)}
        >
          <Text style={styles.premiumButtonText}>ترقية</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionContent}>
        {premiumFeatures.map((feature, index) => (
          <View 
            key={index}
            style={[
              styles.premiumFeatureItem,
              { borderBottomColor: theme.colors.border },
              index === premiumFeatures.length - 1 && styles.lastItem
            ]}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: `${feature.color}20` }]}>
                <feature.icon size={20} color={feature.color} />
              </View>
              <View>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                  {feature.description}
                </Text>
              </View>
            </View>
            <View style={styles.premiumFeatureRight}>
              {feature.available ? (
                <View style={[styles.availableBadge, { backgroundColor: theme.colors.success }]}>
                  <Check size={16} color="#fff" />
                </View>
              ) : (
                <View style={[styles.lockedBadge, { backgroundColor: theme.colors.border }]}>
                  <Lock size={16} color={theme.colors.textSecondary} />
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* Premium Modal */}
      <Modal
        visible={showPremiumModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPremiumModal(false)}
      >
        <BlurView intensity={20} style={styles.modalOverlay}>
          <View style={[styles.premiumModal, { backgroundColor: theme.colors.surface }]}>
            <LinearGradient
              colors={['#FFD700', '#FFA500']}
              style={styles.premiumHeader}
            >
              <Crown size={40} color="#fff" />
              <Text style={styles.premiumModalTitle}>ترقية إلى Premium</Text>
              <Text style={styles.premiumModalSubtitle}>
                احصل على جميع الميزات المتقدمة
              </Text>
            </LinearGradient>

            <ScrollView style={styles.premiumContent}>
              <Text style={[styles.premiumSectionTitle, { color: theme.colors.text }]}>
                الميزات المضمنة:
              </Text>
              
              {[
                'إزالة الإعلانات',
                'ميزات Beta الحصرية',
                'تأثيرات بصرية متقدمة',
                'أمان إضافي',
                'دعم أولوية',
                'نسخ احتياطية سحابية',
              ].map((benefit, index) => (
                <View key={index} style={styles.premiumBenefit}>
                  <Check size={20} color={theme.colors.success} />
                  <Text style={[styles.premiumBenefitText, { color: theme.colors.text }]}>
                    {benefit}
                  </Text>
                </View>
              ))}

              <View style={styles.premiumPricing}>
                <Text style={[styles.premiumPrice, { color: theme.colors.text }]}>
                  $4.99/شهر
                </Text>
                <Text style={[styles.premiumPriceNote, { color: theme.colors.textSecondary }]}>
                  أو $39.99/سنة (وفر 33%)
                </Text>
              </View>
            </ScrollView>

            <View style={styles.premiumModalButtons}>
              <TouchableOpacity
                style={[styles.premiumModalButton, { backgroundColor: theme.colors.border }]}
                onPress={() => setShowPremiumModal(false)}
              >
                <Text style={[styles.premiumModalButtonText, { color: theme.colors.text }]}>
                  لاحقاً
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.premiumModalButton, { backgroundColor: '#FFD700' }]}
                onPress={() => {
                  logEvent('premium_upgrade_clicked');
                  setShowPremiumModal(false);
                }}
              >
                <Text style={styles.premiumModalButtonTextGold}>
                  ترقية الآن
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
};

// Smart Notifications Component
export const SmartNotificationsComponent = ({ theme, notifications, logEvent }) => {
  const [showSmartSettings, setShowSmartSettings] = useState(false);
  const [smartSettings, setSmartSettings] = useState({
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
    priorityMode: false,
    adaptiveNotifications: true,
    learningMode: true,
  });

  const handleSmartToggle = (setting: string) => {
    setSmartSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
    logEvent('smart_notification_toggled', { setting });
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
            <Bell size={24} color={theme.colors.primary} />
          </View>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            الإشعارات الذكية
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.smartToggle, { backgroundColor: smartSettings.adaptiveNotifications ? theme.colors.primary : theme.colors.border }]}
          onPress={() => handleSmartToggle('adaptiveNotifications')}
        >
          <Text style={[styles.smartToggleText, { color: smartSettings.adaptiveNotifications ? '#fff' : theme.colors.text }]}>
            {smartSettings.adaptiveNotifications ? 'مفعل' : 'معطل'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionContent}>
        {/* Priority Mode */}
        <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.warning}20` }]}>
              <Target size={20} color={theme.colors.warning} />
            </View>
            <View>
              <Text style={[styles.settingText, { color: theme.colors.text }]}>
                وضع الأولوية
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                إشعارات مهمة فقط
              </Text>
            </View>
          </View>
          <Switch
            value={smartSettings.priorityMode}
            onValueChange={() => handleSmartToggle('priorityMode')}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={smartSettings.priorityMode ? '#fff' : '#666'}
          />
        </View>

        {/* Learning Mode */}
        <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.success}20` }]}>
              <Award size={20} color={theme.colors.success} />
            </View>
            <View>
              <Text style={[styles.settingText, { color: theme.colors.text }]}>
                وضع التعلم
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                يتعلم من سلوكك
              </Text>
            </View>
          </View>
          <Switch
            value={smartSettings.learningMode}
            onValueChange={() => handleSmartToggle('learningMode')}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={smartSettings.learningMode ? '#fff' : '#666'}
          />
        </View>

        {/* Smart Settings Button */}
        <TouchableOpacity
          style={styles.smartSettingsButton}
          onPress={() => setShowSmartSettings(!showSmartSettings)}
        >
          <Text style={[styles.smartSettingsButtonText, { color: theme.colors.primary }]}>
            إعدادات ذكية متقدمة
          </Text>
          <ChevronRight 
            size={16} 
            color={theme.colors.primary}
            style={{ transform: [{ rotate: showSmartSettings ? '90deg' : '0deg' }] }}
          />
        </TouchableOpacity>

        {showSmartSettings && (
          <View style={styles.smartSettingsContent}>
            {/* Quiet Hours */}
            <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.info}20` }]}>
                  <Moon size={20} color={theme.colors.info} />
                </View>
                <View>
                  <Text style={[styles.settingText, { color: theme.colors.text }]}>
                    ساعات الهدوء
                  </Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                    {smartSettings.quietHours.start} - {smartSettings.quietHours.end}
                  </Text>
                </View>
              </View>
              <Switch
                value={smartSettings.quietHours.enabled}
                onValueChange={() => handleSmartToggle('quietHours')}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={smartSettings.quietHours.enabled ? '#fff' : '#666'}
              />
            </View>

            {/* Notification Analytics */}
            <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
                  <BarChart3 size={20} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={[styles.settingText, { color: theme.colors.text }]}>
                    تحليل الإشعارات
                  </Text>
                  <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                    إحصائيات مفصلة
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: `${theme.colors.primary}20` }]}
                onPress={() => logEvent('notification_analytics_viewed')}
              >
                <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>
                  عرض
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

// Performance Monitor Component
export const PerformanceMonitorComponent = ({ theme, logEvent }) => {
  const [performanceData, setPerformanceData] = useState({
    cpu: 15,
    memory: 45,
    battery: 8,
    network: 2,
  });

  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    if (isMonitoring) {
      const interval = setInterval(() => {
        setPerformanceData(prev => ({
          cpu: Math.max(5, Math.min(95, prev.cpu + (Math.random() - 0.5) * 10)),
          memory: Math.max(10, Math.min(90, prev.memory + (Math.random() - 0.5) * 5)),
          battery: Math.max(1, Math.min(20, prev.battery + (Math.random() - 0.5) * 2)),
          network: Math.max(0, Math.min(10, prev.network + (Math.random() - 0.5) * 1)),
        }));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isMonitoring]);

  const getPerformanceColor = (value: number, type: string) => {
    if (type === 'battery') {
      return value < 5 ? theme.colors.error : value < 10 ? theme.colors.warning : theme.colors.success;
    }
    return value < 30 ? theme.colors.success : value < 70 ? theme.colors.warning : theme.colors.error;
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
            <Gauge size={24} color={theme.colors.primary} />
          </View>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            مراقب الأداء
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.monitorToggle, { backgroundColor: isMonitoring ? theme.colors.error : theme.colors.success }]}
          onPress={() => {
            setIsMonitoring(!isMonitoring);
            logEvent('performance_monitoring_toggled', { enabled: !isMonitoring });
          }}
        >
          <Text style={styles.monitorToggleText}>
            {isMonitoring ? 'إيقاف' : 'بدء'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionContent}>
        {/* CPU Usage */}
        <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.info}20` }]}>
              <Cpu size={20} color={theme.colors.info} />
            </View>
            <View>
              <Text style={[styles.settingText, { color: theme.colors.text }]}>
                استخدام المعالج
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                {performanceData.cpu.toFixed(1)}%
              </Text>
            </View>
          </View>
          <View style={styles.performanceBar}>
            <View style={[
              styles.performanceFill, 
              { 
                width: `${performanceData.cpu}%`, 
                backgroundColor: getPerformanceColor(performanceData.cpu, 'cpu')
              }
            ]} />
          </View>
        </View>

        {/* Memory Usage */}
        <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.warning}20` }]}>
              <HardDrive size={20} color={theme.colors.warning} />
            </View>
            <View>
              <Text style={[styles.settingText, { color: theme.colors.text }]}>
                استخدام الذاكرة
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                {performanceData.memory.toFixed(1)}%
              </Text>
            </View>
          </View>
          <View style={styles.performanceBar}>
            <View style={[
              styles.performanceFill, 
              { 
                width: `${performanceData.memory}%`, 
                backgroundColor: getPerformanceColor(performanceData.memory, 'memory')
              }
            ]} />
          </View>
        </View>

        {/* Battery Usage */}
        <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.success}20` }]}>
              <Battery size={20} color={theme.colors.success} />
            </View>
            <View>
              <Text style={[styles.settingText, { color: theme.colors.text }]}>
                استهلاك البطارية
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                {performanceData.battery.toFixed(1)}%/ساعة
              </Text>
            </View>
          </View>
          <View style={styles.performanceBar}>
            <View style={[
              styles.performanceFill, 
              { 
                width: `${performanceData.battery * 5}%`, 
                backgroundColor: getPerformanceColor(performanceData.battery, 'battery')
              }
            ]} />
          </View>
        </View>

        {/* Network Usage */}
        <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Wifi size={20} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={[styles.settingText, { color: theme.colors.text }]}>
                استخدام الشبكة
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                {performanceData.network.toFixed(1)} MB/s
              </Text>
            </View>
          </View>
          <View style={styles.performanceBar}>
            <View style={[
              styles.performanceFill, 
              { 
                width: `${performanceData.network * 10}%`, 
                backgroundColor: getPerformanceColor(performanceData.network * 10, 'network')
              }
            ]} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginVertical: 10,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionContent: {
    marginTop: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  premiumButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  premiumButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  premiumFeatureItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  premiumFeatureRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availableBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  premiumModal: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  premiumHeader: {
    padding: 24,
    alignItems: 'center',
  },
  premiumModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  premiumModalSubtitle: {
    fontSize: 16,
    color: '#fff',
    marginTop: 4,
    textAlign: 'center',
  },
  premiumContent: {
    padding: 20,
  },
  premiumSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  premiumBenefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  premiumBenefitText: {
    fontSize: 16,
    marginLeft: 12,
  },
  premiumPricing: {
    alignItems: 'center',
    marginTop: 20,
  },
  premiumPrice: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  premiumPriceNote: {
    fontSize: 14,
    marginTop: 4,
  },
  premiumModalButtons: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  premiumModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  premiumModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  premiumModalButtonTextGold: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  smartToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  smartToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  smartSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  smartSettingsButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  smartSettingsContent: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  monitorToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  monitorToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  performanceBar: {
    width: 60,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  performanceFill: {
    height: '100%',
    borderRadius: 2,
  },
});
