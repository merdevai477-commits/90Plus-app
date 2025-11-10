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
} from 'react-native';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  BellOff,
  BellRing,
  Volume2,
  VolumeX,
  Smartphone,
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  HardDrive,
  Globe,
  MapPin,
  Camera,
  Mic,
  Users,
  Package,
  Server,
  Cpu,
  Gauge,
  BarChart3,
  TrendingUp,
  Award,
  Target,
  Flag,
  Coins,
  CreditCard,
  Gift,
  Ticket,
  Languages,
  Type,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Layers,
  Timer,
  Zap,
  Crown,
  Sparkles,
  Gamepad2,
  Loader,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  Star,
  Heart,
  Trophy,
  Eye,
  EyeOff,
  Settings,
  LogOut,
  HelpCircle,
  MessageSquare,
  Share2,
  Copy,
  ExternalLink,
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
  Database,
  Cloud,
  CloudOff,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Trash2 as TrashIcon,
  RefreshCw as RefreshIcon,
  AlertCircle as AlertCircleIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  XCircle as XCircleIcon,
  Plus as PlusIcon,
  Minus as MinusIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  RotateCcw as RotateCcwIcon,
  Power as PowerIcon,
  Moon as MoonIcon,
  Sun as SunIcon,
  Palette as PaletteIcon,
  Shield as ShieldIcon,
  ShieldCheck as ShieldCheckIcon,
  ShieldAlert as ShieldAlertIcon,
  Lock as LockIcon,
  Key as KeyIcon,
  Fingerprint as FingerprintIcon,
  Database as DatabaseIcon,
  Cloud as CloudIcon,
  CloudOff as CloudOffIcon,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Notification Settings Component
