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
    Keyboard,
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import { GlassWrapper, glassProps, ACCENT, ACCENT_DARK, SURFACE_BG, AppGradients } from '../../constants/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const SOCIAL_PLATFORMS = [
    { id: 'instagram',  icon: 'instagram',     iconLibrary: 'FontAwesome' as const, color: '#E1306C' },
    { id: 'twitter',    icon: 'twitter',        iconLibrary: 'FontAwesome' as const, color: '#1DA1F2' },
    { id: 'facebook',   icon: 'facebook',       iconLibrary: 'FontAwesome' as const, color: '#1877F2' },
    { id: 'youtube',    icon: 'youtube-play',   iconLibrary: 'FontAwesome' as const, color: '#FF0000' },
    { id: 'tiktok',     icon: 'musical-notes',  iconLibrary: 'Ionicons'    as const, color: '#FFFFFF' },
    { id: 'linkedin',   icon: 'linkedin',       iconLibrary: 'FontAwesome' as const, color: '#0A66C2' },
    { id: 'snapchat',   icon: 'snapchat',       iconLibrary: 'FontAwesome' as const, color: '#FFFC00' },
    { id: 'website',    icon: 'globe',          iconLibrary: 'Ionicons'    as const, color: '#22c55e' },
];

// ─── Component ────────────────────────────────────────────────────────────────

