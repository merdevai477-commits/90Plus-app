# 📸 Image Upload System - Usage Guide

## Quick Start

### 1. Basic Avatar Upload

```typescript
import { ImageUploadModal } from '@/components/common/ImageUploadModal';
import { useState } from 'react';

function ProfileScreen() {
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  return (
    <>
      <TouchableOpacity onPress={() => setIsUploadModalVisible(true)}>
        <Text>Upload Avatar</Text>
      </TouchableOpacity>

      <ImageUploadModal
        visible={isUploadModalVisible}
        onClose={() => setIsUploadModalVisible(false)}
        onSuccess={(url) => {
          setAvatarUrl(url);
          console.log('Avatar uploaded:', url);
        }}
        uploadOptions={{
          endpoint: '/storage/avatar',
          fieldName: 'image',
        }}
        pickerOptions={{
          type: 'avatar',
          maxSize: 1,
          quality: 0.8,
        }}
        title="Upload Profile Picture"
      />
    </>
  );
}
```

### 2. Cover Image Upload

```typescript
<ImageUploadModal
  visible={isUploadModalVisible}
  onClose={() => setIsUploadModalVisible(false)}
  onSuccess={(url) => {
    setCoverUrl(url);
  }}
  uploadOptions={{
    endpoint: '/storage/cover',
    fieldName: 'image',
  }}
  pickerOptions={{
    type: 'cover',
    maxSize: 2,
    quality: 0.85,
  }}
  title="Upload Cover Image"
/>
```

### 3. Using Hooks Separately

#### Permission Hook

```typescript
import { usePhotoPermission } from '@/hooks/usePhotoPermission';

function MyComponent() {
  const {
    permissionState,
    requestCameraPermission,
    requestLibraryPermission,
    openSettings,
  } = usePhotoPermission();

  const handleTakePhoto = async () => {
    const granted = await requestCameraPermission();
    if (granted) {
      // Open camera
    } else {
      // Show error or guide to settings
    }
  };

  return (
    <View>
      <Text>Camera: {permissionState.camera}</Text>
      <Text>Library: {permissionState.library}</Text>
      <Button title="Request Camera" onPress={requestCameraPermission} />
      <Button title="Request Library" onPress={requestLibraryPermission} />
      <Button title="Open Settings" onPress={openSettings} />
    </View>
  );
}
```

#### Image Picker Hook

```typescript
import { useImagePicker } from '@/hooks/useImagePicker';

function MyComponent() {
  const { pickFromGallery, pickFromCamera, isLoading } = useImagePicker();

  const handlePickFromGallery = async () => {
    const image = await pickFromGallery({
      type: 'avatar',
      maxSize: 1,
      quality: 0.8,
    });

    if (image) {
      console.log('Image picked:', image);
      // Use image.uri for upload
    }
  };

  const handlePickFromCamera = async () => {
    const image = await pickFromCamera({
      type: 'avatar',
      maxSize: 1,
      quality: 0.8,
    });

    if (image) {
      console.log('Photo captured:', image);
      // Use image.uri for upload
    }
  };

  return (
    <View>
      <Button
        title="Pick from Gallery"
        onPress={handlePickFromGallery}
        disabled={isLoading}
      />
      <Button
        title="Take Photo"
        onPress={handlePickFromCamera}
        disabled={isLoading}
      />
    </View>
  );
}
```

#### Upload Hook

```typescript
import { useImageUpload } from '@/hooks/useImageUpload';

function MyComponent() {
  const { upload, cancel, isUploading, progress, error } = useImageUpload();

  const handleUpload = async (imageUri: string) => {
    const result = await upload(imageUri, {
      endpoint: '/storage/avatar',
      fieldName: 'image',
      onProgress: (prog) => {
        console.log('Upload progress:', prog);
      },
      maxRetries: 3,
    });

    if (result.success) {
      console.log('Upload successful:', result.url);
    } else {
      console.error('Upload failed:', result.error);
    }
  };

  return (
    <View>
      {isUploading && (
        <View>
          <Text>Uploading: {Math.round(progress)}%</Text>
          <ProgressBar progress={progress / 100} />
          <Button title="Cancel" onPress={cancel} />
        </View>
      )}
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
    </View>
  );
}
```