export const NotificationSettingsComponent = ({ 
  theme, 
  notifications,
  toggleNotifications, 
  toggleNotificationType, 
  logEvent 
}: {
  theme: any;
  notifications: any;
  toggleNotifications: () => void;
  toggleNotificationType: (type: string) => void;
  logEvent: (event: string, data?: any) => void;
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [quietHours, setQuietHours] = useState({
    enabled: false,
    start: '22:00',
    end: '08:00',
  });

  const notificationTypes = [
    { key: 'marketing', label: 'العروض والتخفيضات', icon: Gift, color: '#F59E0B' },
    { key: 'system', label: 'إشعارات النظام', icon: Settings, color: '#3B82F6' },
    { key: 'messages', label: 'الرسائل', icon: MessageSquare, color: '#22c55e' },
    { key: 'updates', label: 'التحديثات', icon: RefreshCw, color: '#A855F7' },
    { key: 'reminders', label: 'التذكيرات', icon: Bell, color: '#EF4444' },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
            <Bell size={24} color={theme.colors.primary} />
          </View>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            الإشعارات
          </Text>
        </View>
        <Switch
          value={notifications.enabled}
          onValueChange={toggleNotifications}
          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          thumbColor={notifications.enabled ? '#fff' : '#666'}
        />
      </View>

      {notifications.enabled && (
        <View style={styles.sectionContent}>
          {/* Sound & Vibration */}
          <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.success}20` }]}>
                <Volume2 size={20} color={theme.colors.success} />
              </View>
              <View>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>
                  الصوت
                </Text>
                <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                  {notifications.sound ? 'مفعل' : 'معطل'}
                </Text>
              </View>
            </View>
            <Switch
              value={notifications.sound}
              onValueChange={() => {
                // Toggle sound
                logEvent('notification_sound_toggled');
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={notifications.sound ? '#fff' : '#666'}
            />
          </View>

          <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.success}20` }]}>
                <Smartphone size={20} color={theme.colors.success} />
              </View>
              <View>
                <Text style={[styles.settingText, { color: theme.colors.text }]}>
                  الاهتزاز
                </Text>
                <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                  {notifications.vibration ? 'مفعل' : 'معطل'}
                </Text>
              </View>
            </View>
            <Switch
              value={notifications.vibration}
              onValueChange={() => {
                // Toggle vibration
                logEvent('notification_vibration_toggled');
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={notifications.vibration ? '#fff' : '#666'}
            />
          </View>

          {/* Notification Types */}
          <Text style={[styles.subsectionTitle, { color: theme.colors.text }]}>
            أنواع الإشعارات
          </Text>
          
          {notificationTypes.map((type, index) => (
            <View 
              key={type.key} 
              style={[
                styles.settingItem, 
                { borderBottomColor: theme.colors.border },
                index === notificationTypes.length - 1 && styles.lastItem
              ]}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: `${type.color}20` }]}>
                  <type.icon size={20} color={type.color} />
                </View>
                <View>
                  <Text style={[styles.settingText, { color: theme.colors.text }]}>
                    {type.label}
                  </Text>
                </View>
              </View>
              <Switch
                value={notifications.types[type.key]}
                onValueChange={() => {
                  toggleNotificationType(type.key);
                  logEvent('notification_type_toggled', { type: type.key });
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={notifications.types[type.key] ? '#fff' : '#666'}
              />
            </View>
          ))}

          {/* Advanced Settings */}
          <TouchableOpacity
            style={styles.advancedToggle}
            onPress={() => setShowAdvanced(!showAdvanced)}
          >
            <Text style={[styles.advancedToggleText, { color: theme.colors.primary }]}>
              إعدادات متقدمة
            </Text>
            <ChevronRight 
              size={16} 
              color={theme.colors.primary}
              style={{ transform: [{ rotate: showAdvanced ? '90deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {showAdvanced && (
            <View style={styles.advancedSettings}>
              {/* Quiet Hours */}
              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.warning}20` }]}>
                    <Moon size={20} color={theme.colors.warning} />
                  </View>
                  <View>
                    <Text style={[styles.settingText, { color: theme.colors.text }]}>
                      ساعات الهدوء
                    </Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                      {quietHours.enabled ? `${quietHours.start} - ${quietHours.end}` : 'معطل'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={quietHours.enabled}
                  onValueChange={(value) => setQuietHours({ ...quietHours, enabled: value })}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={quietHours.enabled ? '#fff' : '#666'}
                />
              </View>

              {/* Badge Count */}
              <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
                <View style={styles.settingLeft}>
                  <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.info}20` }]}>
                    <Award size={20} color={theme.colors.info} />
                  </View>
                  <View>
                    <Text style={[styles.settingText, { color: theme.colors.text }]}>
                      عداد الإشعارات
                    </Text>
                    <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                      {notifications.badge ? 'مفعل' : 'معطل'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={notifications.badge}
                  onValueChange={() => {
                    // Toggle badge
                    logEvent('notification_badge_toggled');
                  }}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={notifications.badge ? '#fff' : '#666'}
                />
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// Theme Settings Component
export const ThemeSettingsComponent = ({ 
  theme, 
  setTheme, 
  setColors, 
  setFontScale, 
  logEvent 
}: {
  theme: any;
  setTheme: (mode: string) => void;
  setColors: (colors: any) => void;
  setFontScale: (scale: number) => void;
  logEvent: (event: string, data?: any) => void;
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontScale, setShowFontScale] = useState(false);

  const colorOptions = [
    { name: 'الأخضر', color: '#22c55e', description: 'اللون الافتراضي' },
    { name: 'الأزرق', color: '#3B82F6', description: 'هادئ ومريح' },
    { name: 'البنفسجي', color: '#A855F7', description: 'أنيق ومميز' },
    { name: 'الأحمر', color: '#EF4444', description: 'قوي وملفت' },
    { name: 'البرتقالي', color: '#F59E0B', description: 'دافئ ومشرق' },
    { name: 'الوردي', color: '#EC4899', description: 'ناعم وجميل' },
  ];

  const fontScaleOptions = [
    { label: 'صغير جداً', value: 0.8 },
    { label: 'صغير', value: 0.9 },
    { label: 'عادي', value: 1.0 },
    { label: 'كبير', value: 1.1 },
    { label: 'كبير جداً', value: 1.2 },
    { label: 'ضخم', value: 1.3 },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
            <Palette size={24} color={theme.colors.primary} />
          </View>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            المظهر والثيم
          </Text>
        </View>
      </View>

      <View style={styles.sectionContent}>
        {/* Dark Mode Toggle */}
        <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
              {theme.mode === 'dark' ? <Sun size={20} color={theme.colors.primary} /> : <Moon size={20} color={theme.colors.primary} />}
            </View>
            <View>
              <Text style={[styles.settingText, { color: theme.colors.text }]}>
                الوضع الليلي
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                {theme.mode === 'dark' ? 'مفعل' : 'معطل'}
              </Text>
            </View>
          </View>
          <Switch
            value={theme.mode === 'dark'}
            onValueChange={() => {
              setTheme(theme.mode === 'dark' ? 'light' : 'dark');
              logEvent('theme_mode_changed', { mode: theme.mode === 'dark' ? 'light' : 'dark' });
            }}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={theme.mode === 'dark' ? '#fff' : '#666'}
          />
        </View>

        {/* Primary Color */}
        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => setShowColorPicker(true)}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Palette size={20} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={[styles.settingText, { color: theme.colors.text }]}>
                اللون الرئيسي
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                {theme.colors.primary}
              </Text>
            </View>
          </View>
          <View style={styles.colorPreview}>
            <View style={[styles.colorDot, { backgroundColor: theme.colors.primary }]} />
            <ChevronRight size={16} color={theme.colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Font Scale */}
        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => setShowFontScale(true)}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Type size={20} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={[styles.settingText, { color: theme.colors.text }]}>
                حجم الخط
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                {Math.round(theme.fontScale * 100)}%
              </Text>
            </View>
          </View>
          <ChevronRight size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        {/* Color Picker Modal */}
        <Modal
          visible={showColorPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowColorPicker(false)}
        >
          <BlurView intensity={20} style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                اختر اللون الرئيسي
              </Text>
              
              <View style={styles.colorGrid}>
                {colorOptions.map((option) => (
                  <TouchableOpacity
                    key={option.color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: option.color },
                      theme.colors.primary === option.color && styles.colorOptionActive
                    ]}
                    onPress={() => {
                      setColors({ primary: option.color });
                      setShowColorPicker(false);
                      logEvent('theme_color_changed', { color: option.color });
                    }}
                  >
                    {theme.colors.primary === option.color && (
                      <Check size={24} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.colorInfo}>
                {colorOptions.map((option) => (
                  <View key={option.color} style={styles.colorInfoItem}>
                    <View style={[styles.colorInfoDot, { backgroundColor: option.color }]} />
                    <View>
                      <Text style={[styles.colorInfoName, { color: theme.colors.text }]}>
                        {option.name}
                      </Text>
                      <Text style={[styles.colorInfoDesc, { color: theme.colors.textSecondary }]}>
                        {option.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowColorPicker(false)}
              >
                <Text style={styles.modalButtonText}>إغلاق</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Modal>

        {/* Font Scale Modal */}
        <Modal
          visible={showFontScale}
          transparent
          animationType="slide"
          onRequestClose={() => setShowFontScale(false)}
        >
          <BlurView intensity={20} style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                حجم الخط
              </Text>
              
              <View style={styles.fontScaleContainer}>
                <Text style={[styles.fontScalePreview, { 
                  color: theme.colors.text,
                  fontSize: 16 * theme.fontScale 
                }]}>
                  هذا مثال على حجم الخط الحالي
                </Text>
                
                <Slider
                  style={styles.fontScaleSlider}
                  minimumValue={0.8}
                  maximumValue={1.3}
                  value={theme.fontScale}
                  onValueChange={(value) => setFontScale(value)}
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor={theme.colors.border}
                  thumbTintColor={theme.colors.primary}
                />
                
                <View style={styles.fontScaleLabels}>
                  <Text style={[styles.fontScaleLabel, { color: theme.colors.textSecondary }]}>
                    صغير
                  </Text>
                  <Text style={[styles.fontScaleLabel, { color: theme.colors.textSecondary }]}>
                    كبير
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowFontScale(false)}
              >
                <Text style={styles.modalButtonText}>حفظ</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Modal>
      </View>
    </View>
  );
};

// Language Settings Component
export const LanguageSettingsComponent = ({ 
  theme, 
  language, 
  setLanguage, 
  autoDetectLanguage, 
  logEvent 
}: {
  theme: any;
  language: any;
  setLanguage: (lang: string) => void;
  autoDetectLanguage: () => void;
  logEvent: (event: string, data?: any) => void;
}) => {
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  const languageOptions = [
    { code: 'ar', name: 'العربية', flag: '🇸🇦', direction: 'rtl' },
    { code: 'en', name: 'English', flag: '🇬🇧', direction: 'ltr' },
    { code: 'fr', name: 'Français', flag: '🇫🇷', direction: 'ltr' },
    { code: 'es', name: 'Español', flag: '🇪🇸', direction: 'ltr' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪', direction: 'ltr' },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
            <Globe size={24} color={theme.colors.primary} />
          </View>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            اللغة والترجمة
          </Text>
        </View>
      </View>

      <View style={styles.sectionContent}>
        {/* Current Language */}
        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
          onPress={() => setShowLanguageModal(true)}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Languages size={20} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={[styles.settingText, { color: theme.colors.text }]}>
                اللغة الحالية
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                {language.current === 'ar' ? 'العربية' : 'English'}
              </Text>
            </View>
          </View>
          <ChevronRight size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        {/* Auto Detect Language */}
        <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.success}20` }]}>
              <Target size={20} color={theme.colors.success} />
            </View>
            <View>
              <Text style={[styles.settingText, { color: theme.colors.text }]}>
                الكشف التلقائي للغة
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
                {language.autoDetect ? 'مفعل' : 'معطل'}
              </Text>
            </View>
          </View>
          <Switch
            value={language.autoDetect}
            onValueChange={() => {
              autoDetectLanguage();
              logEvent('auto_detect_language_toggled');
            }}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            thumbColor={language.autoDetect ? '#fff' : '#666'}
          />
        </View>

        {/* Language Modal */}
        <Modal
          visible={showLanguageModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowLanguageModal(false)}
        >
          <BlurView intensity={20} style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                اختر اللغة
              </Text>
              
              <ScrollView style={styles.languageList}>
                {languageOptions.map((option) => (
                  <TouchableOpacity
                    key={option.code}
                    style={[
                      styles.languageItem,
                      language.current === option.code && styles.languageItemActive
                    ]}
                    onPress={() => {
                      setLanguage(option.code);
                      setShowLanguageModal(false);
                      logEvent('language_changed', { language: option.code });
                    }}
                  >
                    <View style={styles.languageItemLeft}>
                      <Text style={styles.languageFlag}>{option.flag}</Text>
                      <View>
                        <Text style={[
                          styles.languageName,
                          { color: theme.colors.text }
                        ]}>
                          {option.name}
                        </Text>
                        <Text style={[
                          styles.languageCode,
                          { color: theme.colors.textSecondary }
                        ]}>
                          {option.code.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    {language.current === option.code && (
                      <Check size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setShowLanguageModal(false)}
              >
                <Text style={styles.modalButtonText}>إغلاق</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Modal>
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
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  advancedToggleText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  advancedSettings: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  colorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  colorOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    margin: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionActive: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  colorInfo: {
    marginBottom: 20,
  },
  colorInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  colorInfoDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  colorInfoName: {
    fontSize: 14,
    fontWeight: '500',
  },
  colorInfoDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  fontScaleContainer: {
    marginBottom: 20,
  },
  fontScalePreview: {
    textAlign: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  fontScaleSlider: {
    width: '100%',
    height: 40,
  },
  fontScaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  fontScaleLabel: {
    fontSize: 12,
  },
  languageList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  languageItemActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  languageItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
  },
  languageCode: {
    fontSize: 12,
    marginTop: 2,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
