import React, { useState, useEffect } from 'react';
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
    Platform
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

export default function ProfileEditModal({ visible, onClose, initialData, onSave, usernameCooldown }: ProfileEditModalProps) {
    const [name, setName] = useState(initialData.name);
    const [bio, setBio] = useState(initialData.bio);
    const [username, setUsername] = useState(initialData.username);
    const [socials, setSocials] = useState<SocialLink[]>(initialData.socials || []);

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

    useEffect(() => {
        if (visible) {
            setName(initialData.name);
            setBio(initialData.bio);
            setUsername(initialData.username);
            setSocials(initialData.socials || []);
        }
    }, [visible, initialData]);

    const handleSave = () => {
        if (!name.trim()) {
            Alert.alert('خطأ', 'الاسم مطلوب');
            return;
        }
        if (!username.trim()) {
            Alert.alert('خطأ', 'اسم المستخدم مطلوب');
            return;
        }

        const updatedData: UserData = {
            name,
            bio,
            username,
            socials,
            // If username changed, update timestamp
            lastUsernameChange: username !== initialData.username ? new Date() : initialData.lastUsernameChange
        };

        onSave(updatedData);
        onClose();
    };

    const handleAddSocial = () => {
        setSocials([...socials, { platform: 'instagram', url: '' }]);
    };

    const handleRemoveSocial = (index: number) => {
        const newSocials = [...socials];
        newSocials.splice(index, 1);
        setSocials(newSocials);
    };

    const updateSocial = (index: number, field: keyof SocialLink, value: string) => {
        const newSocials = [...socials];
        newSocials[index] = { ...newSocials[index], [field]: value };
        setSocials(newSocials);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="dark" />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={styles.content}>
                        <View style={styles.header}>
                            <Text style={styles.title}>تعديل الملف الشخصي ✏️</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                            {/* Name */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>الاسم</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="الاسم الظاهر"
                                    placeholderTextColor="#666"
                                />
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
                                    style={[styles.input, !canEditUsername && styles.disabledInput]}
                                    value={username}
                                    onChangeText={setUsername}
                                    placeholder="username"
                                    placeholderTextColor="#666"
                                    editable={canEditUsername}
                                />
                                {!canEditUsername && (
                                    <Text style={styles.warningText}>
                                        ⏳ يمكنك تغيير اسم المستخدم بعد {daysRemaining > 0 ? `${daysRemaining} يوم` : ''} {hoursRemaining > 0 ? `${hoursRemaining} ساعة` : ''}
                                    </Text>
                                )}
                            </View>

                            {/* Bio */}
                            <View style={styles.fieldContainer}>
                                <Text style={styles.label}>البايو (السيرة الذاتية)</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={bio}
                                    onChangeText={setBio}
                                    placeholder="اكتب شيئاً عن نفسك..."
                                    placeholderTextColor="#666"
                                    multiline
                                    maxLength={150}
                                />
                                <Text style={styles.charCount}>{bio.length}/150</Text>
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
            </View>
        </Modal>
    );
}

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
