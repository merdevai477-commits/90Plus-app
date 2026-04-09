import React, { useState, useCallback } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
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

interface ReelUploadModalProps {
    visible: boolean;
    onClose: () => void;
    onUpload: (video: any) => void;
    canUploadVideo?: boolean;
    missingRequiredSteps?: string[];
    onPickerOpen?: () => void;
    onPickerClose?: () => void;
}

export default function ReelUploadModal({ visible, onClose, onUpload, canUploadVideo = true, missingRequiredSteps = [], onPickerOpen, onPickerClose }: ReelUploadModalProps) {
    const { isSignedIn } = useAuth();
    const [videoAsset, setVideoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [caption, setCaption] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStage, setUploadStage] = useState<'idle' | 'preparing' | 'uploading' | 'done'>('idle');
    const uploadProgress = useSharedValue(0);
    const { permissionState, requestLibraryPermission } = usePhotoPermission();

    const progressStyle = useAnimatedStyle(() => ({
        width: `${uploadProgress.value}%`,
    }));

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
                'أكمل بروفايلك أولاً',
                `يجب إكمال 3 خطوات على الأقل لرفع الفيديوهات:\n\n• ${missingRequiredSteps.join('\n• ')}`
            );
        }
    }, [visible, isSignedIn, canUploadVideo, missingRequiredSteps, onClose]);

    // Don't render if not signed in or can't upload
    if (!isSignedIn || !canUploadVideo) {
        return null;
    }

    const pickVideo = async () => {
        // Request media library permission (iOS + Android). If denied/blocked, hook will guide user to Settings.
        const hasPermission = await requestLibraryPermission();
        if (!hasPermission) return;
        // Informative hint for iOS "Limited" access (user can still pick, but may not see all items).
        if (permissionState.library === 'limited') {
            toastManager.showInfo(
                'وصول محدود للمعرض',
                'يمكنك اختيار فيديو، لكن قد لا تظهر كل العناصر. يمكنك توسيع الوصول من الإعدادات.'
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

            // Validation Logic - Requirements 2.6, 2.7, 2.8
            // Skip validation if duration is null (Expo Go / expo-av not available)
            if (duration === null) {
                // In Expo Go, we can't extract duration - allow upload anyway
                // Show warning but don't block
                toastManager.showWarning(
                    'تنبيه',
                    'لا يمكن التحقق من مدة الفيديو في Expo Go. تأكد أن الفيديو بين 5-60 ثانية.'
                );
                setVideoAsset(asset);
                return;
            }

            if (duration < 5) {
                toastManager.showWarning(
                    'فيديو قصير جداً',
                    'يجب أن تكون مدة الفيديو 5 ثوانٍ على الأقل.'
                );
                return;
            }

            if (duration > 60) {
                toastManager.showWarning(
                    'فيديو طويل جداً',
                    'يجب أن لا تتجاوز مدة الفيديو 60 ثانية.'
                );
                return;
            }

            // Resolution check (Soft check, just warn or accept)
            if (asset.width > 1920 || asset.height > 1920) {
                // Might handle resizing logic here or backend, but for now we accept standard HD
            }

            setVideoAsset(asset);
        }
    };

    const handleUpload = async () => {
        if (!videoAsset) return;

        setIsUploading(true);
        setUploadStage('preparing');
        uploadProgress.value = withTiming(10, { duration: 300 });

        try {
            // ✅ SDK 52: Thumbnail generation disabled (expo-video-thumbnails deprecated)
            // Use a placeholder or skip thumbnail for now
            const thumbnailUri = null; // TODO: Re-enable with expo-video later

            uploadProgress.value = withTiming(30, { duration: 300 });
            setUploadStage('uploading');

            // Create video object immediately for optimistic update
            const newVideo = {
                id: `temp_${Date.now()}`,
                uri: videoAsset.uri,
                caption: caption,
                likes: 0,
                views: 0,
                thumbnail: thumbnailUri,
                isUploading: true, // Flag for UI to show uploading state
            };

            // Close modal and show video immediately (optimistic)
            // The actual upload will happen in parent component with proper progress tracking
            uploadProgress.value = withTiming(30, { duration: 200 });
            
            // Pass to parent - parent will handle actual upload
            onUpload(newVideo);
            
            // Reset state immediately after passing to parent
            setIsUploading(false);
            setUploadStage('idle');
            uploadProgress.value = 0;
            setVideoAsset(null);
            setCaption('');
            onClose();

        } catch (error) {
            console.error('Error generating thumbnail:', error);
            // Fallback - still upload without thumbnail
            const newVideo = {
                id: `temp_${Date.now()}`,
                uri: videoAsset.uri,
                caption: caption,
                likes: 0,
                views: 0,
                thumbnail: videoAsset.uri,
                isUploading: true,
            };

            onUpload(newVideo);
            setIsUploading(false);
            setUploadStage('idle');
            uploadProgress.value = 0;
            setVideoAsset(null);
            setCaption('');
            onClose();
        }
    };

    const getUploadStatusText = () => {
        switch (uploadStage) {
            case 'preparing': return 'جاري التحضير...';
            case 'uploading': return 'جاري الرفع...';
            case 'done': return 'تم! ✓';
            default: return 'نشر الآن';
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
                        <Text style={styles.title}>رفع ريلز جديد 🎥</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Video Preview / Picker */}
                    <TouchableOpacity
                        style={styles.uploadArea}
                        onPress={pickVideo}
                        activeOpacity={0.8}
                    >
                        {videoAsset ? (
                            <View style={styles.previewContainer}>
                                <Image
                                    source={{ uri: videoAsset.uri }} // Use video thumb if possible, or simple placeholder logic
                                    style={styles.videoPreview}
                                    contentFit="cover"
                                />
                                <View style={styles.changeOverlay}>
                                    <Text style={styles.changeText}>تغيير الفيديو</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.placeholderContainer}>
                                <Ionicons name="cloud-upload-outline" size={48} color={ProfileTheme.colors.neonGreen} />
                                <Text style={styles.uploadText}>اختر فيديو من الاستوديو</Text>
                                <Text style={styles.uploadSubText}>(5-60 ثانية)</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Meta Fields */}
                    <TextInput
                        style={styles.input}
                        placeholder="اكتب وصفاً للفيديو... #هاشتاج"
                        placeholderTextColor="#aaa"
                        value={caption}
                        onChangeText={setCaption}
                        multiline
                        maxLength={100}
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
                        disabled={!videoAsset || isUploading}
                        style={{ opacity: (!videoAsset || isUploading) ? 0.5 : 1 }}
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
                            ) : (
                                <Text style={styles.submitText}>نشر الآن</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
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
});
