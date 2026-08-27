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
    Pressable,
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../../src/i18n';
import { ProfileTheme } from '../../constants/ProfileTheme';
import {
    GlassWrapper,
    glassProps,
    ACCENT,
    ACCENT_DARK,
    SURFACE_BG,
    AppGradients,
} from '../../constants/ui';
import { detectSocialPlatformFromUrl, SocialPlatformId } from '../../src/utils/socialPlatformDetect';

interface SocialLink {
    platform: SocialPlatformId;
    url: string;
}

type SocialLinkRow = SocialLink & { rowId: string };

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
    /** Kept for call-site compatibility; identity edits moved to More menu. */
    usernameCooldown?: unknown;
}

const SOCIAL_PLATFORMS = [
    { id: 'instagram', icon: 'instagram', iconLibrary: 'FontAwesome' as const, color: '#E1306C' },
    { id: 'twitter', icon: 'twitter', iconLibrary: 'FontAwesome' as const, color: '#1DA1F2' },
    { id: 'facebook', icon: 'facebook', iconLibrary: 'FontAwesome' as const, color: '#1877F2' },
    { id: 'youtube', icon: 'youtube-play', iconLibrary: 'FontAwesome' as const, color: '#FF0000' },
    { id: 'tiktok', icon: 'musical-notes', iconLibrary: 'Ionicons' as const, color: '#FFFFFF' },
    { id: 'linkedin', icon: 'linkedin', iconLibrary: 'FontAwesome' as const, color: '#0A66C2' },
    { id: 'snapchat', icon: 'snapchat', iconLibrary: 'FontAwesome' as const, color: '#FFFC00' },
    { id: 'website', icon: 'globe', iconLibrary: 'Ionicons' as const, color: '#22c55e' },
];

