# 🔧 إصلاح مشاكل رفع الصور والفيديوهات

## المشاكل المكتشفة

### المشكلة 1: خطأ 500 في رفع صورة البروفايل ❌
**الأعراض:**
- عند رفع صورة البروفايل، يظهر خطأ 500
- الصورة لا تُرفع بنجاح

**السبب:**
1. مشكلة في middleware التحقق من الصورة
2. مشكلة في buffer الصورة
3. مشكلة في Supabase/R2 Storage configuration
4. عدم وجود error handling كافي

### المشكلة 2: رفع الفيديو بطيء وبدون progress indicator ❌
**الأعراض:**
- رفع الفيديو يأخذ وقت طويل
- لا يظهر progress bar أثناء الرفع
- الفيديو لا يظهر فوراً في البروفايل
- الفيديو لا يظهر للمستخدمين الآخرين

**السبب:**
1. Progress tracking لا يعمل بشكل صحيح
2. عدم وجود real-time updates بعد الرفع
3. Cache لا يتم تحديثه بعد رفع الفيديو
4. الفيديو يحتاج refresh manual

## الحلول

### الحل 1: إصلاح رفع صورة البروفايل ✅

#### 1.1 تحسين Error Handling في Backend
```typescript
// Backend/src/routes/upload.routes.ts

router.post('/avatar', requireAuth, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            res.status(401).json({ status: 'ERROR', message: 'Unauthorized' });
            return;
        }

        const file = req.file;
        if (!file) {
            logger.error('No file received in avatar upload request');
            res.status(400).json({ status: 'ERROR', message: 'No file provided' });
            return;
        }

        // ✅ تحسين: التحقق من file buffer
        if (!file.buffer || file.buffer.length === 0) {
            logger.error('File buffer is missing or empty');
            res.status(400).json({ status: 'ERROR', message: 'File is empty or corrupted' });
            return;
        }

        // ✅ تحسين: التحقق من نوع الملف
        if (!file.mimetype || !file.mimetype.startsWith('image/')) {
            logger.error(`Invalid file type: ${file.mimetype}`);
            res.status(400).json({ status: 'ERROR', message: 'Invalid file type. Only images are allowed.' });
            return;
        }

        // ✅ تحسين: التحقق من حجم الملف
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.buffer.length > maxSize) {
            logger.error(`File too large: ${file.buffer.length} bytes`);
            res.status(413).json({ status: 'ERROR', message: 'File is too large. Maximum size is 10MB.' });
            return;
        }

        logger.info(`Uploading avatar: ${file.originalname}, size: ${file.buffer.length} bytes, type: ${file.mimetype}`);

        // ... rest of the code
    } catch (error: any) {
        logger.error('Upload avatar error:', error);
        res.status(500).json({ 
            status: 'ERROR', 
            message: error.message || 'Failed to upload avatar',
            code: 'UPLOAD_ERROR'
        });
    }
});
```

#### 1.2 تحسين Frontend Upload Hook
```typescript
// front/hooks/useImageUpload.ts

// ✅ إضافة better error messages
const upload = useCallback(
    async (uri: string, options: UploadOptions): Promise<UploadResult> => {
        try {
            setIsUploading(true);
            setProgress(0);
            setError(null);

            // ✅ التحقق من URI
            if (!uri) {
                throw new Error(isRTL ? 'لم يتم اختيار صورة' : 'No image selected');
            }

            // ✅ التحقق من حجم الملف قبل الرفع
            const fileInfo = await FileSystem.getInfoAsync(uri);
            if (fileInfo.exists && fileInfo.size > 10 * 1024 * 1024) {
                throw new Error(isRTL ? 'حجم الصورة كبير جداً (الحد الأقصى 10 ميجابايت)' : 'Image is too large (max 10MB)');
            }

            // ... rest of the code
        } catch (error: any) {
            logger.error('Upload error:', error);
            const errorMessage = error.message || (isRTL ? 'فشل رفع الصورة' : 'Failed to upload image');
            setError(errorMessage);
            
            // ✅ عرض رسالة خطأ واضحة للمستخدم
            Alert.alert(
                isRTL ? 'خطأ في الرفع' : 'Upload Error',
                errorMessage,
                [{ text: isRTL ? 'حسناً' : 'OK' }]
            );

            return {
                success: false,
                error: errorMessage,
            };
        }
    },
    [getToken, isRTL]
);
```

### الحل 2: إصلاح رفع الفيديو وإضافة Progress Indicator ✅

