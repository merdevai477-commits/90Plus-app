import React, { useState, useCallback } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';

interface ReelUploadModalProps {
    visible: boolean;
    onClose: () => void;
    onUpload: (video: any) => void;
}

export default function ReelUploadModal({ visible, onClose, onUpload }: ReelUploadModalProps) {
    const { isSignedIn } = useAuth();
    const [videoAsset, setVideoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [caption, setCaption] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStage, setUploadStage] = useState<'idle' | 'preparing' | 'uploading' | 'done'>('idle');
    const uploadProgress = useSharedValue(0);

    // Prevent guest access
    if (!isSignedIn) {
        if (visible) {
            onClose();
            Alert.alert('تسجيل الدخول مطلوب', 'يجب تسجيل الدخول لرفع فيديو', [
                { text: 'تسجيل الدخول', onPress: () => router.replace('/auth') },
                { text: 'إلغاء', style: 'cancel' }
            ]);
        }
        return null;
    }

    const progressStyle = useAnimatedStyle(() => ({
        width: `${uploadProgress.value}%`,
    }));

    const pickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true, // Allows trimming in some OS
            quality: 1,
            videoMaxDuration: 60,//tempt to limit via picker if supported
        });

        if (!result.canceled) {
            const asset = result.assets[0];

            // Validation Logic
            if (asset.duration) {
                if (asset.duration < 10000) { // < 10 seconds
                    Alert.alert('فيديو قصير جداً', 'يجب أن تكون مدة الفيديو 10 ثوانٍ على الأقل.');
                    return;
                }
                if (asset.duration > 60000) { // > 30 seconds
                    Alert.alert('فيديو طويل', 'يجب أن لا تتجاوز مدة الفيديو 60 ثانية.');
                    return;
                }
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
            // Generate thumbnail from video first frame
            const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(
                videoAsset.uri,
                {
                    time: 1000, // 1 second in
                    quality: 0.7,
                }
            );

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
                                <Text style={styles.uploadSubText}>(10-60 ثانية)</Text>
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
