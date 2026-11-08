import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, Hash, X } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useAuth } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { extractDurationFromUrl } from '../../utils/videoDuration';
import { resolveVideoUploadSource } from '../../src/utils/videoUpload';
import {
  checkReelVideoSizeLimit,
  formatReelTooLargeMessage,
  getVideoFileSizeBytes,
  isReelVideoOverSizeLimit,
  isStagedReelUploadUri,
  MAX_REEL_VIDEO_MB,
} from '../../src/utils/reelVideoLimits';
import { toastManager } from '../../services/toastManager';
import { usePhotoPermission } from '../../hooks/usePhotoPermission';
import { logger } from '../../utils/logger';
import { useReelDraft } from '../../hooks/useReelDraft';
import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';
import { MentionSuggestions } from '../community/MentionSuggestions';
import {
  activeMentionQuery,
  everyoneSuggestionMatches,
  isArabicText,
} from '../community/richTextParse';
import { useMentionSearch } from '../../hooks/community/useMentionSearch';
import type { CommunityAuthor } from '../../services/community.api';
import { C } from '../community/theme';

const CAPTION_MAX = 500;

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
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const isAr = language === 'ar';
  const fonts = useMemo(
    () => ({
      regular: getAppFont(400, language),
      medium: getAppFont(500, language),
      semibold: getAppFont(600, language),
    }),
    [language],
  );
  const community = t.community;

  const [videoAsset, setVideoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [caret, setCaret] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPickingVideo, setIsPickingVideo] = useState(false);
  const [uploadStage, setUploadStage] = useState<'idle' | 'preparing' | 'uploading' | 'done'>('idle');
  const uploadProgress = useSharedValue(0);
  const { permissionState } = usePhotoPermission();
  const inputRef = useRef<TextInput>(null);

  const { draft, saveDraft, clearDraft, hasDraft, isOnline } = useReelDraft();

  const mention = activeMentionQuery(caption, caret);
  const { results, loading } = useMentionSearch(mention ? mention.query : null);
  const showEveryone = !!mention && everyoneSuggestionMatches(mention.query);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${uploadProgress.value}%`,
  }));

  const captionAlign = caption
    ? isArabicText(caption)
      ? 'right'
      : 'left'
    : isAr
      ? 'right'
      : 'left';

  useEffect(() => {
    if (visible && hasDraft && draft && !videoAsset) {
      Alert.alert(t.reels.uploadDraftTitle, t.reels.uploadDraftMessage, [
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
      ]);
    }
  }, [visible]);

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

  React.useEffect(() => {
    if (!visible) return;

    if (!isSignedIn) {
      onClose();
      toastManager.showAuthError();
      router.replace('/auth');
      return;
    }

    if (!canUploadVideo) {
      onClose();
      toastManager.showWarning(
        t.reels.uploadProfileIncomplete,
        (t.reels.uploadProfileIncompleteDetail as string).replace(
          '{steps}',
          missingRequiredSteps.join('\n• '),
        ),
      );
    }
  }, [visible, isSignedIn, canUploadVideo, missingRequiredSteps, onClose]);

  const insertToken = useCallback(
    (start: number, token: string) => {
      const next = `${caption.slice(0, start)}${token} ${caption.slice(caret)}`.slice(0, CAPTION_MAX);
      setCaption(next);
      const pos = Math.min(CAPTION_MAX, start + token.length + 1);
      setCaret(pos);
      requestAnimationFrame(() =>
        inputRef.current?.setNativeProps({ selection: { start: pos, end: pos } }),
      );
    },
    [caption, caret],
  );

  const applyInsert = useCallback(
    (token: string) => {
      const next = `${caption.slice(0, caret)}${token}${caption.slice(caret)}`.slice(0, CAPTION_MAX);
      setCaption(next);
      const pos = Math.min(CAPTION_MAX, caret + token.length);
      setCaret(pos);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setNativeProps({ selection: { start: pos, end: pos } });
      });
    },
    [caption, caret],
  );

  const pickMention = useCallback(
    (u: CommunityAuthor) => {
      if (!mention) return;
      insertToken(mention.start, `@${u.username}`);
    },
    [insertToken, mention],
  );

  if (!isSignedIn || !canUploadVideo) {
    return null;
  }

  const pickVideo = async () => {
    if (uploadLocked || isPickingVideo) {
      if (uploadLocked) {
        toastManager.showWarning(t.reels.uploadLockedToast, t.reels.uploadLockedToastDetail);
      }
      return;
    }
    if (permissionState.library === 'limited') {
      toastManager.showInfo(t.reels.uploadLimitedAccess, t.reels.uploadLimitedAccessDetail);
    }

    setIsPickingVideo(true);
    onPickerOpen?.();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.7,
        videoMaxDuration: 60,
        videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      const sizeCheck = await checkReelVideoSizeLimit(asset.uri, asset.fileSize);
      if (!sizeCheck.ok) {
        toastManager.showWarning(
          t.reels.uploadFileTooLarge,
          formatReelTooLargeMessage(t.reels.uploadFileTooLargeDetail as string, sizeCheck.sizeBytes),
        );
        return;
      }

      let stagedUri = asset.uri;
      let stagedMime = asset.mimeType;
      let stagedName = asset.fileName;
      try {
        const resolved = await resolveVideoUploadSource(asset.uri, {
          mimeType: asset.mimeType,
          fileName: asset.fileName,
        });
        stagedUri = resolved.uri;
        stagedMime = resolved.type;
        stagedName = resolved.name;
      } catch (copyErr) {
        logger.warn('[ReelUploadModal] Could not stage video after size check', copyErr);
      }

      const stagedSizeBytes = await getVideoFileSizeBytes(
        stagedUri,
        sizeCheck.sizeBytes ?? asset.fileSize,
      );
      if (stagedSizeBytes != null && isReelVideoOverSizeLimit(stagedSizeBytes)) {
        toastManager.showWarning(
          t.reels.uploadFileTooLarge,
          formatReelTooLargeMessage(t.reels.uploadFileTooLargeDetail as string, stagedSizeBytes),
        );
        return;
      }

      const stagedAsset = {
        ...asset,
        uri: stagedUri,
        mimeType: stagedMime,
        fileName: stagedName,
        fileSize: stagedSizeBytes ?? sizeCheck.sizeBytes ?? asset.fileSize,
      };

      let duration: number | null = null;
      try {
        duration = await extractDurationFromUrl(stagedUri);
      } catch (durationErr) {
        logger.warn('[ReelUploadModal] Duration extraction failed', durationErr);
      }

      if (duration === null) {
        toastManager.showWarning(t.reels.uploadDurationWarning, t.reels.uploadDurationWarningDetail);
        setVideoAsset(stagedAsset);
        return;
      }

      if (duration < 5) {
        toastManager.showWarning(t.reels.uploadTooShort, t.reels.uploadTooShortDetail);
        return;
      }

      if (duration > 60) {
        toastManager.showWarning(t.reels.uploadTooLong, t.reels.uploadTooLongDetail);
        return;
      }

      setVideoAsset(stagedAsset);
    } catch (err) {
      logger.error('[ReelUploadModal] pickVideo failed:', err);
      toastManager.showError(t.reels.uploadFailed, t.reels.uploadFailedDetail);
    } finally {
      setIsPickingVideo(false);
      onPickerClose?.();
    }
  };

  const handleUpload = async () => {
    if (!videoAsset) return;
    if (uploadLocked) {
      toastManager.showWarning(t.reels.uploadLockedToast, t.reels.uploadLockedPublishToast);
      return;
    }

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

      let uploadUri = videoAsset.uri;
      if (!isStagedReelUploadUri(videoAsset.uri)) {
        try {
          const resolved = await resolveVideoUploadSource(videoAsset.uri, {
            mimeType: videoAsset.mimeType,
            fileName: videoAsset.fileName,
          });
          uploadUri = resolved.uri;
        } catch (stageErr) {
          logger.warn('[ReelUploadModal] Publish staging failed, using asset URI', stageErr);
        }
      }

      const newVideo = {
        id: `temp_${Date.now()}`,
        uri: uploadUri,
        mimeType: videoAsset.mimeType,
        fileName: videoAsset.fileName,
        fileSize: (videoAsset as { fileSize?: number }).fileSize,
        caption,
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
      setCaret(0);
      await clearDraft();
      onClose();
    } catch (error) {
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
      case 'preparing':
        return t.reels.uploadPreparing;
      case 'uploading':
        return t.reels.uploadUploading;
      case 'done':
        return t.reels.uploadDone;
      default:
        return t.reels.uploadPublishNow;
    }
  };

  const canPublish = !!videoAsset && !isUploading && !uploadLocked && isOnline;
  const row = isAr ? ('row-reverse' as const) : ('row' as const);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <BlurView intensity={40} style={StyleSheet.absoluteFill} tint="dark" />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <View style={[styles.content, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
            <View style={styles.handle} />
            <LinearGradient
              colors={[C.accentSoft, C.accent, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topAccent}
            />

            <View style={[styles.header, { flexDirection: row }]}>
              <Text style={[styles.title, { fontFamily: fonts.semibold }]}>{t.reels.uploadTitle}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={10}>
                <X size={18} color={C.textStrong} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollBody}
            >
              {uploadLocked && (
                <View style={[styles.lockedBanner, { flexDirection: row }]}>
                  <ActivityIndicator size="small" color={C.accentSoft} />
                  <Text style={[styles.lockedBannerText, { fontFamily: fonts.regular }]}>
                    {t.reels.uploadLockedBanner}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.uploadArea, (uploadLocked || isPickingVideo) && styles.uploadAreaDisabled]}
                onPress={pickVideo}
                activeOpacity={uploadLocked || isPickingVideo ? 1 : 0.8}
                disabled={uploadLocked || isPickingVideo}
              >
                {isPickingVideo ? (
                  <View style={styles.placeholderContainer}>
                    <ActivityIndicator color={C.accentSoft} size="large" />
                    <Text style={[styles.uploadText, { fontFamily: fonts.semibold }]}>
                      {t.reels.uploadPreparing}
                    </Text>
                  </View>
                ) : videoAsset ? (
                  <View style={styles.previewContainer}>
                    <Image
                      source={{ uri: videoAsset.uri }}
                      style={styles.videoPreview}
                      contentFit="cover"
                    />
                    <View style={styles.changeOverlay}>
                      <Text style={[styles.changeText, { fontFamily: fonts.semibold }]}>
                        {t.reels.uploadChangeVideo}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.placeholderContainer}>
                    <View style={styles.uploadIconWrap}>
                      <Ionicons name="cloud-upload-outline" size={28} color={C.accentSoft} />
                    </View>
                    <Text style={[styles.uploadText, { fontFamily: fonts.semibold }]}>
                      {t.reels.uploadPickVideo}
                    </Text>
                    <Text style={[styles.uploadSubText, { fontFamily: fonts.regular }]}>
                      {(t.reels.uploadDurationHint as string).replace('{max}', String(MAX_REEL_VIDEO_MB))}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {mention ? (
                <MentionSuggestions
                  users={results}
                  loading={loading}
                  emptyLabel={community.noUsersFound}
                  fontFamily={fonts.regular}
                  onPick={pickMention}
                  everyone={
                    showEveryone
                      ? {
                          label: community.everyoneMention,
                          hint: community.everyoneHint,
                          onPress: () => insertToken(mention.start, '@all'),
                        }
                      : null
                  }
                />
              ) : null}

              <View style={[styles.inputCard, uploadLocked && styles.inputDisabled]}>
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.input,
                    { fontFamily: fonts.regular, textAlign: captionAlign },
                  ]}
                  placeholder={t.reels.uploadCaptionPlaceholder}
                  placeholderTextColor={C.placeholder}
                  value={caption}
                  onChangeText={(v) => setCaption(v.slice(0, CAPTION_MAX))}
                  onSelectionChange={(e) => setCaret(e.nativeEvent.selection.end)}
                  multiline
                  maxLength={CAPTION_MAX}
                  editable={!uploadLocked}
                  selectionColor={C.accent}
                />
                <Text style={[styles.charCount, { fontFamily: fonts.regular }]}>
                  {caption.length}/{CAPTION_MAX}
                </Text>
              </View>

              <View style={[styles.toolbar, { flexDirection: row }]}>
                <Pressable
                  onPress={() => applyInsert('#')}
                  style={[styles.tool, { flexDirection: row }]}
                  disabled={uploadLocked}
                  accessibilityRole="button"
                  accessibilityLabel={community.hashtagTool}
                >
                  <View style={styles.toolGlyph}>
                    <Hash size={16} color={C.accentSoft} strokeWidth={2.4} />
                  </View>
                  <Text style={[styles.toolText, { fontFamily: fonts.medium }]}>
                    {community.hashtagTool}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => applyInsert('@')}
                  style={[styles.tool, { flexDirection: row }]}
                  disabled={uploadLocked}
                  accessibilityRole="button"
                  accessibilityLabel={community.mentionTool}
                >
                  <View style={styles.toolGlyph}>
                    <AtSign size={16} color={C.accentSoft} strokeWidth={2.4} />
                  </View>
                  <Text style={[styles.toolText, { fontFamily: fonts.medium }]}>
                    {community.mentionTool}
                  </Text>
                </Pressable>
              </View>

              {isUploading && (
                <View style={styles.progressContainer}>
                  <Animated.View style={[styles.progressBar, progressStyle]} />
                </View>
              )}

              <TouchableOpacity
                onPress={handleUpload}
                disabled={!canPublish}
                style={{ opacity: canPublish ? 1 : 0.5 }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={canPublish ? ['#A78BFA', '#7C3AED'] : ['#3B2A63', '#2A1D4A']}
                  style={styles.submitButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isUploading ? (
                    <View style={styles.uploadingContent}>
                      <ActivityIndicator color="#FFF" size="small" />
                      <Text style={[styles.submitText, { fontFamily: fonts.semibold }]}>
                        {getUploadStatusText()}
                      </Text>
                    </View>
                  ) : !isOnline ? (
                    <Text style={[styles.submitText, { fontFamily: fonts.semibold }]}>
                      {t.reels.uploadNoConnection}
                    </Text>
                  ) : (
                    <Text style={[styles.submitText, { fontFamily: fonts.semibold }]}>
                      {t.reels.uploadPublishNow}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {!isOnline && (
                <Text style={[styles.offlineHint, { fontFamily: fonts.regular }]}>
                  {t.reels.uploadOfflineHint}
                </Text>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: C.overlay,
  },
  keyboardWrap: {
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: C.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: C.composerBorder,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(183,154,248,0.35)',
    marginBottom: 10,
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
  header: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.composerHairline,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textStrong,
    letterSpacing: 0.2,
    flex: 1,
  },
  closeButton: {
    padding: 8,
    backgroundColor: C.followBtn,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  scrollBody: {
    paddingBottom: 8,
    gap: 14,
  },
  uploadArea: {
    height: 200,
    backgroundColor: C.input,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  uploadIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(183,154,248,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(183,154,248,0.28)',
    marginBottom: 4,
  },
  uploadText: {
    color: C.textStrong,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  uploadSubText: {
    color: C.muted,
    fontSize: 12,
    textAlign: 'center',
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
    backgroundColor: 'rgba(12,6,32,0.82)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  changeText: {
    color: C.accentSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  inputCard: {
    backgroundColor: C.composer,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.composerBorder,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  input: {
    color: C.text,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 88,
    textAlignVertical: 'top',
    padding: 0,
  },
  charCount: {
    color: C.counter,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
  toolbar: {
    alignItems: 'center',
    gap: 18,
  },
  tool: {
    alignItems: 'center',
    gap: 8,
  },
  toolGlyph: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(183,154,248,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(183,154,248,0.28)',
  },
  toolText: {
    color: C.accentSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  progressContainer: {
    height: 4,
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: C.accent,
    borderRadius: 2,
  },
  uploadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedBanner: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 14,
    padding: 12,
  },
  lockedBannerText: {
    flex: 1,
    color: C.accentSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  uploadAreaDisabled: {
    opacity: 0.45,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  offlineHint: {
    color: '#f87171',
    textAlign: 'center',
    fontSize: 12,
  },
});
