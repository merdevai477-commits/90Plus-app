import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { extractDurationFromUrl } from '../../utils/videoDuration';
import { toastManager } from '../../services/toastManager';
import { usePhotoPermission } from '../../hooks/usePhotoPermission';
import { logger } from '../../utils/logger';
import { useReelDraft } from '../../hooks/useReelDraft';
import { useLanguage } from '../../contexts/LanguageContext';

interface ReelUploadModalProps {
    visible: boolean;
    onClose: () => void;
    onUpload: (video: any) => void;
    canUploadVideo?: boolean;
    missingRequiredSteps?: string[];
    onPickerOpen?: () => void;
    onPickerClose?: () => void;
    /** رفع ساري من الشاشة الرئيسية — يمنع اختيار/نشر فيديو آخر */
    uploadLocked?: boolean;
}

export default function ReelUploadModal({
    visible,
    onClose,
    onUpload,
    canUploadVideo = true,
    missingRequiredSteps = [],
    onPickerOpen,
    onPickerClose,
    uploadLocked = false,
}: ReelUploadModalProps) {
    const { isSignedIn } = useAuth();
    const { t } = useLanguage();
    const [videoAsset, setVideoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [caption, setCaption] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStage, setUploadStage] = useState<'idle' | 'preparing' | 'uploading' | 'done'>('idle');
    const uploadProgress = useSharedValue(0);
    const { permissionState, requestLibraryPermission } = usePhotoPermission();

    // Draft system
    const { draft, saveDraft, clearDraft, hasDraft, isOnline } = useReelDraft();

    const progressStyle = useAnimatedStyle(() => ({
        width: `${uploadProgress.value}%`,
    }));

    // Restore draft when modal opens
    useEffect(() => {
        if (visible && hasDraft && draft && !videoAsset) {
            Alert.alert(
                t.reels.uploadDraftTitle,
                t.reels.uploadDraftMessage,
                [
                    {
                        text: t.reels.uploadDraftDiscard,
                        style: 'destructive',
                        onPress: () => clearDraft(),
                    },
                    {
                        text: t.reels.uploadDraftRestore,
                        onPress: () => {
                            setCaption(draft.caption);
                            toastManager.showInfo(t.reels.uploadDraftRestoredTitle, t.reels.uploadDraftRestoredDetail);
                        },
                    },
                ]
            );
        }
    }, [visible]);

    // حفظ المسودة تلقائياً عند تغيير الـ caption
    useEffect(() => {
        if (!visible || !videoAsset) return;
        const timer = setTimeout(() => {
            saveDraft({
                videoUri: videoAsset.uri,
                caption,
                hashtags: [],
                mentions: [],
            });
        }, 1000);
        return () => clearTimeout(timer);
    }, [caption, videoAsset, visible]);

    // Check authentication and profile completion
    React.useEffect(() => {
        if (!visible) return;

        // Prevent guest access
        if (!isSignedIn) {
            onClose();
            toastManager.showAuthError();
            router.replace('/auth');
            return;
        }

        // Check profile completion before allowing upload
        if (!canUploadVideo) {
            onClose();
            toastManager.showWarning(
                t.reels.uploadProfileIncomplete,
                (t.reels.uploadProfileIncompleteDetail as string).replace('{steps}', missingRequiredSteps.join('\n• '))
            );
        }
    }, [visible, isSignedIn, canUploadVideo, missingRequiredSteps, onClose]);

    // Don't render if not signed in or can't upload
    if (!isSignedIn || !canUploadVideo) {
        return null;
    }

    // Feature 2: Generate 5 frame thumbnails from the video — REMOVED
    // Thumbnail upload removed; Mux auto-generates thumbnails from the video.

    const pickVideo = async () => {
        if (uploadLocked) {
            toastManager.showWarning(
                t.reels.uploadLockedToast,
                t.reels.uploadLockedToastDetail
            );
            return;
        }
        // Request media library permission (iOS + Android). If denied/blocked, hook will guide user to Settings.
        const hasPermission = await requestLibraryPermission();
        if (!hasPermission) return;
        // Informative hint for iOS "Limited" access (user can still pick, but may not see all items).
        if (permissionState.library === 'limited') {
            toastManager.showInfo(
                t.reels.uploadLimitedAccess,
                t.reels.uploadLimitedAccessDetail
            );
        }

        onPickerOpen?.();
        let result: ImagePicker.ImagePickerResult;
        try {
            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: true,
                quality: 1,
                videoMaxDuration: 60,
            });
        } finally {
            onPickerClose?.();
        }

        if (!result.canceled) {
            const asset = result.assets[0];

            // Extract duration using expo-av for accurate validation
            // This is required because ImagePicker.duration may not be reliable
            const duration = await extractDurationFromUrl(asset.uri);

            // File size validation — reject before wasting upload bandwidth
            const MAX_FILE_SIZE_MB = 50;
            if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_MB * 1024 * 1024) {
                toastManager.showWarning(
                    t.reels.uploadFileTooLarge,
                    (t.reels.uploadFileTooLargeDetail as string).replace('{max}', String(MAX_FILE_SIZE_MB))
                );
                return;
            }

            // Validation Logic - Requirements 2.6, 2.7, 2.8
            // Skip validation if duration is null (Expo Go / expo-av not available)
            if (duration === null) {
                // In Expo Go, we can't extract duration - allow upload anyway
                // Show warning but don't block
                toastManager.showWarning(
                    t.reels.uploadDurationWarning,
                    t.reels.uploadDurationWarningDetail
                );
                setVideoAsset(asset);
                return;
            }

            if (duration < 5) {
                toastManager.showWarning(
                    t.reels.uploadTooShort,
                    t.reels.uploadTooShortDetail
                );
                return;
            }

            if (duration > 60) {
                toastManager.showWarning(
                    t.reels.uploadTooLong,
                    t.reels.uploadTooLongDetail
                );
                return;
            }

            // Resolution check (Soft check, just warn or accept)
            if (asset.width > 1920 || asset.height > 1920) {
                // Might handle resizing logic here or backend, but for now we accept standard HD
            }

            setVideoAsset(asset);
            // Thumbnail generation removed — Mux auto-generates from video
        }
    };

    const handleUpload = async () => {
        if (!videoAsset) return;
        if (uploadLocked) {
            toastManager.showWarning(t.reels.uploadLockedToast, t.reels.uploadLockedPublishToast);
            return;
        }

        // Client-side hashtag validation (backend is source of truth)
        const hashtagMatches = caption.match(/#[\w\u0600-\u06FF]+/g) || [];
        if (hashtagMatches.length > 10) {
            toastManager.showWarning(t.reels.uploadHashtagTooMany, t.reels.uploadHashtagTooManyDetail);
            return;
        }
        const invalidHashtag = hashtagMatches.find((tag: string) => {
            const clean = tag.replace('#', '');
            return clean.length < 2 || clean.length > 30;
        });
        if (invalidHashtag) {
            toastManager.showWarning(t.reels.uploadHashtagLength, t.reels.uploadHashtagLengthDetail);
            return;
        }

        setIsUploading(true);
        setUploadStage('preparing');
        uploadProgress.value = withTiming(10, { duration: 300 });

        try {
            uploadProgress.value = withTiming(30, { duration: 300 });
            setUploadStage('uploading');

            const newVideo = {
                id: `temp_${Date.now()}`,
                uri: videoAsset.uri,
                caption: caption,
                likes: 0,
                views: 0,
                thumbnail: null,
                isUploading: true,
            };

            uploadProgress.value = withTiming(30, { duration: 200 });
            onUpload(newVideo);

            setIsUploading(false);
            setUploadStage('idle');
            uploadProgress.value = 0;
            setVideoAsset(null);
            setCaption('');
            await clearDraft();
            onClose();

        } catch (error) {
            // ✅ FIX: Do NOT call onUpload on error — this was creating ghost videos
            // that appear as perpetually uploading. Just show error and reset state.
            logger.error('[ReelUploadModal] Upload preparation failed:', error);
            toastManager.showError(t.reels.uploadFailed, t.reels.uploadFailedDetail);
            setIsUploading(false);
            setUploadStage('idle');
            uploadProgress.value = 0;
            await clearDraft();
            onClose();
        }
    };

    const getUploadStatusText = () => {
        switch (uploadStage) {
            case 'preparing': return t.reels.uploadPreparing;
            case 'uploading': return t.reels.uploadUploading;
            case 'done': return t.reels.uploadDone;
            default: return t.reels.uploadPublishNow;
        }
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

                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{t.reels.uploadTitle}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {uploadLocked && (
                        <View style={styles.lockedBanner}>
                            <ActivityIndicator size="small" color={ProfileTheme.colors.neonGreen} />
                            <Text style={styles.lockedBannerText}>
                                {t.reels.uploadLockedBanner}
                            </Text>
                        </View>
                    )}

                    {/* Video Preview / Picker */}
                    <TouchableOpacity
                        style={[styles.uploadArea, uploadLocked && styles.uploadAreaDisabled]}
                        onPress={pickVideo}
                        activeOpacity={uploadLocked ? 1 : 0.8}
                        disabled={uploadLocked}
                    >
                        {videoAsset ? (
                            <View style={styles.previewContainer}>
                                <Image
                                    source={{ uri: videoAsset.uri }} // Use video thumb if possible, or simple placeholder logic
                                    style={styles.videoPreview}
                                    contentFit="cover"
                                />
                                <View style={styles.changeOverlay}>
                                    <Text style={styles.changeText}>{t.reels.uploadChangeVideo}</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.placeholderContainer}>
                                <Ionicons name="cloud-upload-outline" size={48} color={ProfileTheme.colors.neonGreen} />
                                <Text style={styles.uploadText}>{t.reels.uploadPickVideo}</Text>
                                <Text style={styles.uploadSubText}>{t.reels.uploadDurationHint}</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Meta Fields */}
                    <TextInput
                        style={[styles.input, uploadLocked && styles.inputDisabled]}
                        placeholder={t.reels.uploadCaptionPlaceholder}
                        placeholderTextColor="#aaa"
                        value={caption}
                        onChangeText={setCaption}
                        multiline
                        maxLength={500}
                        editable={!uploadLocked}
                    />

                    {/* Progress Bar */}
                    {isUploading && (
                        <View style={styles.progressContainer}>
                            <Animated.View style={[styles.progressBar, progressStyle]} />
                        </View>
                    )}

                    {/* Submit Button */}
                    <TouchableOpacity
                        onPress={handleUpload}
                        disabled={!videoAsset || isUploading || uploadLocked || !isOnline}
                        style={{ opacity: !videoAsset || isUploading || uploadLocked || !isOnline ? 0.5 : 1 }}
                    >
                        <LinearGradient
                            colors={[ProfileTheme.colors.neonGreen, '#15803d']}
                            style={styles.submitButton}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {isUploading ? (
                                <View style={styles.uploadingContent}>
                                    <ActivityIndicator color="#FFF" size="small" />
                                    <Text style={styles.submitText}>{getUploadStatusText()}</Text>
                                </View>
                            ) : !isOnline ? (
                                <Text style={styles.submitText}>{t.reels.uploadNoConnection}</Text>
                            ) : (
                                <Text style={styles.submitText}>{t.reels.uploadPublishNow}</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                    {!isOnline && (
                        <Text style={{ color: '#f87171', textAlign: 'center', marginTop: 8, fontSize: 12 }}>
                            {t.reels.uploadOfflineHint}
                        </Text>
                    )}
                </View>
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
    content: {
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        minHeight: '60%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
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
    uploadArea: {
        height: 200,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderStyle: 'dashed',
        marginBottom: 20,
        overflow: 'hidden',
    },
    placeholderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    uploadText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    uploadSubText: {
        color: '#888',
        fontSize: 12,
    },
    previewContainer: {
        flex: 1,
        position: 'relative',
    },
    videoPreview: {
        width: '100%',
        height: '100%',
    },
    changeOverlay: {
        position: 'absolute',
        bottom: 10,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    changeText: {
        color: '#FFF',
        fontSize: 12,
    },
    input: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 12,
        padding: 16,
        color: '#FFF',
        fontSize: 16,
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: 24,
    },
    submitButton: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    progressContainer: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 2,
        marginBottom: 16,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: ProfileTheme.colors.neonGreen,
        borderRadius: 2,
    },
    uploadingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    lockedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(34,197,94,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.35)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    lockedBannerText: {
        flex: 1,
        color: '#E8FFE8',
        fontSize: 13,
        lineHeight: 18,
    },
    uploadAreaDisabled: {
        opacity: 0.45,
    },
    inputDisabled: {
        opacity: 0.5,
    },
    // UX Fix 8 + Feature 2: Thumbnail styles
    thumbnailSection: {
        marginBottom: 16,
    },
    thumbnailLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
    },
    framesLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    framesLoadingText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    framesRow: {
        flexDirection: 'row',
    },
    frameThumb: {
        width: 60,
        height: 100,
        borderRadius: 8,
        marginRight: 8,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.15)',
        position: 'relative',
    },
    frameThumbSelected: {
        borderColor: '#FFD700',
        borderWidth: 2,
    },
    frameThumbImage: {
        width: '100%',
        height: '100%',
    },
    frameSelectedOverlay: {
        position: 'absolute',
        top: 4,
        right: 4,
    },
    frameThumbGallery: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        gap: 4,
    },
    frameGalleryText: {
        color: ProfileTheme.colors.neonGreen,
        fontSize: 10,
        fontWeight: '600',
    },
    frameThumbRemove: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,59,48,0.1)',
        borderColor: 'rgba(255,59,48,0.3)',
        gap: 4,
    },
    frameRemoveText: {
        color: '#FF3B30',
        fontSize: 10,
        fontWeight: '600',
    },
    thumbnailAutoText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontStyle: 'italic',
        paddingVertical: 8,
    },
});
