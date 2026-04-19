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

// Note: PremiumFeaturesComponent was removed for App Store compliance (no IAP implemented)

// Type definitions
interface Theme {
  colors: {
    primary: string;
    secondary?: string;
    text: string;
    textSecondary: string;
    border: string;
    warning: string;
    success: string;
    error: string;
    info: string;
  };
}

interface SmartNotificationsProps {
  theme: Theme;
  notifications?: any;
  logEvent: (event: string, data?: any) => void;
}

interface PerformanceMonitorProps {
  theme: Theme;
  logEvent: (event: string, data?: any) => void;
}

// Smart Notifications Component
export const SmartNotificationsComponent: React.FC<SmartNotificationsProps> = ({ theme, notifications, logEvent }) => {
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

  const handleSmartToggle = (setting: keyof typeof smartSettings) => {
    setSmartSettings(prev => {
      if (setting === 'quietHours') {
        return {
          ...prev,
          quietHours: {
            ...prev.quietHours,
            enabled: !prev.quietHours.enabled,
          },
        };
      }
      return {
        ...prev,
        [setting]: !prev[setting],
      };
    });
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
export const PerformanceMonitorComponent: React.FC<PerformanceMonitorProps> = ({ theme, logEvent }) => {
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
  // Premium styles removed for App Store compliance
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