const ProfileEditModal = memo(function ProfileEditModal({
    visible,
    onClose,
    initialData,
    onSave,
    usernameCooldown,
}: ProfileEditModalProps) {
    const { t } = useTranslation();

    const [name,     setName]     = useState(initialData.name);
    const [bio,      setBio]      = useState(initialData.bio);
    const [username, setUsername] = useState(initialData.username);
    const [socials,  setSocials]  = useState<SocialLink[]>(initialData.socials || []);

    const [nameError,     setNameError]     = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [focusedField,  setFocusedField]  = useState<string | null>(null);

    const nameInputRef     = useRef<TextInput>(null);
    const usernameInputRef = useRef<TextInput>(null);
    const bioInputRef      = useRef<TextInput>(null);

    // Username cooldown
    const canEditUsername = usernameCooldown
        ? usernameCooldown.canChange
        : (initialData.lastUsernameChange
            ? Math.floor((Date.now() - new Date(initialData.lastUsernameChange).getTime()) / 86_400_000) >= 15
            : true);

    const daysRemaining  = usernameCooldown?.daysRemaining  ?? 0;
    const hoursRemaining = usernameCooldown?.hoursRemaining ?? 0;

    useEffect(() => {
        if (visible) {
            setName(initialData.name);
            setBio(initialData.bio);
            setUsername(initialData.username);
            setSocials(initialData.socials || []);
            setNameError('');
            setUsernameError('');
            setFocusedField(null);
        }
    }, [visible, initialData]);

    // Validation
    const validateUsername = useCallback((text: string): string => {
        if (!text.trim())              return t.profile.usernameRequired;
        if (text.length < 3)           return t.profile.usernameMinLength;
        if (text.length > 20)          return t.profile.usernameMaxLength;
        if (!/^[a-zA-Z0-9_]+$/.test(text)) return t.profile.usernamePatternError;
        return '';
    }, [t.profile]);

    const validateName = useCallback((text: string): string => {
        if (!text.trim())    return t.profile.nameRequired;
        if (text.length < 2) return t.profile.nameTooShort;
        if (text.length > 30) return t.profile.nameMaxLength;
        return '';
    }, [t.profile]);

    const handleSave = useCallback(() => {
        Keyboard.dismiss();
        const nameErr = validateName(name);
        const userErr = validateUsername(username);
        if (nameErr) { setNameError(nameErr); Alert.alert(t.common.error, nameErr); return; }
        if (userErr) { setUsernameError(userErr); Alert.alert(t.common.error, userErr); return; }
        onSave({
            name: name.trim(),
            bio: bio.trim(),
            username: username.trim().toLowerCase(),
            socials: socials.filter(s => s.url.trim() !== ''),
            lastUsernameChange: username !== initialData.username ? new Date() : initialData.lastUsernameChange,
        });
        onClose();
    }, [name, bio, username, socials, initialData, validateName, validateUsername, onSave, onClose, t.common.error]);

    const handleAddSocial    = useCallback(() => setSocials(p => [...p, { platform: 'instagram', url: '' }]), []);
    const handleRemoveSocial = useCallback((i: number) => setSocials(p => p.filter((_, idx) => idx !== i)), []);
    const updateSocial       = useCallback((i: number, field: keyof SocialLink, val: string) =>
        setSocials(p => p.map((s, idx) => idx === i ? { ...s, [field]: val } : s)), []);

    const handleUsernameChange = useCallback((text: string) => {
        setUsername(text);
        setUsernameError(validateUsername(text));
    }, [validateUsername]);

    const handleNameChange = useCallback((text: string) => {
        setName(text);
        setNameError(validateName(text));
    }, [validateName]);

    // Input border color based on focus / error
    const inputBorder = (field: string, hasError: boolean) => {
        if (hasError)            return '#ef4444';
        if (focusedField === field) return ACCENT;
        return 'rgba(168,85,247,0.2)';
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={Keyboard.dismiss}>
                {/* Backdrop blur */}
                <GlassWrapper {...(glassProps.modal as any)} style={StyleSheet.absoluteFill} />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={s.kav}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <View style={s.sheet}>
                        {/* Purple top accent line */}
                        <LinearGradient
                            colors={[ACCENT, ACCENT_DARK, 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={s.topAccent}
                        />

                        {/* Header */}
                        <View style={s.header}>
                            <Text style={s.title}>{t.profile.editProfileTitle} ✏️</Text>
                            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                                <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={s.scroll}
                            keyboardShouldPersistTaps="handled"
                        >
                            {/* ── Name ─────────────────────────────────────── */}
                            <View style={s.field}>
                                <Text style={s.label}>{t.profile.nameLabel}</Text>
                                <View style={[s.inputWrap, { borderColor: inputBorder('name', !!nameError) }]}>
                                    <GlassWrapper {...(glassProps.card as any)} style={StyleSheet.absoluteFill} />
                                    <TextInput
                                        ref={nameInputRef}
                                        style={s.input}
                                        value={name}
                                        onChangeText={handleNameChange}
                                        placeholder={t.profile.namePlaceholder}
                                        placeholderTextColor="rgba(255,255,255,0.25)"
                                        returnKeyType="next"
                                        onSubmitEditing={() => usernameInputRef.current?.focus()}
                                        blurOnSubmit={false}
                                        onFocus={() => setFocusedField('name')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                </View>
                                {nameError ? <Text style={s.errorTxt}>⚠ {nameError}</Text> : null}
                            </View>

                            {/* ── Username ──────────────────────────────────── */}
                            <View style={s.field}>
                                <View style={s.labelRow}>
                                    <Text style={s.label}>{t.profile.usernameLabel}</Text>
                                    {!canEditUsername && (
                                        <View style={s.cooldownBadge}>
                                            <Ionicons name="time-outline" size={11} color="#FFA500" />
                                            <Text style={s.cooldownTxt}>
                                                {daysRemaining > 0
                                                    ? `${daysRemaining}d ${hoursRemaining > 0 ? `${hoursRemaining}h` : ''}`
                                                    : `${hoursRemaining}h`}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <View style={[
                                    s.inputWrap,
                                    { borderColor: inputBorder('username', !!usernameError) },
                                    !canEditUsername && s.disabledWrap,
                                ]}>
                                    <GlassWrapper {...(glassProps.card as any)} style={StyleSheet.absoluteFill} />
                                    <TextInput
                                        ref={usernameInputRef}
                                        style={[s.input, !canEditUsername && s.disabledInput]}
                                        value={username}
                                        onChangeText={handleUsernameChange}
                                        placeholder="username"
                                        placeholderTextColor="rgba(255,255,255,0.25)"
                                        editable={canEditUsername}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        returnKeyType="next"
                                        onSubmitEditing={() => bioInputRef.current?.focus()}
                                        blurOnSubmit={false}
                                        onFocus={() => setFocusedField('username')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                </View>
                                {usernameError && canEditUsername
                                    ? <Text style={s.errorTxt}>⚠ {usernameError}</Text>
                                    : !canEditUsername
                                    ? <Text style={s.warnTxt}>
                                        {`⏳ ${t.profile.usernameChangeAfter} ${daysRemaining > 0 ? `${daysRemaining}d` : ''} ${hoursRemaining > 0 ? `${hoursRemaining}h` : ''}`}
                                      </Text>
                                    : null}
                            </View>

                            {/* ── Bio ───────────────────────────────────────── */}
                            <View style={s.field}>
                                <Text style={s.label}>{t.profile.bioLabel}</Text>
                                <View style={[s.inputWrap, s.textAreaWrap, { borderColor: inputBorder('bio', false) }]}>
                                    <GlassWrapper {...(glassProps.card as any)} style={StyleSheet.absoluteFill} />
                                    <TextInput
                                        ref={bioInputRef}
                                        style={[s.input, s.textArea]}
                                        value={bio}
                                        onChangeText={setBio}
                                        placeholder={t.profile.bioPlaceholder}
                                        placeholderTextColor="rgba(255,255,255,0.25)"
                                        multiline
                                        maxLength={500}
                                        blurOnSubmit
                                        onFocus={() => setFocusedField('bio')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                </View>
                                <Text style={[s.charCount, bio.length >= 450 && { color: '#FFA500' }]}>
                                    {bio.length}/500
                                </Text>
                            </View>

                            {/* ── Social Links ──────────────────────────────── */}
                            <View style={s.field}>
                                <View style={s.sectionHeader}>
                                    <Text style={s.label}>{t.profile.socialLinks}</Text>
                                    <TouchableOpacity onPress={handleAddSocial} style={s.addBtn}>
                                        <LinearGradient
                                            colors={[ACCENT, ACCENT_DARK]}
                                            style={s.addBtnGrad}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                        >
                                            <Ionicons name="add" size={14} color="#fff" />
                                            <Text style={s.addBtnTxt}>{t.profile.addSocialAction}</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>

                                {socials.map((social, idx) => {
                                    const platform = SOCIAL_PLATFORMS.find(p => p.id === social.platform);
                                    const IconComp = platform?.iconLibrary === 'FontAwesome' ? FontAwesome : Ionicons;
                                    return (
                                        <View key={idx} style={s.socialRow}>
                                            <View style={s.socialWrap}>
                                                <GlassWrapper {...(glassProps.card as any)} style={StyleSheet.absoluteFill} />
                                                <TouchableOpacity
                                                    style={s.platformBtn}
                                                    onPress={() => {
                                                        const ci = SOCIAL_PLATFORMS.findIndex(p => p.id === social.platform);
                                                        updateSocial(idx, 'platform', SOCIAL_PLATFORMS[(ci + 1) % SOCIAL_PLATFORMS.length].id);
                                                    }}
                                                >
                                                    {platform && (
                                                        <IconComp name={platform.icon as any} size={18} color={platform.color} />
                                                    )}
                                                </TouchableOpacity>
                                                <TextInput
                                                    style={s.socialInput}
                                                    value={social.url}
                                                    onChangeText={t => updateSocial(idx, 'url', t)}
                                                    placeholder={t.profile.socialUrlPlaceholder}
                                                    placeholderTextColor="rgba(255,255,255,0.25)"
                                                    autoCapitalize="none"
                                                />
                                                <TouchableOpacity onPress={() => handleRemoveSocial(idx)} style={s.removeBtn}>
                                                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>

                            <View style={{ height: 24 }} />
                        </ScrollView>

                        {/* ── Save button — purple gradient ─────────────────── */}
                        <TouchableOpacity onPress={handleSave} activeOpacity={0.85}>
                            <LinearGradient
                                colors={AppGradients.purpleCTA}
                                style={s.saveBtn}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={s.saveTxt}>{t.profile.saveChanges}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </TouchableOpacity>
        </Modal>
    );
});

export default ProfileEditModal;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    kav: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: SURFACE_BG,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        height: '88%',
        paddingBottom: Platform.OS === 'ios' ? 44 : 24,
        overflow: 'hidden',
        borderTopWidth: 1,
        borderColor: 'rgba(168,85,247,0.2)',
    },
    topAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },

    /* Header */
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(168,85,247,0.15)',
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },

    scroll: { paddingBottom: 16 },

    /* Fields */
    field: { marginBottom: 18 },
    label: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 8,
        textAlign: 'right',
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },

    /* Input wrapper — glass + colored border */
    inputWrap: {
        borderRadius: 14,
        borderWidth: 1.5,
        overflow: 'hidden',
    },
    textAreaWrap: {},
    disabledWrap: { opacity: 0.45 },

    input: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
        paddingHorizontal: 16,
        paddingVertical: 14,
        textAlign: 'right',
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
        paddingTop: 14,
    },
    disabledInput: { opacity: 0.6 },

    charCount: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 11,
        textAlign: 'left',
        marginTop: 5,
    },

    /* Validation */
    errorTxt: {
        color: '#ef4444',
        fontSize: 12,
        marginTop: 5,
        textAlign: 'right',
    },
    warnTxt: {
        color: '#FFA500',
        fontSize: 12,
        marginTop: 5,
        textAlign: 'right',
    },

    /* Cooldown badge */
    cooldownBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,165,0,0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,165,0,0.25)',
    },
    cooldownTxt: {
        color: '#FFA500',
        fontSize: 11,
        fontWeight: '700',
    },

    /* Social links */
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    addBtn: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    addBtnGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 4,
    },
    addBtnTxt: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    socialRow: { marginBottom: 8 },
    socialWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(168,85,247,0.2)',
        overflow: 'hidden',
        paddingVertical: 4,
    },
    platformBtn: {
        width: 44,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: 'rgba(168,85,247,0.15)',
    },
    socialInput: {
        flex: 1,
        color: '#fff',
        paddingHorizontal: 12,
        fontSize: 14,
        textAlign: 'left',
    },
    removeBtn: {
        padding: 10,
    },

    /* Save */
    saveBtn: {
        height: 54,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#A855F7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 8,
    },
    saveTxt: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
});
