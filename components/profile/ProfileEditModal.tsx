import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    Alert,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Keyboard
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';

interface SocialLink {
    platform: 'instagram' | 'twitter' | 'facebook' | 'youtube' | 'tiktok' | 'website' | 'linkedin' | 'snapchat';
    url: string;
}

interface CooldownInfo {
    canChange: boolean;
    daysRemaining: number;
    hoursRemaining: number;
}

interface UserData {
    name: string;
    username: string;
    bio: string;
    socials?: SocialLink[];
    lastUsernameChange?: Date;
}

interface ProfileEditModalProps {
    visible: boolean;
    onClose: () => void;
    initialData: UserData;
    onSave: (data: UserData) => void;
    usernameCooldown?: CooldownInfo;
}

const SOCIAL_PLATFORMS = [
    { id: 'instagram', icon: 'instagram', iconLibrary: 'FontAwesome' as const, color: '#E1306C' },
    { id: 'twitter', icon: 'twitter', iconLibrary: 'FontAwesome' as const, color: '#1DA1F2' },
    { id: 'facebook', icon: 'facebook', iconLibrary: 'FontAwesome' as const, color: '#1877F2' },
    { id: 'youtube', icon: 'youtube-play', iconLibrary: 'FontAwesome' as const, color: '#FF0000' },
    { id: 'tiktok', icon: 'musical-notes', iconLibrary: 'Ionicons' as const, color: '#FFFFFF' },
    { id: 'linkedin', icon: 'linkedin', iconLibrary: 'FontAwesome' as const, color: '#0A66C2' },
    { id: 'snapchat', icon: 'snapchat', iconLibrary: 'FontAwesome' as const, color: '#FFFC00' },
    { id: 'website', icon: 'globe', iconLibrary: 'Ionicons' as const, color: '#22c55e' }
];