#### 2.1 تحسين Progress Tracking في Frontend
```typescript
// front/src/services/storageService.ts

static async uploadReel(
    token: string, 
    videoUri: string, 
    thumbnailUri?: string,
    caption?: string,
    hashtags?: string[],
    mentions?: string[],
    onProgress?: (progress: number) => void
): Promise<UploadResult & { reelId?: string }> {
    try {
        // ✅ إضافة: عرض "جاري التحضير..." في البداية
        if (onProgress) onProgress(5);

        const formData = new FormData();
        
        // ✅ إضافة: عرض "جاري ضغط الفيديو..." 
        if (onProgress) onProgress(10);
        
        // Add video
        const videoFilename = videoUri.split('/').pop() || 'reel.mp4';
        formData.append('video', {
            uri: videoUri,
            name: videoFilename,
            type: 'video/mp4',
        } as any);

        // ✅ إضافة: عرض "جاري الرفع..." 
        if (onProgress) onProgress(15);

        // Add thumbnail if provided
        if (thumbnailUri) {
            const thumbFilename = thumbnailUri.split('/').pop() || 'thumb.jpg';
            formData.append('thumbnail', {
                uri: thumbnailUri,
                name: thumbFilename,
                type: 'image/jpeg',
            } as any);
        }

        // Add metadata
        if (caption) formData.append('caption', caption);
        if (hashtags) formData.append('hashtags', JSON.stringify(hashtags));
        if (mentions) formData.append('mentions', JSON.stringify(mentions));

        // ✅ إضافة: عرض "جاري الرفع..." 
        if (onProgress) onProgress(20);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // ✅ تحسين: Progress tracking أفضل
            const progressHandler = (event: ProgressEvent) => {
                if (event.lengthComputable && onProgress) {
                    // 20% للتحضير، 70% للرفع، 10% للمعالجة
                    const uploadProgress = 20 + (event.loaded / event.total) * 70;
                    const progressValue = Math.min(Math.round(uploadProgress), 90);
                    onProgress(progressValue);
                    
                    // ✅ إضافة: log للتتبع
                    logger.info(`Upload progress: ${progressValue}% (${event.loaded}/${event.total} bytes)`);
                }
            };
            
            const loadHandler = () => {
                cleanup();
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        // ✅ إضافة: عرض "جاري المعالجة..." 
                        if (onProgress) onProgress(95);
                        
                        const data = JSON.parse(xhr.responseText);
                        
                        logger.info('Upload reel response:', JSON.stringify(data));
                        
                        if (data.status === 'SUCCESS') {
                            const videoUrl = data.data?.videoUrl || data.data?.url || data.url;
                            const storagePath = data.data?.storagePath || data.data?.path || data.storagePath;
                            const reelId = data.data?.reelId || data.reelId;
                            
                            if (!videoUrl) {
                                logger.error('No video URL in response:', data);
                                resolve({ success: false, error: 'No video URL returned from server' });
                                return;
                            }
                            
                            logger.info('Reel uploaded successfully:', { videoUrl, reelId });
                            
                            // ✅ إضافة: عرض "تم الرفع بنجاح!" 
                            if (onProgress) onProgress(100);
                            
                            resolve({
                                success: true,
                                url: videoUrl,
                                storagePath: storagePath,
                                reelId: reelId,
                            });
                        } else {
                            resolve({ success: false, error: data.message || 'Upload failed' });
                        }
                    } catch (parseError) {
                        logger.error('Failed to parse upload response:', parseError);
                        resolve({ success: false, error: 'Invalid response from server' });
                    }
                } else {
                    let errorData;
                    try {
                        errorData = JSON.parse(xhr.responseText);
                    } catch {
                        errorData = { message: xhr.responseText || `Upload failed: ${xhr.status}` };
                    }
                    logger.error('Upload reel failed:', xhr.status, errorData);
                    resolve({ success: false, error: errorData.message || `Upload failed: ${xhr.status}` });
                }
            };
            
            // ... rest of the code
        });
    } catch (error: any) {
        logger.error('Upload reel error:', error);
        return { success: false, error: error.message };
    }
}
```

#### 2.2 إضافة Progress Modal في Frontend
```typescript
// front/components/common/UploadProgressModal.tsx

import React from 'react';
import { View, Text, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface UploadProgressModalProps {
    visible: boolean;
    progress: number;
    message?: string;
}

export const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
    visible,
    progress,
    message = 'جاري الرفع...'
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <ActivityIndicator size="large" color="#00ff00" />
                    <Text style={styles.message}>{message}</Text>
                    
                    {/* Progress Bar */}
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${progress}%` }]} />
                    </View>
                    
                    <Text style={styles.percentage}>{Math.round(progress)}%</Text>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        minWidth: 250,
    },
    message: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 20,
    },
    progressBarContainer: {
        width: '100%',
        height: 8,
        backgroundColor: '#333',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#00ff00',
        borderRadius: 4,
    },
    percentage: {
        color: '#00ff00',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 15,
    },
});
```

#### 2.3 تحديث Profile Screen لاستخدام Progress Modal
```typescript
// front/app/(tabs)/profile.tsx

import { UploadProgressModal } from '../../components/common/UploadProgressModal';

// ... في الكومبوننت

const [uploadProgress, setUploadProgress] = useState(0);
const [isUploading, setIsUploading] = useState(false);
const [uploadMessage, setUploadMessage] = useState('جاري الرفع...');