const ProfileEditModal = memo(function ProfileEditModal({
    visible,
    onClose,
    initialData,
    onSave,
}: ProfileEditModalProps) {
    const { t, isRTL } = useTranslation();

    const [bio, setBio] = useState(initialData.bio);
    const [socials, setSocials] = useState<SocialLinkRow[]>(() =>
        (initialData.socials || []).map((s, i) => ({ ...s, rowId: `social-${i}` })),
    );
    const [focusedField, setFocusedField] = useState<string | null>(null);

    const wasVisibleRef = useRef(false);
    const socialRowIdRef = useRef(0);
    const bioInputRef = useRef<TextInput>(null);

    const toSocialRows = useCallback((links: SocialLink[] = []): SocialLinkRow[] => {
        socialRowIdRef.current = links.length;
        return links.map((s, i) => ({ ...s, rowId: `social-open-${i}-${Date.now()}` }));
    }, []);

    useEffect(() => {
        const justOpened = visible && !wasVisibleRef.current;
        if (justOpened) {
            setBio(initialData.bio);
            setSocials(toSocialRows(initialData.socials || []));
            setFocusedField(null);
        }
        wasVisibleRef.current = visible;
    }, [visible, initialData, toSocialRows]);

    const handleSave = useCallback(() => {
        Keyboard.dismiss();
        onSave({
            name: initialData.name,
            username: initialData.username,
            bio: bio.trim(),
            socials: socials
                .filter((s) => s.url.trim() !== '')
                .map(({ platform, url }) => ({ platform, url: url.trim() })),
            lastUsernameChange: initialData.lastUsernameChange,
        });
        onClose();
    }, [bio, socials, initialData, onSave, onClose]);

    const handleAddSocial = useCallback(() => {
        setSocials((p) => {
            if (p.length >= 5) {
                Alert.alert(t.common.error, t.profile.maxSocialLinks);
                return p;
            }
            socialRowIdRef.current += 1;
            return [
                ...p,
                {
                    rowId: `social-new-${socialRowIdRef.current}`,
                    platform: 'instagram',
                    url: '',
                },
            ];
        });
    }, [t.common.error, t.profile.maxSocialLinks]);

    const handleRemoveSocial = useCallback(
        (rowId: string) => setSocials((p) => p.filter((s) => s.rowId !== rowId)),
        [],
    );

    const updateSocial = useCallback((rowId: string, field: keyof SocialLink, val: string) => {
        setSocials((p) => p.map((s) => (s.rowId === rowId ? { ...s, [field]: val } : s)));
    }, []);

    const handleSocialUrlChange = useCallback((rowId: string, url: string) => {
        setSocials((p) =>
            p.map((s) => {
                if (s.rowId !== rowId) return s;
                const detected = detectSocialPlatformFromUrl(url);
                return {
                    ...s,
                    url,
                    platform: detected ?? s.platform,
                };
            }),
        );
    }, []);

    const bioBorder =
        focusedField === 'bio' ? ACCENT : 'rgba(168,85,247,0.28)';

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={s.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
                <GlassWrapper {...(glassProps.modal as any)} style={StyleSheet.absoluteFill} />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={s.kav}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <View style={s.sheet}>
                        <GlassWrapper {...(glassProps.modal as any)} style={StyleSheet.absoluteFill} />
                        <LinearGradient
                            colors={[ACCENT, ACCENT_DARK, 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={s.topAccent}
                        />

                        <View style={[s.header, isRTL && s.rowRtl]}>
                            <Text style={[s.title, isRTL && s.textRtl]}>
                                {t.profile.editProfileTitle}
                            </Text>
                            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                                <Ionicons name="close" size={18} color="rgba(255,255,255,0.85)" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={s.scroll}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={s.field}>
                                <Text style={[s.label, isRTL && s.textRtl]}>{t.profile.bioLabel}</Text>
                                <View style={[s.inputWrap, s.textAreaWrap, { borderColor: bioBorder }]}>
                                    <GlassWrapper {...(glassProps.card as any)} style={StyleSheet.absoluteFill} />
                                    <TextInput
                                        ref={bioInputRef}
                                        style={[s.input, s.textArea, isRTL && s.textRtl]}
                                        value={bio}
                                        onChangeText={setBio}
                                        placeholder={t.profile.bioPlaceholder}
                                        placeholderTextColor="rgba(255,255,255,0.3)"
                                        multiline
                                        maxLength={500}
                                        blurOnSubmit
                                        onFocus={() => setFocusedField('bio')}
                                        onBlur={() => setFocusedField(null)}
                                    />
                                </View>
                                <Text
                                    style={[
                                        s.charCount,
                                        isRTL && s.textRtl,
                                        bio.length >= 450 && { color: ProfileTheme.colors.avatarRing },
                                    ]}
                                >
                                    {bio.length}/500
                                </Text>
                            </View>

                            <View style={s.field}>
                                <View style={[s.sectionHeader, isRTL && s.rowRtl]}>
                                    <Text style={[s.label, s.labelInline, isRTL && s.textRtl]}>
                                        {t.profile.socialLinks}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={handleAddSocial}
                                        activeOpacity={0.85}
                                        style={s.addBtn}
                                    >
                                        <GlassWrapper
                                            {...(glassProps.chip as any)}
                                            style={StyleSheet.absoluteFill}
                                        />
                                        <View style={s.addBtnInner}>
                                            <Ionicons
                                                name="add"
                                                size={13}
                                                color={ProfileTheme.colors.avatarRing}
                                            />
                                            <Text style={s.addBtnTxt}>{t.profile.addSocialAction}</Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                {socials.map((social) => {
                                    const platform = SOCIAL_PLATFORMS.find((p) => p.id === social.platform);
                                    const IconComp =
                                        platform?.iconLibrary === 'FontAwesome' ? FontAwesome : Ionicons;
                                    return (
                                        <View key={social.rowId} style={s.socialRow}>
                                            <View style={s.socialWrap}>
                                                <GlassWrapper
                                                    {...(glassProps.card as any)}
                                                    style={StyleSheet.absoluteFill}
                                                />
                                                <TouchableOpacity
                                                    style={s.platformBtn}
                                                    onPress={() => {
                                                        const ci = SOCIAL_PLATFORMS.findIndex(
                                                            (p) => p.id === social.platform,
                                                        );
                                                        updateSocial(
                                                            social.rowId,
                                                            'platform',
                                                            SOCIAL_PLATFORMS[
                                                                (ci + 1) % SOCIAL_PLATFORMS.length
                                                            ].id,
                                                        );
                                                    }}
                                                >
                                                    {platform ? (
                                                        <IconComp
                                                            name={platform.icon as any}
                                                            size={17}
                                                            color={platform.color}
                                                        />
                                                    ) : null}
                                                </TouchableOpacity>
                                                <TextInput
                                                    style={s.socialInput}
                                                    value={social.url}
                                                    onChangeText={(url) =>
                                                        handleSocialUrlChange(social.rowId, url)
                                                    }
                                                    placeholder={t.profile.socialUrlPlaceholder}
                                                    placeholderTextColor="rgba(255,255,255,0.28)"
                                                    autoCapitalize="none"
                                                    keyboardType="url"
                                                />
                                                <TouchableOpacity
                                                    onPress={() => handleRemoveSocial(social.rowId)}
                                                    style={s.removeBtn}
                                                >
                                                    <Ionicons
                                                        name="trash-outline"
                                                        size={15}
                                                        color="#ef4444"
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>

                            <View style={{ height: 16 }} />
                        </ScrollView>

                        <TouchableOpacity onPress={handleSave} activeOpacity={0.85} style={s.saveWrap}>
                            <LinearGradient
                                colors={[...AppGradients.purpleCTA]}
                                style={s.saveBtn}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <View style={s.saveGlass} pointerEvents="none" />
                                <Text style={s.saveTxt}>{t.profile.saveChanges}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
});

export default ProfileEditModal;

const s = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    kav: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: SURFACE_BG,
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        paddingHorizontal: 20,
        paddingTop: 16,
        maxHeight: '72%',
        minHeight: '48%',
        paddingBottom: Platform.OS === 'ios' ? 36 : 20,
        overflow: 'hidden',
        borderTopWidth: 1,
        borderColor: 'rgba(168,85,247,0.22)',
    },
    topAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(168,85,247,0.15)',
    },
    rowRtl: {
        flexDirection: 'row-reverse',
    },
    title: {
        fontSize: 17,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.2,
        flex: 1,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(139,92,246,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(139,92,246,0.28)',
    },
    scroll: {
        paddingBottom: 12,
    },
    field: {
        marginBottom: 18,
    },
    label: {
        color: 'rgba(216,174,255,0.7)',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    labelInline: {
        marginBottom: 0,
    },
    textRtl: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    inputWrap: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: 'hidden',
        backgroundColor: 'rgba(139,92,246,0.06)',
    },
    textAreaWrap: {},
    input: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    textArea: {
        minHeight: 110,
        textAlignVertical: 'top',
        paddingTop: 12,
    },
    charCount: {
        color: 'rgba(255,255,255,0.32)',
        fontSize: 11,
        marginTop: 5,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    addBtn: {
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(139,92,246,0.4)',
        backgroundColor: 'rgba(139,92,246,0.12)',
    },
    addBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        gap: 3,
    },
    addBtnTxt: {
        color: ProfileTheme.colors.avatarRing,
        fontSize: 11,
        fontWeight: '700',
    },
    socialRow: {
        marginBottom: 8,
    },
    socialWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(168,85,247,0.22)',
        overflow: 'hidden',
        backgroundColor: 'rgba(139,92,246,0.05)',
        paddingVertical: 2,
    },
    platformBtn: {
        width: 42,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1,
        borderRightColor: 'rgba(168,85,247,0.15)',
    },
    socialInput: {
        flex: 1,
        color: '#fff',
        paddingHorizontal: 12,
        fontSize: 13,
    },
    removeBtn: {
        padding: 10,
    },
    saveWrap: {
        marginTop: 4,
        alignSelf: 'center',
        width: '88%',
    },
    saveBtn: {
        height: 46,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    saveGlass: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    saveTxt: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
});