## Advanced Usage

### Custom Upload with Progress

```typescript
import { useImagePicker } from '@/hooks/useImagePicker';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useState } from 'react';

function AdvancedUpload() {
  const { pickFromGallery } = useImagePicker();
  const { upload, cancel, isUploading, progress } = useImageUpload();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleSelectAndUpload = async () => {
    // Step 1: Pick image
    const image = await pickFromGallery({
      type: 'avatar',
      maxSize: 1,
      quality: 0.8,
    });

    if (!image) return;

    setSelectedImage(image.uri);

    // Step 2: Upload with progress
    const result = await upload(image.uri, {
      endpoint: '/storage/avatar',
      fieldName: 'image',
      additionalData: {
        userId: 'user123',
        category: 'profile',
      },
      onProgress: (prog) => {
        console.log(`Upload progress: ${prog}%`);
      },
      maxRetries: 3,
    });

    if (result.success) {
      console.log('Upload successful:', result.url);
      // Update UI with new avatar
    } else {
      console.error('Upload failed:', result.error);
      // Show error message
    }
  };

  return (
    <View>
      <Button title="Select & Upload" onPress={handleSelectAndUpload} />
      
      {selectedImage && (
        <Image source={{ uri: selectedImage }} style={{ width: 200, height: 200 }} />
      )}

      {isUploading && (
        <View>
          <Text>Uploading: {Math.round(progress)}%</Text>
          <ProgressBar progress={progress / 100} />
          <Button title="Cancel Upload" onPress={cancel} />
        </View>
      )}
    </View>
  );
}
```

### Multiple Image Types

```typescript
const imageTypes = {
  avatar: {
    endpoint: '/storage/avatar',
    pickerOptions: {
      type: 'avatar' as const,
      maxSize: 1,
      quality: 0.8,
    },
  },
  cover: {
    endpoint: '/storage/cover',
    pickerOptions: {
      type: 'cover' as const,
      maxSize: 2,
      quality: 0.85,
    },
  },
  reel: {
    endpoint: '/storage/reel',
    pickerOptions: {
      type: 'reel' as const,
      maxSize: 100,
      quality: 0.9,
    },
  },
};

function MultiTypeUpload() {
  const [uploadType, setUploadType] = useState<'avatar' | 'cover' | 'reel'>('avatar');
  const [isModalVisible, setIsModalVisible] = useState(false);

  const config = imageTypes[uploadType];

  return (
    <>
      <Button title="Upload Avatar" onPress={() => {
        setUploadType('avatar');
        setIsModalVisible(true);
      }} />
      
      <Button title="Upload Cover" onPress={() => {
        setUploadType('cover');
        setIsModalVisible(true);
      }} />

      <ImageUploadModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSuccess={(url) => {
          console.log(`${uploadType} uploaded:`, url);
        }}
        uploadOptions={{
          endpoint: config.endpoint,
          fieldName: 'image',
        }}
        pickerOptions={config.pickerOptions}
        title={`Upload ${uploadType}`}
      />
    </>
  );
}
```

## Error Handling

### Handling Permission Errors

```typescript
const { requestCameraPermission } = usePhotoPermission();

const handleTakePhoto = async () => {
  const granted = await requestCameraPermission();
  
  if (!granted) {
    Alert.alert(
      'Permission Denied',
      'Camera access is required to take photos. Please enable it in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
    return;
  }

  // Proceed with camera
};
```

### Handling Upload Errors

