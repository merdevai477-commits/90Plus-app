# Bugfix Requirements Document

## Introduction

تطبيق 90Plus يفشل في بناء iOS build على EAS Build بسبب تضارب في إعدادات New Architecture بين ملفات التكوين المختلفة. المشكلة تظهر عند محاولة عمل production build للـ iOS ورفعه على TestFlight، حيث تفشل عملية `pod install` لأن مكتبة react-native-reanimated تطلب تفعيل New Architecture بينما الإعدادات في `app.json` تشير إلى تعطيلها.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN running `eas build --platform ios --profile production` THEN the build fails with error: `[!] Invalid RNReanimated.podspec file: [Reanimated] Reanimated requires the New Architecture to be enabled`

1.2 WHEN `app.json` has `"newArchEnabled": false` AND `android/gradle.properties` has `newArchEnabled=true` THEN there is a configuration mismatch between platforms

1.3 WHEN expo doctor runs THEN it warns about native configuration properties in app.json conflicting with existing android folder

1.4 WHEN the iOS build process starts THEN it fails during pod install phase because react-native-reanimated ~3.16.1 requires New Architecture to be enabled

### Expected Behavior (Correct)

2.1 WHEN running `eas build --platform ios --profile production` THEN the build SHALL complete successfully without New Architecture errors

2.2 WHEN `app.json` has `"newArchEnabled": true` AND `android/gradle.properties` has `newArchEnabled=true` THEN both platforms SHALL have consistent New Architecture configuration

2.3 WHEN expo doctor runs THEN it SHALL NOT warn about configuration conflicts between app.json and native folders

2.4 WHEN the iOS build process starts THEN pod install SHALL succeed and react-native-reanimated SHALL initialize correctly with New Architecture enabled

### Unchanged Behavior (Regression Prevention)

3.1 WHEN running the app locally with `expo start` THEN the app SHALL CONTINUE TO work normally on Expo Go

3.2 WHEN using react-native-reanimated animations in the app THEN they SHALL CONTINUE TO work smoothly without performance degradation

3.3 WHEN building for Android platform THEN the build SHALL CONTINUE TO succeed as it currently does

3.4 WHEN the app runs on iOS devices after the fix THEN all existing features (video playback, animations, navigation) SHALL CONTINUE TO function correctly
