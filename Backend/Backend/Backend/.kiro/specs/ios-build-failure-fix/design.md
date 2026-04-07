# iOS Build Failure Fix - Bugfix Design

## Overview

The iOS build fails on EAS Build due to a configuration mismatch where `app.json` has `"newArchEnabled": false` while `android/gradle.properties` has `newArchEnabled=true`. The react-native-reanimated library (version ~3.16.1) requires New Architecture to be enabled, causing pod install to fail during the iOS build process. The fix involves enabling New Architecture consistently across all configuration files to satisfy the library requirement and ensure successful iOS builds.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when iOS build is attempted with New Architecture disabled in app.json but enabled in android/gradle.properties
- **Property (P)**: The desired behavior - iOS build completes successfully with consistent New Architecture configuration across all platforms
- **Preservation**: Existing app functionality (animations, video playback, navigation) and Android build process that must remain unchanged
- **New Architecture**: React Native's new rendering system (Fabric) and module system (TurboModules) that provides better performance
- **react-native-reanimated**: Animation library used throughout the app that requires New Architecture in version 3.16.1+
- **EAS Build**: Expo Application Services build system used to create production iOS and Android builds
- **pod install**: CocoaPods dependency installation process for iOS that fails when configuration is inconsistent

## Bug Details

### Bug Condition

The bug manifests when running `eas build --platform ios --profile production` with mismatched New Architecture configuration. The iOS build process fails during the pod install phase because react-native-reanimated ~3.16.1 detects that New Architecture is disabled in app.json while it requires it to be enabled.

**Formal Specification:**
```
FUNCTION isBugCondition(buildConfig)
  INPUT: buildConfig of type BuildConfiguration
  OUTPUT: boolean
  
  RETURN buildConfig.platform == 'ios'
         AND buildConfig.profile == 'production'
         AND buildConfig.appJson.newArchEnabled == false
         AND buildConfig.androidGradleProperties.newArchEnabled == true
         AND buildConfig.dependencies['react-native-reanimated'] >= '3.16.0'
END FUNCTION
```

### Examples

- **Example 1**: Running `eas build --platform ios --profile production` with app.json having `"newArchEnabled": false` → Build fails with error: `[!] Invalid RNReanimated.podspec file: [Reanimated] Reanimated requires the New Architecture to be enabled`
- **Example 2**: expo doctor warns about native configuration properties in app.json conflicting with existing android folder → Configuration mismatch detected
- **Example 3**: Android builds succeed because gradle.properties has `newArchEnabled=true` → Only iOS is affected by the mismatch
- **Edge Case**: Local development with Expo Go continues to work because Expo Go has its own configuration → Bug only manifests during production builds

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Local development with `expo start` must continue to work normally on Expo Go
- react-native-reanimated animations throughout the app must continue to work smoothly without performance degradation
- Android builds must continue to succeed as they currently do
- All existing features (video playback with expo-av, navigation with expo-router, animations) must function correctly on iOS devices after the fix

**Scope:**
All inputs that do NOT involve iOS production builds should be completely unaffected by this fix. This includes:
- Local development and testing with Expo Go
- Android production builds
- Web builds
- Development builds for iOS
- Preview builds

## Hypothesized Root Cause

Based on the bug description and configuration analysis, the most likely issues are:

1. **Configuration Mismatch**: The app.json has `"newArchEnabled": false` while android/gradle.properties has `newArchEnabled=true`
   - This creates an inconsistency between platform configurations
   - iOS build process reads app.json and applies the false value
   - react-native-reanimated 3.16.1+ requires New Architecture to be enabled

2. **Library Version Requirement**: react-native-reanimated was upgraded to ~3.16.1 which mandates New Architecture
   - Older versions of reanimated worked without New Architecture
   - The upgrade introduced this new requirement
   - The configuration was not updated to match the new requirement

3. **expo-build-properties Plugin**: The expo-build-properties plugin in app.json may not be overriding the newArchEnabled setting correctly
   - The plugin has iOS-specific settings but doesn't explicitly set newArchEnabled
   - The top-level newArchEnabled: false takes precedence

4. **Platform-Specific Configuration**: Android configuration was updated independently without updating iOS configuration
   - gradle.properties was set to true for Android
   - app.json was left at false, affecting iOS

## Correctness Properties

Property 1: Bug Condition - iOS Build Success with New Architecture

_For any_ iOS production build configuration where New Architecture is consistently enabled across all configuration files (app.json and platform-specific configs), the build process SHALL complete successfully without pod install errors, and react-native-reanimated SHALL initialize correctly.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Existing Functionality and Build Processes