```typescript
const { upload } = useImageUpload();

const handleUpload = async (uri: string) => {
  const result = await upload(uri, {
    endpoint: '/storage/avatar',
    fieldName: 'image',
  });

  if (!result.success) {
    // Handle specific errors
    if (result.error?.includes('Authentication')) {
      Alert.alert('Error', 'Please log in to upload images');
    } else if (result.error?.includes('size')) {
      Alert.alert('Error', 'Image is too large. Please select a smaller image.');
    } else if (result.error?.includes('type')) {
      Alert.alert('Error', 'Invalid file type. Please select an image.');
    } else {
      Alert.alert('Error', 'Upload failed. Please try again.');
    }
  }
};
```

## Best Practices

### 1. Always Check Permissions First

```typescript
const { permissionState, requestLibraryPermission } = usePhotoPermission();

const handleUpload = async () => {
  // Check if permission is already granted
  if (permissionState.library !== 'granted') {
    const granted = await requestLibraryPermission();
    if (!granted) return;
  }

  // Proceed with image picker
  const image = await pickFromGallery();
  // ...
};
```

### 2. Show Loading States

```typescript
const { isLoading: isPicking } = useImagePicker();
const { isUploading, progress } = useImageUpload();

return (
  <View>
    {isPicking && <ActivityIndicator />}
    {isUploading && (
      <View>
        <ProgressBar progress={progress / 100} />
        <Text>{Math.round(progress)}%</Text>
      </View>
    )}
  </View>
);
```

### 3. Provide Feedback

```typescript
import * as Haptics from 'expo-haptics';

const handleSuccess = (url: string) => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  Alert.alert('Success', 'Image uploaded successfully!');
};

const handleError = (error: string) => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  Alert.alert('Error', error);
};
```

### 4. Clean Up on Unmount

```typescript
useEffect(() => {
  return () => {
    // Cancel any ongoing uploads
    cancel();
  };
}, []);
```

## TypeScript Types

```typescript
// Permission types
type PermissionStatus = 'undetermined' | 'denied' | 'limited' | 'granted' | 'blocked';

interface PhotoPermissionState {
  camera: PermissionStatus;
  library: PermissionStatus;
  isLoading: boolean;
}

// Image picker types
interface ImagePickerOptions {
  type: 'avatar' | 'cover' | 'reel' | 'general';
  maxSize?: number; // in MB
  quality?: number; // 0-1
  allowsEditing?: boolean;
  aspect?: [number, number];
}

interface PickedImage {
  uri: string;
  width: number;
  height: number;
  size: number; // in bytes
  type: string;
  base64?: string;
}

// Upload types
interface UploadOptions {
  endpoint: string;
  fieldName?: string;
  additionalData?: Record<string, any>;
  onProgress?: (progress: number) => void;
  maxRetries?: number;
}

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
  data?: any;
}
```

## Common Issues

### Issue 1: Permission not requested
**Solution:** Make sure to call `requestCameraPermission()` or `requestLibraryPermission()` before using the picker.

### Issue 2: Upload fails with 401
**Solution:** Ensure you're passing a valid authentication token in the upload options.

### Issue 3: Image too large
**Solution:** Adjust the `maxSize` option in `ImagePickerOptions` or compress the image before upload.

### Issue 4: Progress not updating
**Solution:** Make sure you're using the `onProgress` callback in `UploadOptions`.

### Issue 5: Modal not closing
**Solution:** Call `onClose()` in the `onSuccess` callback of `ImageUploadModal`.

## Testing

### Test on Real Devices
- iOS: Test on iOS 14+ for Limited Access
- Android: Test permission flow
- Test with slow network
- Test with large images
- Test cancellation

### Test Edge Cases
- No camera available
- Insufficient storage
- Network errors
- Invalid file types
- File size limits

## Support

For issues or questions:
1. Check the diagnostics: `getDiagnostics(['front/hooks/useImagePicker.ts'])`
2. Check the logs: Look for `[IMAGE_UPLOAD]` or `[IMAGE_PICKER]` tags
3. Review the error messages: They provide specific guidance

---

**Happy coding!** 🚀
