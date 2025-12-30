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
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Key,
  Fingerprint,
  Eye,
  EyeOff,
  Database,
  Cloud,
  CloudOff,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings as SettingsIcon,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  HardDrive,
  Smartphone,
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
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Settings,
  LogOut,
  HelpCircle,
  MessageSquare,
  Share2,
  Copy,
  ExternalLink,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Trash2 as TrashIcon,
  RefreshCw as RefreshIcon,
  AlertCircle,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  XCircle,
  Plus,
  Minus,
  Edit,
  Save,
  RotateCcw,
  Power,
  Wifi as WifiIcon,
  Battery as BatteryIcon,
  HardDrive as HardDriveIcon,
  Smartphone as SmartphoneIcon,
  Globe as GlobeIcon,
  MapPin as MapPinIcon,
  Camera as CameraIcon,
  Mic as MicIcon,
  Users as UsersIcon,
  Package as PackageIcon,
  Server as ServerIcon,
  Cpu as CpuIcon,
  Gauge as GaugeIcon,
  BarChart3 as BarChartIcon,
  TrendingUp as TrendingUpIcon,
  Award as AwardIcon,
  Target as TargetIcon,
  Flag as FlagIcon,
  Coins as CoinsIcon,
  CreditCard as CreditCardIcon,
  Gift as GiftIcon,
  Ticket as TicketIcon,
  Languages as LanguagesIcon,
  Type as TypeIcon,
  Sliders as SlidersIcon,
  ToggleLeft as ToggleLeftIcon,
  ToggleRight as ToggleRightIcon,
  Layers as LayersIcon,
  Timer as TimerIcon,
  Zap as ZapIcon,
  Crown as CrownIcon,
  Sparkles as SparklesIcon,
  Gamepad2 as GamepadIcon,
  Loader as LoaderIcon,
  Check as CheckIcon2,
  X as XIcon,
  ChevronRight as ChevronRightIcon,
  ChevronDown as ChevronDownIcon,
  Search as SearchIcon,
  Filter as FilterIcon,
  Star as StarIcon,
  Heart as HeartIcon,
  Trophy as TrophyIcon,
  Eye as EyeIcon2,
  EyeOff as EyeOffIcon2,
  Settings as SettingsIcon2,
  LogOut as LogOutIcon,
  HelpCircle as HelpCircleIcon,
  MessageSquare as MessageSquareIcon,
  Share2 as Share2Icon,
  Copy as CopyIcon,
  ExternalLink as ExternalLinkIcon,
  Download as DownloadIcon2,
  Upload as UploadIcon2,
  Trash2 as TrashIcon2,
  RefreshCw as RefreshIcon2,
  AlertCircle as AlertCircleIcon,
  Info as InfoIcon2,
  CheckCircle as CheckIcon3,
  XCircle as XCircleIcon,
  Plus as PlusIcon,
  Minus as MinusIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  RotateCcw as RotateCcwIcon,
  Power as PowerIcon,
} from 'lucide-react-native';
import { useTranslation } from '../../src/i18n';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Advanced Security Component
export const AdvancedSecuritySettings = ({ 
  theme, 
  security, 
  setPIN, 
  setBiometric, 
  setPermission, 
  setAutoLock, 
  logEvent 
}: {
  theme: any;
  security: any;
  setPIN: any;
  setBiometric: any;
  setPermission: any;
  setAutoLock: any;
  logEvent: any;
}) => {
  const { t } = useTranslation();
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isSettingPin, setIsSettingPin] = useState(false);

  const handleSetPIN = async () => {
    if (pinInput.length < 4) {
      Alert.alert(t.common?.error || 'Error', t.security?.pinTooShort || 'PIN must be at least 4 digits');
      return;
    }
    
    if (pinInput !== confirmPin) {
      Alert.alert(t.common?.error || 'Error', t.security?.pinMismatch || 'PIN codes do not match');
      return;
    }

    setIsSettingPin(true);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    
    setPIN(true, pinInput);
    setShowSecurityModal(false);
    setPinInput('');
    setConfirmPin('');
    setIsSettingPin(false);
    logEvent('pin_set');
  };

  const handleBiometricToggle = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    if (!hasHardware || !isEnrolled) {
      Alert.alert(t.common?.unavailable || 'Unavailable', t.security?.biometricUnavailable || 'Fingerprint or Face ID not available on this device');
      return;
    }
    
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t.security?.confirmIdentity || 'Confirm Identity',
      fallbackLabel: t.security?.usePasscode || 'Use Passcode',
    });
    
    if (result.success) {
      setBiometric(!security.biometricEnabled);
      logEvent('biometric_toggled', { enabled: !security.biometricEnabled });
    }
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {t.security?.title || 'Advanced Security'}
      </Text>
      
      {/* PIN Settings */}
      <TouchableOpacity
        style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
        onPress={() => setShowSecurityModal(true)}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.error}20` }]}>
            <Key size={20} color={theme.colors.error} />
          </View>
          <View>
            <Text style={[styles.settingText, { color: theme.colors.text }]}>
              {t.security?.pinCode || 'PIN Code'}
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
              {security.pinEnabled ? (t.security?.pinEnabled || 'Enabled') : (t.security?.pinDisabled || 'Disabled')}
            </Text>
          </View>
        </View>
        <ChevronRight size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      {/* Biometric Settings */}
      <TouchableOpacity
        style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
        onPress={handleBiometricToggle}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.error}20` }]}>
            <Fingerprint size={20} color={theme.colors.error} />
          </View>
          <View>
            <Text style={[styles.settingText, { color: theme.colors.text }]}>
              {t.security?.biometric || 'Fingerprint / Face ID'}
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
              {security.biometricEnabled ? (t.security?.biometricEnabled || 'Enabled') : (t.security?.biometricDisabled || 'Disabled')}
            </Text>
          </View>
        </View>
        <Switch
          value={security.biometricEnabled}
          onValueChange={handleBiometricToggle}
          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          thumbColor={security.biometricEnabled ? '#fff' : '#666'}
        />
      </TouchableOpacity>

      {/* Auto Lock Settings */}
      <TouchableOpacity
        style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
        onPress={() => {
          Alert.alert(
            t.security?.autoLock || 'Auto Lock',
            '',
            [
              { text: t.security?.immediate || 'Immediate', onPress: () => setAutoLock(0) },
              { text: t.security?.oneMinute || '1 minute', onPress: () => setAutoLock(1) },
              { text: t.security?.fiveMinutes || '5 minutes', onPress: () => setAutoLock(5) },
              { text: t.security?.fifteenMinutes || '15 minutes', onPress: () => setAutoLock(15) },
              { text: t.security?.never || 'Never', onPress: () => setAutoLock(999) },
            ]
          );
        }}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.error}20` }]}>
            <Timer size={20} color={theme.colors.error} />
          </View>
          <View>
            <Text style={[styles.settingText, { color: theme.colors.text }]}>
              {t.security?.autoLock || 'Auto Lock'}
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
              {(t.security?.afterMinutes || 'After {n} minutes').replace('{n}', String(security.autoLockMinutes))}
            </Text>
          </View>
        </View>
        <ChevronRight size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      {/* Security Modal */}
      <Modal
        visible={showSecurityModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSecurityModal(false)}
      >
        <BlurView intensity={20} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {t.security?.setupPin || 'Setup PIN'}
            </Text>
            
            <View style={styles.pinInputContainer}>
              <Text style={[styles.pinLabel, { color: theme.colors.text }]}>
                {t.security?.newPin || 'New PIN'}
              </Text>
              <View style={[styles.pinInputWrapper, { borderColor: theme.colors.border }]}>
                <TextInput
                  style={[styles.pinInput, { color: theme.colors.text }]}
                  value={pinInput}
                  onChangeText={setPinInput}
                  placeholder={t.security?.enterDigits || 'Enter 4 digits'}
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry={!showPin}
                  keyboardType="numeric"
                  maxLength={6}
                />
                <TouchableOpacity
                  onPress={() => setShowPin(!showPin)}
                  style={styles.eyeButton}
                >
                  {showPin ? <EyeOff size={20} color={theme.colors.textSecondary} /> : <Eye size={20} color={theme.colors.textSecondary} />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.pinInputContainer}>
              <Text style={[styles.pinLabel, { color: theme.colors.text }]}>
                {t.security?.confirmPin || 'Confirm PIN'}
              </Text>
              <View style={[styles.pinInputWrapper, { borderColor: theme.colors.border }]}>
                <TextInput
                  style={[styles.pinInput, { color: theme.colors.text }]}
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  placeholder={t.security?.enterDigits || 'Enter 4 digits'}
                  placeholderTextColor={theme.colors.textSecondary}
                  secureTextEntry={!showPin}
                  keyboardType="numeric"
                  maxLength={6}
                />
                <TouchableOpacity
                  onPress={() => setShowPin(!showPin)}
                  style={styles.eyeButton}
                >
                  {showPin ? <EyeOff size={20} color={theme.colors.textSecondary} /> : <Eye size={20} color={theme.colors.textSecondary} />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.border }]}
                onPress={() => setShowSecurityModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.text }]}>
                  إلغاء
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleSetPIN}
                disabled={isSettingPin || pinInput.length < 4 || pinInput !== confirmPin}
              >
                {isSettingPin ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonTextWhite}>
                    حفظ
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
};

// Backup & Restore Component
export const BackupRestoreSettings = ({ 
  theme, 
  logEvent 
}: {
  theme: any;
  logEvent: any;
}) => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);

  const handleBackup = async () => {
    setIsBackingUp(true);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate backup
    setLastBackup(new Date());
    setIsBackingUp(false);
    logEvent('backup_created');
  };

  const handleRestore = async () => {
    Alert.alert(
      'استعادة البيانات',
      'هل أنت متأكد من استعادة البيانات؟ سيتم استبدال جميع الإعدادات الحالية.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'استعادة',
          style: 'destructive',
          onPress: async () => {
            setIsRestoring(true);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate restore
            setIsRestoring(false);
            logEvent('data_restored');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        النسخ الاحتياطي والاستعادة
      </Text>
      
      <TouchableOpacity
        style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
        onPress={handleBackup}
        disabled={isBackingUp}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.success}20` }]}>
            <Cloud size={20} color={theme.colors.success} />
          </View>
          <View>
            <Text style={[styles.settingText, { color: theme.colors.text }]}>
              إنشاء نسخة احتياطية
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
              {lastBackup ? `آخر نسخة: ${lastBackup.toLocaleDateString()}` : 'لم يتم إنشاء نسخة احتياطية'}
            </Text>
          </View>
        </View>
        {isBackingUp ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <ChevronRight size={20} color={theme.colors.textSecondary} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}
        onPress={handleRestore}
        disabled={isRestoring}
      >
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.warning}20` }]}>
            <Download size={20} color={theme.colors.warning} />
          </View>
          <View>
            <Text style={[styles.settingText, { color: theme.colors.text }]}>
              استعادة البيانات
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
              استعادة من النسخة الاحتياطية
            </Text>
          </View>
        </View>
        {isRestoring ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <ChevronRight size={20} color={theme.colors.textSecondary} />
        )}
      </TouchableOpacity>
    </View>
  );
};

// Performance Settings Component
export const PerformanceSettings = ({ 
  theme, 
  logEvent 
}: {
  theme: any;
  logEvent: any;
}) => {
  const [cacheSize, setCacheSize] = useState('125 MB');
  const [isClearingCache, setIsClearingCache] = useState(false);

  const handleClearCache = async () => {
    setIsClearingCache(true);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate cache clearing
    setCacheSize('0 MB');
    setIsClearingCache(false);
    logEvent('cache_cleared');
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        الأداء والذاكرة
      </Text>
      
      <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.info}20` }]}>
            <HardDrive size={20} color={theme.colors.info} />
          </View>
          <View>
            <Text style={[styles.settingText, { color: theme.colors.text }]}>
              حجم التخزين المؤقت
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
              {cacheSize}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: `${theme.colors.primary}20` }]}
          onPress={handleClearCache}
          disabled={isClearingCache}
        >
          {isClearingCache ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={[styles.actionButtonText, { color: theme.colors.primary }]}>
              مسح
            </Text>
          )}
        </TouchableOpacity>
      </View>

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
              15% (منخفض)
            </Text>
          </View>
        </View>
        <View style={styles.performanceBar}>
          <View style={[styles.performanceFill, { width: '15%', backgroundColor: theme.colors.success }]} />
        </View>
      </View>

      <View style={[styles.settingItem, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.settingLeft}>
          <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.info}20` }]}>
            <Battery size={20} color={theme.colors.info} />
          </View>
          <View>
            <Text style={[styles.settingText, { color: theme.colors.text }]}>
              استهلاك البطارية
            </Text>
            <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
              8% (منخفض)
            </Text>
          </View>
        </View>
        <View style={styles.performanceBar}>
          <View style={[styles.performanceFill, { width: '8%', backgroundColor: theme.colors.success }]} />
        </View>
      </View>
    </View>
  );
};

// Advanced Search Component
export const AdvancedSearchSettings = ({ 
  theme, 
  searchQuery, 
  setSearchQuery, 
  onSearch 
}: {
  theme: any;
  searchQuery: any;
  setSearchQuery: any;
  onSearch: any;
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: 'all',
    type: 'all',
    status: 'all',
  });

  return (
    <View style={styles.searchContainer}>
      <View style={[styles.searchInputContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Search size={18} color={theme.colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder="البحث في الإعدادات..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      
      <TouchableOpacity
        style={[styles.filterButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => setShowFilters(!showFilters)}
      >
        <Filter size={16} color="#fff" />
      </TouchableOpacity>

      {showFilters && (
        <View style={[styles.filtersContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Text style={[styles.filterTitle, { color: theme.colors.text }]}>الفلاتر</Text>
          
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: theme.colors.text }]}>الفئة:</Text>
            <View style={styles.filterOptions}>
              {['all', 'general', 'security', 'appearance'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.filterOption,
                    { backgroundColor: filters.category === option ? theme.colors.primary : theme.colors.border }
                  ]}
                  onPress={() => setFilters({ ...filters, category: option })}
                >
                  <Text style={[
                    styles.filterOptionText,
                    { color: filters.category === option ? '#fff' : theme.colors.text }
                  ]}>
                    {option === 'all' ? 'الكل' : option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
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
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    width: '90%',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  pinInputContainer: {
    marginBottom: 16,
  },
  pinLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  pinInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  pinInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  eyeButton: {
    padding: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextWhite: {
    fontSize: 16,
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
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    marginLeft: 8,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  filtersContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 14,
    marginRight: 12,
    minWidth: 60,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  filterOptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