_For any_ build configuration that is NOT an iOS production build (local development, Android builds, web builds), the fixed configuration SHALL produce exactly the same behavior as the original configuration, preserving all existing functionality including animations, video playback, navigation, and successful Android builds.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `front/app.json`

**Section**: Root level expo configuration

**Specific Changes**:
1. **Enable New Architecture**: Change `"newArchEnabled": false` to `"newArchEnabled": true`
   - This aligns the iOS configuration with Android's gradle.properties setting
   - Satisfies react-native-reanimated 3.16.1+ requirement
   - Ensures consistency across all platforms

2. **Verify expo-build-properties Plugin**: Ensure the expo-build-properties plugin configuration is correct
   - Current iOS settings: `"deploymentTarget": "15.1"`, `"useFrameworks": "static"`
   - These settings are correct and should remain unchanged
   - The plugin will now work with the enabled New Architecture

3. **No Changes to android/gradle.properties**: Keep `newArchEnabled=true` as is
   - Android configuration is already correct
   - This maintains the successful Android build process

4. **No Changes to eas.json**: Build profiles remain unchanged
   - Production profile configuration is correct
   - Node version 20.18.0 is appropriate
   - Auto-increment and channel settings are correct

5. **Verify package.json Dependencies**: Ensure all dependencies are compatible with New Architecture
   - react-native-reanimated ~3.16.1 requires New Architecture (already installed)
   - expo-router ~4.0.22 supports New Architecture
   - All other expo packages in SDK 52 support New Architecture

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, verify the bug exists on unfixed code by attempting an iOS build, then verify the fix works correctly and preserves existing behavior by testing the build process and app functionality.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause analysis by observing the exact error during iOS build.

**Test Plan**: Attempt to build iOS production version with the current configuration (newArchEnabled: false in app.json). Document the exact error message and failure point. This confirms that the configuration mismatch is the root cause.

**Test Cases**:
1. **iOS Production Build Test**: Run `eas build --platform ios --profile production` with current config (will fail on unfixed code)
2. **expo doctor Check**: Run `expo doctor` to observe configuration warnings (will show warnings on unfixed code)
3. **Android Build Test**: Run `eas build --platform android --profile production` to verify Android works (should succeed on unfixed code)
4. **Local Development Test**: Run `expo start` to verify local development works (should succeed on unfixed code)

**Expected Counterexamples**:
- iOS build fails during pod install phase with error: `[Reanimated] Reanimated requires the New Architecture to be enabled`
- Possible causes: newArchEnabled mismatch between app.json and gradle.properties, react-native-reanimated version requirement

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (iOS production builds), the fixed configuration produces the expected behavior (successful build).

**Pseudocode:**
```
FOR ALL buildConfig WHERE isBugCondition(buildConfig) DO
  result := runEASBuild_fixed(buildConfig)
  ASSERT result.status == 'success'
  ASSERT result.podInstallSuccess == true
  ASSERT result.reanimatedInitialized == true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (non-iOS-production scenarios), the fixed configuration produces the same result as the original configuration.

**Pseudocode:**
```
FOR ALL buildConfig WHERE NOT isBugCondition(buildConfig) DO
  ASSERT runBuild_original(buildConfig).behavior == runBuild_fixed(buildConfig).behavior
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across different build configurations
- It catches edge cases that manual testing might miss (different profiles, platforms, environments)
- It provides strong guarantees that behavior is unchanged for all non-buggy scenarios

**Test Plan**: Observe behavior on UNFIXED code first for local development, Android builds, and app functionality, then verify these continue to work identically after enabling New Architecture.

**Test Cases**:
1. **Local Development Preservation**: Verify `expo start` works on both unfixed and fixed code, app runs identically in Expo Go
2. **Android Build Preservation**: Verify Android production builds succeed on both unfixed and fixed code with identical output
3. **Animation Preservation**: Verify react-native-reanimated animations work identically before and after fix
4. **Feature Preservation**: Verify video playback, navigation, and all app features work identically on iOS devices

### Unit Tests

- Test that app.json has newArchEnabled set to true after fix
- Test that gradle.properties maintains newArchEnabled=true
- Test that expo doctor runs without configuration warnings
- Test that package.json dependencies are compatible with New Architecture

### Property-Based Tests

- Generate random build configurations (different platforms, profiles) and verify iOS production builds succeed with fixed config
- Generate random app usage scenarios and verify all features work correctly with New Architecture enabled
- Test that enabling New Architecture doesn't break any existing functionality across many test cases

### Integration Tests

- Test full iOS build flow from `eas build` command to successful IPA generation
- Test app installation and launch on real iOS devices after build
- Test that all features work end-to-end on iOS with New Architecture enabled (video upload, reels playback, animations, navigation)
- Test that Android builds continue to work without any changes