// ✅ PERFORMANCE: Memoize modal to prevent unnecessary re-renders
const ProfileEditModal = memo(function ProfileEditModal({ visible, onClose, initialData, onSave, usernameCooldown }: ProfileEditModalProps) {
    const [name, setName] = useState(initialData.name);
    const [bio, setBio] = useState(initialData.bio);
    const [username, setUsername] = useState(initialData.username);
    const [socials, setSocials] = useState<SocialLink[]>(initialData.socials || []);
    
    // ✅ NEW: Validation errors state
    const [nameError, setNameError] = useState('');
    const [usernameError, setUsernameError] = useState('');
    
    // ✅ Store refs for inputs to manage focus
    const nameInputRef = useRef<TextInput>(null);
    const usernameInputRef = useRef<TextInput>(null);
    const bioInputRef = useRef<TextInput>(null);

    // Username restriction logic - use backend cooldown if available, fallback to local calculation
    const canEditUsername = usernameCooldown 
        ? usernameCooldown.canChange 
        : (initialData.lastUsernameChange 
            ? Math.floor((new Date().getTime() - new Date(initialData.lastUsernameChange).getTime()) / (1000 * 3600 * 24)) >= 15
            : true);
    
    const daysRemaining = usernameCooldown 
        ? usernameCooldown.daysRemaining 
        : (initialData.lastUsernameChange 
            ? Math.max(0, 15 - Math.floor((new Date().getTime() - new Date(initialData.lastUsernameChange).getTime()) / (1000 * 3600 * 24)))
            : 0);
    
    const hoursRemaining = usernameCooldown?.hoursRemaining || 0;

    // ✅ OPTIMIZATION: Reset state when modal opens
    useEffect(() => {
        if (visible) {
            setName(initialData.name);
            setBio(initialData.bio);
            setUsername(initialData.username);
            setSocials(initialData.socials || []);
            setNameError('');
            setUsernameError('');
        }
    }, [visible, initialData]);

    // ✅ NEW: Real-time validation for username
    const validateUsername = useCallback((text: string): string => {
        if (!text.trim()) {
            return 'اسم المستخدم مطلوب';
        }
        if (text.length < 3) {
            return 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل';
        }
        if (text.length > 20) {
            return 'اسم المستخدم طويل جداً (الحد الأقصى 20 حرف)';
        }
        if (!/^[a-zA-Z0-9_]+$/.test(text)) {
            return 'اسم المستخدم يجب أن يحتوي على حروف وأرقام و _ فقط';
        }
        return '';
    }, []);

    // ✅ NEW: Real-time validation for name
    const validateName = useCallback((text: string): string => {
        if (!text.trim()) {
            return 'الاسم مطلوب';
        }
        if (text.length < 2) {
            return 'الاسم قصير جداً';
        }
        if (text.length > 30) {
            return 'الاسم طويل جداً (الحد الأقصى 30 حرف)';
        }
        return '';
    }, []);

    // ✅ IMPROVED: Enhanced save handler with validation
    const handleSave = useCallback(() => {
        // Dismiss keyboard first
        Keyboard.dismiss();
        
        // Validate all fields
        const nameValidationError = validateName(name);
        const usernameValidationError = validateUsername(username);
        
        if (nameValidationError) {
            setNameError(nameValidationError);
            Alert.alert('خطأ', nameValidationError);
            return;
        }
        
        if (usernameValidationError) {
            setUsernameError(usernameValidationError);
            Alert.alert('خطأ', usernameValidationError);
            return;
        }

        const updatedData: UserData = {
            name: name.trim(),
            bio: bio.trim(),
            username: username.trim().toLowerCase(),
            socials: socials.filter(s => s.url.trim() !== ''), // Remove empty socials
            // If username changed, update timestamp
            lastUsernameChange: username !== initialData.username ? new Date() : initialData.lastUsernameChange
        };

        onSave(updatedData);
        onClose();
    }, [name, bio, username, socials, initialData, validateName, validateUsername, onSave, onClose]);

    // ✅ OPTIMIZATION: Memoize callbacks
    const handleAddSocial = useCallback(() => {
        setSocials(prev => [...prev, { platform: 'instagram', url: '' }]);
    }, []);

    const handleRemoveSocial = useCallback((index: number) => {
        setSocials(prev => {
            const newSocials = [...prev];
            newSocials.splice(index, 1);
            return newSocials;
        });
    }, []);

    const updateSocial = useCallback((index: number, field: keyof SocialLink, value: string) => {
        setSocials(prev => {
            const newSocials = [...prev];
            newSocials[index] = { ...newSocials[index], [field]: value };
            return newSocials;
        });
    }, []);
    
    // ✅ NEW: Handle username change with validation
    const handleUsernameChange = useCallback((text: string) => {
        setUsername(text);
        const error = validateUsername(text);
        setUsernameError(error);
    }, [validateUsername]);
    
    // ✅ NEW: Handle name change with validation
    const handleNameChange = useCallback((text: string) => {
        setName(text);
        const error = validateName(text);
        setNameError(error);
    }, [validateName]);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <TouchableOpacity 
                style={styles.container} 
                activeOpacity={1} 
                onPress={Keyboard.dismiss}
            >
                <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="dark" />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardView}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <View style={styles.content}>
                        <View style={styles.header}>
                            <Text style={styles.title}>تعديل الملف الشخصي ✏️</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView 
                            showsVerticalScrollIndicator={false} 
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* Name */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>الاسم</Text>
                                <TextInput
                                    ref={nameInputRef}
                                    style={[styles.input, nameError ? styles.inputError : null]}
                                    value={name}
                                    onChangeText={handleNameChange}
                                    placeholder="الاسم الظاهر"
                                    placeholderTextColor="#666"
                                    returnKeyType="next"
                                    onSubmitEditing={() => usernameInputRef.current?.focus()}
                                    blurOnSubmit={false}
                                />
                                {nameError ? (
                                    <Text style={styles.errorText}>⚠️ {nameError}</Text>
                                ) : null}
                            </View>

                            {/* Username */}
                            <View style={styles.fieldContainer}>
                                <View style={styles.labelRow}>
                                    <Text style={styles.label}>اسم المستخدم</Text>
                                    {!canEditUsername && (
                                        <View style={styles.cooldownBadge}>
                                            <Ionicons name="time-outline" size={12} color="#FFA500" />
                                            <Text style={styles.cooldownBadgeText}>
                                                {daysRemaining > 0 
                                                    ? `${daysRemaining} يوم ${hoursRemaining > 0 ? `و ${hoursRemaining} ساعة` : ''}`
                                                    : `${hoursRemaining} ساعة`
                                                }
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <TextInput
                                    ref={usernameInputRef}
                                    style={[
                                        styles.input, 
                                        !canEditUsername && styles.disabledInput,
                                        usernameError ? styles.inputError : null
                                    ]}
                                    value={username}
                                    onChangeText={handleUsernameChange}
                                    placeholder="username"
                                    placeholderTextColor="#666"
                                    editable={canEditUsername}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="next"
                                    onSubmitEditing={() => bioInputRef.current?.focus()}
                                    blurOnSubmit={false}
                                />
                                {usernameError && canEditUsername ? (
                                    <Text style={styles.errorText}>⚠️ {usernameError}</Text>
                                ) : !canEditUsername ? (
                                    <Text style={styles.warningText}>
                                        ⏳ يمكنك تغيير اسم المستخدم بعد {daysRemaining > 0 ? `${daysRemaining} يوم` : ''} {hoursRemaining > 0 ? `${hoursRemaining} ساعة` : ''}
                                    </Text>
                                ) : null}
                            </View>

                            {/* Bio */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>البايو (السيرة الذاتية)</Text>
                                <TextInput
                                    ref={bioInputRef}
                                    style={[styles.input, styles.textArea]}
                                    value={bio}
                                    onChangeText={setBio}
                                    placeholder="اكتب شيئاً عن نفسك..."
                                    placeholderTextColor="#666"
                                    multiline
                                    maxLength={150}
                                    returnKeyType="done"
                                    blurOnSubmit={true}
                                />
                                <Text style={[styles.charCount, bio.length >= 140 && { color: '#FFA500' }]}>
                                    {bio.length}/150
                                </Text>
                            </View>

                            {/* Social Links */}
                            <View style={styles.fieldContainer}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.label}>روابط التواصل الاجتماعي</Text>
                                    <TouchableOpacity onPress={handleAddSocial} style={styles.addButton}>
                                        <Ionicons name="add" size={16} color="#FFF" />
                                        <Text style={styles.addButtonText}>إضافة</Text>
                                    </TouchableOpacity>
                                </View>

                                {socials.map((social, index) => (
                                    <View key={index} style={styles.socialRow}>
                                        {/* Platform Selector (simplified as cycling for now or basic dropdown logic if needed, but keeping simple: horizontal scroll of icons to pick?) 
                                           For simplicity: Just a dropdown or cycler. Let's make it a horizontal selector above the input or just valid icons.
                                           Alternative: Tap icon to switch platform.
                                        */}
                                        <View style={styles.socialInputContainer}>
                                            <TouchableOpacity
                                                style={styles.platformIcon}
                                                // Simple cycler for demo purposes otherwise we need a picker
                                                onPress={() => {
                                                    const currentIndex = SOCIAL_PLATFORMS.findIndex(p => p.id === social.platform);
                                                    const nextIndex = (currentIndex + 1) % SOCIAL_PLATFORMS.length;
                                                    updateSocial(index, 'platform', SOCIAL_PLATFORMS[nextIndex].id);
                                                }}
                                            >
                                                {(() => {
                                                    const platform = SOCIAL_PLATFORMS.find(p => p.id === social.platform);
                                                    if (!platform) return null;
                                                    const IconComponent = platform.iconLibrary === 'FontAwesome' ? FontAwesome : Ionicons;
                                                    return (
                                                        <IconComponent
                                                            name={platform.icon as any}
                                                            size={20}
                                                            color={platform.color}
                                                        />
                                                    );
                                                })()}
                                            </TouchableOpacity>
                                            <TextInput
                                                style={styles.socialUrlInput}
                                                value={social.url}
                                                onChangeText={(text) => updateSocial(index, 'url', text)}
                                                placeholder="الرابط..."
                                                placeholderTextColor="#666"
                                                autoCapitalize="none"
                                            />
                                            <TouchableOpacity onPress={() => handleRemoveSocial(index)} style={styles.removeButton}>
                                                <Ionicons name="trash-outline" size={18} color="#ff4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>

                            <View style={{ height: 20 }} />
                        </ScrollView>

                        {/* Footer */}
                        <TouchableOpacity onPress={handleSave}>
                            <LinearGradient
                                colors={[ProfileTheme.colors.neonGreen, '#15803d']}
                                style={styles.saveButton}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={styles.saveButtonText}>حفظ التغييرات</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </TouchableOpacity>
        </Modal>
    );
});

// ✅ PERFORMANCE: Export memoized component
export default ProfileEditModal;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        height: '85%', // Taller modal
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
    },
    closeButton: {
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    fieldContainer: {
        marginBottom: 20,
    },
    label: {
        color: '#AAA',
        marginBottom: 8,
        fontSize: 14,
        textAlign: 'right', // Arabo-centric
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cooldownBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 165, 0, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    cooldownBadgeText: {
        color: '#FFA500',
        fontSize: 11,
        fontWeight: '600',
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 16,
        color: '#FFF',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        textAlign: 'right',
    },
    disabledInput: {
        opacity: 0.5,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    inputError: {
        borderColor: '#ff4444',
        borderWidth: 1.5,
    },
    errorText: {
        color: '#ff4444',
        fontSize: 12,
        marginTop: 6,
        textAlign: 'right',
    },
    warningText: {
        color: '#FFA500',
        fontSize: 12,
        marginTop: 6,
        textAlign: 'right',
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    charCount: {
        color: '#666',
        fontSize: 12,
        textAlign: 'left',
        marginTop: 4,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(50, 205, 50, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
    },
    addButtonText: {
        color: '#32cd32',
        fontSize: 12,
        fontWeight: 'bold',
    },
    socialRow: {
        marginBottom: 10,
    },
    socialInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    platformIcon: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
    },
    socialUrlInput: {
        flex: 1,
        color: '#FFF',
        paddingHorizontal: 12,
        textAlign: 'left', // URLs are usually LTR
    },
    removeButton: {
        padding: 10,
    },
    saveButton: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
