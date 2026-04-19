import React, { useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    TextInput,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { X, ShieldOff, Flag, AlertTriangle } from 'lucide-react-native';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import { useAuth } from '@clerk/clerk-expo';
import { getApiUrl } from '../../config/api.config';
import * as Haptics from 'expo-haptics';

const API_URL = getApiUrl();

interface BlockReportModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
    username: string;
    onBlockSuccess?: () => void;
}

const REPORT_REASONS = [
    { id: 'spam', label: 'سبام / محتوى مزعج', labelEn: 'Spam' },
    { id: 'harassment', label: 'تحرش / إساءة', labelEn: 'Harassment' },
    { id: 'inappropriate', label: 'محتوى غير لائق', labelEn: 'Inappropriate content' },
    { id: 'fake', label: 'حساب مزيف', labelEn: 'Fake account' },
    { id: 'other', label: 'سبب آخر', labelEn: 'Other' },
];

export default function BlockReportModal({
    visible,
    onClose,
    userId,
    username,
    onBlockSuccess,
}: BlockReportModalProps) {
    const [mode, setMode] = useState<'menu' | 'report'>('menu');
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [additionalInfo, setAdditionalInfo] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { getToken } = useAuth();
    const { t } = useTranslation();

    const handleBlock = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
            t.profile.blockUser,
            `${t.profile.blockConfirm} @${username}?`,
            [
                { text: t.common.cancel, style: 'cancel' },
                {
                    text: t.profile.block,
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            const token = await getToken();
                            if (token) {
                                const response = await fetch(`${API_URL}/users/block/${userId}`, {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': `Bearer ${token}`,
                                        'Content-Type': 'application/json',
                                    },
                                });
                                const data = await response.json();
                                if (data.status === 'SUCCESS') {
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                    Alert.alert(t.common.success, t.profile.userBlocked);
                                    onBlockSuccess?.();
                                    onClose();
                                } else {
                                    Alert.alert(t.common.error, data.message || t.common.errorOccurred);
                                }
                            }
                        } catch (error) {
                            console.error('Error blocking user:', error);
                            Alert.alert(t.common.error, t.common.errorOccurred);
                        }
                        setIsLoading(false);
                    },
                },
            ]
        );
    };

    const handleReport = async () => {
        if (!selectedReason) {
            Alert.alert(t.common.error, t.profile.selectReason);
            return;
        }

        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const token = await getToken();
            if (token) {
                const response = await fetch(`${API_URL}/users/report/${userId}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        reason: selectedReason,
                        additionalInfo: additionalInfo.trim() || undefined,
                    }),
                });
                const data = await response.json();
                if (data.status === 'SUCCESS') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert(t.common.success, t.profile.reportSent);
                    onClose();
                } else {
                    Alert.alert(t.common.error, data.message || t.common.errorOccurred);
                }
            }
        } catch (error) {
            console.error('Error reporting user:', error);
            Alert.alert(t.common.error, t.common.errorOccurred);
        }
        setIsLoading(false);
    };

    const resetAndClose = () => {
        setMode('menu');
        setSelectedReason(null);
        setAdditionalInfo('');
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={resetAndClose} style={styles.closeButton}>
                            <X size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.title}>@{username}</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {mode === 'menu' ? (
                        <View style={styles.menuContainer}>
                            {/* Block Option */}
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={handleBlock}
                                disabled={isLoading}
                            >
                                <View style={[styles.menuIcon, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
                                    <ShieldOff size={24} color="#ef4444" />
                                </View>
                                <View style={styles.menuTextContainer}>
                                    <Text style={styles.menuTitle}>{t.profile.blockUser}</Text>
                                    <Text style={styles.menuDesc}>{t.profile.blockDesc}</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Report Option */}
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => setMode('report')}
                            >
                                <View style={[styles.menuIcon, { backgroundColor: 'rgba(245,158,11,0.2)' }]}>
                                    <Flag size={24} color="#f59e0b" />
                                </View>
                                <View style={styles.menuTextContainer}>
                                    <Text style={styles.menuTitle}>{t.profile.reportUser}</Text>
                                    <Text style={styles.menuDesc}>{t.profile.reportDesc}</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.reportContainer}>
                            <View style={styles.warningBanner}>
                                <AlertTriangle size={20} color="#f59e0b" />
                                <Text style={styles.warningText}>{t.profile.reportWarning}</Text>
                            </View>

                            <Text style={styles.sectionTitle}>{t.profile.selectReason}</Text>

                            {REPORT_REASONS.map((reason) => (
                                <TouchableOpacity
                                    key={reason.id}
                                    style={[
                                        styles.reasonItem,
                                        selectedReason === reason.id && styles.reasonSelected,
                                    ]}
                                    onPress={() => setSelectedReason(reason.id)}
                                >
                                    <View style={[
                                        styles.radioOuter,
                                        selectedReason === reason.id && styles.radioOuterSelected,
                                    ]}>
                                        {selectedReason === reason.id && <View style={styles.radioInner} />}
                                    </View>
                                    <Text style={styles.reasonText}>{reason.label}</Text>
                                </TouchableOpacity>
                            ))}

                            <TextInput
                                style={styles.additionalInput}
                                placeholder={t.profile.additionalInfo}
                                placeholderTextColor="rgba(255,255,255,0.4)"
                                value={additionalInfo}
                                onChangeText={setAdditionalInfo}
                                multiline
                                maxLength={500}
                            />

                            <TouchableOpacity
                                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                                onPress={handleReport}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <Text style={styles.submitText}>{t.profile.sendReport}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: ProfileTheme.colors.deepBlack,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    menuContainer: {
        padding: 16,
        gap: 12,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        gap: 16,
    },
    menuIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuTextContainer: {
        flex: 1,
    },
    menuTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    menuDesc: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
    },
    reportContainer: {
        padding: 16,
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245,158,11,0.1)',
        borderRadius: 12,
        padding: 12,
        gap: 10,
        marginBottom: 20,
    },
    warningText: {
        flex: 1,
        fontSize: 13,
        color: '#f59e0b',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
        textAlign: 'right',
    },
    reasonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: 'rgba(255,255,255,0.03)',
        gap: 12,
    },
    reasonSelected: {
        backgroundColor: 'rgba(245,158,11,0.1)',
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterSelected: {
        borderColor: '#f59e0b',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#f59e0b',
    },
    reasonText: {
        fontSize: 14,
        color: '#fff',
    },
    additionalInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 14,
        color: '#fff',
        fontSize: 14,
        minHeight: 80,
        textAlignVertical: 'top',
        marginTop: 12,
        marginBottom: 16,
    },
    submitButton: {
        backgroundColor: '#f59e0b',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
});