const handleUploadVideo = async (newVideo: any) => {
    try {
        setIsUploading(true);
        setUploadProgress(0);
        setUploadMessage('جاري التحضير...');

        const token = await getToken();
        if (!token) {
            Alert.alert('خطأ', 'يجب تسجيل الدخول');
            return;
        }

        // Extract hashtags and mentions
        const caption = newVideo.caption || '';
        const hashtags = caption.match(/#[\w]+/g) || [];
        const mentions = caption.match(/@[\w]+/g) || [];

        // ✅ إضافة: Progress callback
        const uploadResult = await StorageService.uploadReel(
            token,
            newVideo.uri,
            newVideo.thumbnail,
            caption,
            hashtags,
            mentions,
            (progress) => {
                setUploadProgress(progress);
                
                // ✅ تحديث الرسالة حسب التقدم
                if (progress < 20) {
                    setUploadMessage('جاري التحضير...');
                } else if (progress < 90) {
                    setUploadMessage('جاري الرفع...');
                } else if (progress < 100) {
                    setUploadMessage('جاري المعالجة...');
                } else {
                    setUploadMessage('تم الرفع بنجاح!');
                }
            }
        );

        if (uploadResult.success && uploadResult.url && uploadResult.reelId) {
            // ✅ إضافة الفيديو للقائمة فوراً
            const newReel = {
                id: uploadResult.reelId,
                videoUrl: uploadResult.url,
                thumbnail: newVideo.thumbnail,
                caption: caption,
                likes: 0,
                comments: 0,
                shares: 0,
                views: 0,
                createdAt: new Date().toISOString(),
                user: {
                    id: userProfile?.id,
                    username: userProfile?.username,
                    avatar: userProfile?.avatar,
                },
            };

            // ✅ تحديث القائمة فوراً
            addVideo(newReel);
            setUserVideoData(prev => [newReel, ...prev]);

            // ✅ إعادة تحميل البيانات من السيرفر
            await loadUserVideos();

            Alert.alert('نجح', 'تم رفع الفيديو بنجاح');
        } else {
            Alert.alert('خطأ', uploadResult.error || 'فشل رفع الفيديو');
        }
    } catch (error: any) {
        logger.error('Upload video error:', error);
        Alert.alert('خطأ', error.message || 'فشل رفع الفيديو');
    } finally {
        setIsUploading(false);
        setUploadProgress(0);
    }
};

// ... في الـ JSX

return (
    <View style={styles.container}>
        {/* ... باقي الكود */}
        
        {/* ✅ إضافة Progress Modal */}
        <UploadProgressModal
            visible={isUploading}
            progress={uploadProgress}
            message={uploadMessage}
        />
    </View>
);
```

#### 2.4 تحديث Reels Feed لعرض الفيديوهات الجديدة
```typescript
// front/app/(tabs)/reels.tsx

// ✅ إضافة: Auto-refresh عند العودة للشاشة
useFocusEffect(
    useCallback(() => {
        // Reload reels when screen comes into focus
        loadReels();
    }, [])
);

// ✅ إضافة: WebSocket للتحديثات الفورية
useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/reels`);
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_REEL') {
            // إضافة الفيديو الجديد للقائمة
            setReels(prev => [data.reel, ...prev]);
        }
    };
    
    return () => ws.close();
}, []);
```

## خطوات التنفيذ

### المرحلة 1: إصلاح رفع الصور ✅
1. [x] تحسين error handling في Backend
2. [x] إضافة validation أفضل
3. [x] تحسين error messages في Frontend
4. [ ] اختبار رفع الصور

### المرحلة 2: إصلاح رفع الفيديوهات ✅
1. [x] تحسين progress tracking
2. [x] إضافة progress modal
3. [x] تحديث UI لعرض التقدم
4. [ ] اختبار رفع الفيديوهات

### المرحلة 3: تحسين Real-time Updates ✅
1. [x] إضافة auto-refresh عند العودة للشاشة
2. [x] إضافة optimistic updates
3. [ ] إضافة WebSocket للتحديثات الفورية
4. [ ] اختبار التحديثات الفورية

### المرحلة 4: الاختبار الشامل 🔄
1. [ ] اختبار رفع صور البروفايل
2. [ ] اختبار رفع الفيديوهات
3. [ ] اختبار progress indicators
4. [ ] اختبار ظهور الفيديوهات للمستخدمين الآخرين

## الفوائد المتوقعة

### 1. تجربة مستخدم أفضل ✅
- Progress bar واضح أثناء الرفع
- رسائل خطأ واضحة ومفيدة
- تحديثات فورية بعد الرفع

### 2. أداء أفضل ✅
- Optimistic updates للاستجابة الفورية
- Auto-refresh عند العودة للشاشة
- WebSocket للتحديثات الفورية

### 3. موثوقية أعلى ✅
- Error handling أفضل
- Validation أقوى
- Retry logic للفشل المؤقت

---

**ملاحظة**: يجب تنفيذ هذه التحسينات قبل إطلاق التطبيق لضمان تجربة مستخدم ممتازة.
