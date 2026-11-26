import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { ChevronLeft, Check } from 'lucide-react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { extractDurationFromUrl } from '../../utils/videoDuration';
import { resolveVideoUploadSource } from '../../src/utils/videoUpload';
import {
  checkReelVideoSizeLimit,
  formatReelTooLargeMessage,
  getVideoFileSizeBytes,
  isReelVideoOverSizeLimit,
  isStagedReelUploadUri,
} from '../../src/utils/reelVideoLimits';
import { toastManager } from '../../services/toastManager';
import { usePhotoPermission } from '../../hooks/usePhotoPermission';
import { logger } from '../../utils/logger';
import { useReelDraft } from '../../hooks/useReelDraft';
import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';
import { StorageService } from '../../src/services/storageService';
import { useVideos } from '../../contexts/VideosContext';
import { FIGMA_PRIMARY } from './constants';

const CAPTION_MAX = 500;
const HASHTAG_MAX = 120;
const BG = '#F6F2FF';
const TEXT = '#1A1040';
const MUTED = '#8B849E';
const INPUT_BG = '#FFFFFF';
const SOFT_BTN = '#EDE6FF';

type Stage = 'compose' | 'uploading' | 'success';

interface ReelPublishFlowProps {
  visible: boolean;
  onClose: () => void;
  onWatchReel?: (reelId: string) => void;
}

export default function ReelPublishFlow({
  visible,
  onClose,
  onWatchReel,
}: ReelPublishFlowProps) {
  const { isSignedIn, getToken } = useAuth();
  const { t, language } = useTranslation();
  const insets = useSafeAreaInsets();
  const { addVideo, removeVideo } = useVideos();
  const { permissionState } = usePhotoPermission();
  const { saveDraft, clearDraft, isOnline } = useReelDraft();

  const fonts = useMemo(
    () => ({
      regular: getAppFont(400, language),
      medium: getAppFont(500, language),
      bold: getAppFont(700, language),
    }),
    [language],
  );

  const [stage, setStage] = useState<Stage>('compose');
  const [videoAsset, setVideoAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [hashtagsText, setHashtagsText] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [publishedReelId, setPublishedReelId] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const inFlightRef = useRef(false);
  const openedPickerForSession = useRef(false);

  const resetLocal = useCallback(() => {
    setStage('compose');
    setVideoAsset(null);
    setCaption('');
    setHashtagsText('');
    setProgress(0);
    setPublishedReelId(null);
    cancelledRef.current = false;
    inFlightRef.current = false;
    openedPickerForSession.current = false;
  }, []);

  const handleClose = useCallback(() => {
    if (stage === 'uploading' && inFlightRef.current) {
      cancelledRef.current = true;
    }
    resetLocal();
    onClose();
  }, [onClose, resetLocal, stage]);

  const pickVideo = useCallback(async () => {
    if (isPicking || inFlightRef.current) return;
    if (!isSignedIn) {
      toastManager.showAuthError();
      return;
    }
    if (permissionState.library === 'limited') {
      toastManager.showInfo(t.reels.uploadLimitedAccess, t.reels.uploadLimitedAccessDetail);
    }

    setIsPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.7,
        videoMaxDuration: 60,
        videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      });

      if (result.canceled) {
        if (!videoAsset) {
          resetLocal();
          onClose();
        }
        return;
      }

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
        logger.warn('[ReelPublishFlow] stage failed', copyErr);
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

      try {
        const duration = await extractDurationFromUrl(stagedUri);
        if (duration != null) {
          if (duration < 5) {
            toastManager.showWarning(t.reels.uploadTooShort, t.reels.uploadTooShortDetail);
            return;
          }
          if (duration > 60) {
            toastManager.showWarning(t.reels.uploadTooLong, t.reels.uploadTooLongDetail);
            return;
          }
        } else {
          toastManager.showWarning(t.reels.uploadDurationWarning, t.reels.uploadDurationWarningDetail);
        }
      } catch {
        toastManager.showWarning(t.reels.uploadDurationWarning, t.reels.uploadDurationWarningDetail);
      }

      setVideoAsset(stagedAsset);
      setStage('compose');
    } catch (err) {
      logger.error('[ReelPublishFlow] pick failed', err);
      toastManager.showError(t.reels.uploadFailed, t.reels.uploadFailedDetail);
      if (!videoAsset) {
        resetLocal();
        onClose();
      }
    } finally {
      setIsPicking(false);
    }
  }, [
    isPicking,
    isSignedIn,
    onClose,
    permissionState.library,
    resetLocal,
    t.reels,
    videoAsset,
  ]);

  useEffect(() => {
    if (!visible) {
      openedPickerForSession.current = false;
      return;
    }
    if (!isSignedIn) {
      onClose();
      toastManager.showAuthError();
      return;
    }
    if (!openedPickerForSession.current) {
      openedPickerForSession.current = true;
      void pickVideo();
    }
  }, [visible, isSignedIn, onClose, pickVideo]);

  useEffect(() => {
    if (!visible || !videoAsset || stage !== 'compose') return;
    const timer = setTimeout(() => {
      saveDraft({
        videoUri: videoAsset.uri,
        caption: [caption.trim(), hashtagsText.trim()].filter(Boolean).join(' '),
        hashtags: [],
        mentions: [],
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [caption, hashtagsText, videoAsset, visible, stage, saveDraft]);

  const buildFullCaption = useCallback(() => {
    const parts = [caption.trim(), hashtagsText.trim()].filter(Boolean);
    return parts.join(' ').slice(0, CAPTION_MAX);
  }, [caption, hashtagsText]);

  const handleSaveDraft = useCallback(async () => {
    if (!videoAsset) return;
    await saveDraft({
      videoUri: videoAsset.uri,
      caption: buildFullCaption(),
      hashtags: [],
      mentions: [],
    });
    toastManager.showSuccess(t.reels.uploadDraftSavedTitle, t.reels.uploadDraftSavedDetail);
  }, [buildFullCaption, saveDraft, t.reels.uploadDraftSavedDetail, t.reels.uploadDraftSavedTitle, videoAsset]);

  const handlePublish = useCallback(async () => {
    if (!videoAsset || inFlightRef.current) return;
    if (!isOnline) {
      toastManager.showWarning(t.reels.uploadNoConnection, t.reels.uploadOfflineHint);
      return;
    }

    const fullCaption = buildFullCaption();
    const hashtagMatches = fullCaption.match(/#[\w\u0600-\u06FF]+/g) || [];
    if (hashtagMatches.length > 10) {
      toastManager.showWarning(t.reels.uploadHashtagTooMany, t.reels.uploadHashtagTooManyDetail);
      return;
    }

    inFlightRef.current = true;
    cancelledRef.current = false;
    setStage('uploading');
    setProgress(5);
    void activateKeepAwakeAsync('reel-publish-flow');

    const tempId = `temp_${Date.now()}`;
    try {
      const token = await getToken();
      if (!token) {
        toastManager.showAuthError();
        setStage('compose');
        return;
      }

      let uploadUri = videoAsset.uri;
      if (!isStagedReelUploadUri(videoAsset.uri)) {
        try {
          const resolved = await resolveVideoUploadSource(videoAsset.uri, {
            mimeType: videoAsset.mimeType,
            fileName: videoAsset.fileName,
          });
          uploadUri = resolved.uri;
        } catch {
          /* keep uri */
        }
      }

      addVideo({
        id: tempId,
        uri: uploadUri,
        createdAt: new Date(),
        isUploading: true,
        uploadProgress: 0,
      });

      const reservedMentions = new Set(['all', 'everyone']);
      const mentionMatches = [...fullCaption.matchAll(/(^|[^\w.@])@([A-Za-z0-9_.]{2,30})/g)];
      const mentions = [
        ...new Set(
          mentionMatches
            .map((m) => m[2].replace(/\.+$/, '').toLowerCase())
            .filter((name) => name.length >= 2 && !reservedMentions.has(name)),
        ),
      ];

      const uploadResult = await StorageService.uploadReel(
        token,
        uploadUri,
        undefined,
        fullCaption,
        hashtagMatches.map((h) => h.replace('#', '')),
        mentions,
        (pct) => {
          if (!cancelledRef.current) setProgress(pct);
        },
        {
          mimeType: videoAsset.mimeType,
          fileName: videoAsset.fileName,
        },
      );

      removeVideo(tempId);

      if (cancelledRef.current) {
        return;
      }

      if (uploadResult.success) {
        const reelId = (uploadResult as { reelId?: string }).reelId || null;
        setProgress(100);
        setPublishedReelId(reelId);
        setStage('success');
        await clearDraft();
      } else {
        toastManager.showError(
          t.reels.uploadFailed,
          uploadResult.error || t.reels.uploadFailedDetail,
        );
        setStage('compose');
      }
    } catch (err: any) {
      logger.error('[ReelPublishFlow] publish failed', err);
      removeVideo(tempId);
      if (!cancelledRef.current) {
        toastManager.showError(t.reels.uploadFailed, err?.message || t.reels.uploadFailedDetail);
        setStage('compose');
      }
    } finally {
      inFlightRef.current = false;
      deactivateKeepAwake('reel-publish-flow');
    }
  }, [
    addVideo,
    buildFullCaption,
    clearDraft,
    getToken,
    isOnline,
    removeVideo,
    t.reels,
    videoAsset,
  ]);

  if (!visible) return null;

  const header = (title: string) => (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={handleClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={22} color={FIGMA_PRIMARY} strokeWidth={2.6} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { fontFamily: fonts.bold }]}>{title}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {stage === 'compose' && (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {header(t.reels.publishTitle)}
            {isPicking && !videoAsset ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={FIGMA_PRIMARY} />
                <Text style={[styles.pickingText, { fontFamily: fonts.medium }]}>
                  {t.reels.uploadPreparing}
                </Text>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.composeBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.composeRow}>
                  <View style={styles.fieldsCol}>
                    <Text style={[styles.label, { fontFamily: fonts.bold }]}>
                      {t.reels.publishDescriptionLabel}
                    </Text>
                    <TextInput
                      style={[styles.descInput, { fontFamily: fonts.regular }]}
                      placeholder={t.reels.publishDescriptionPlaceholder}
                      placeholderTextColor="#B0A8C4"
                      value={caption}
                      onChangeText={(v) => setCaption(v.slice(0, CAPTION_MAX))}
                      multiline
                      textAlign="right"
                      maxLength={CAPTION_MAX}
                    />
                  </View>
                  <Pressable onPress={pickVideo} style={styles.thumbWrap}>
                    {videoAsset ? (
                      <Image
                        source={{ uri: videoAsset.uri }}
                        style={styles.thumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.thumb, styles.thumbEmpty]}>
                        <Text style={{ color: MUTED, fontSize: 12 }}>{t.reels.uploadPickVideo}</Text>
                      </View>
                    )}
                  </Pressable>
                </View>

                <Text style={[styles.label, { fontFamily: fonts.bold, marginTop: 18 }]}>
                  {t.reels.publishHashtagsLabel}
                </Text>
                <TextInput
                  style={[styles.hashInput, { fontFamily: fonts.regular }]}
                  placeholder="#كرة_القدم"
                  placeholderTextColor="#B0A8C4"
                  value={hashtagsText}
                  onChangeText={(v) => setHashtagsText(v.slice(0, HASHTAG_MAX))}
                  textAlign="right"
                  maxLength={HASHTAG_MAX}
                />

                <View style={styles.footerActions}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, !videoAsset && styles.btnDisabled]}
                    disabled={!videoAsset}
                    onPress={() => void handlePublish()}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.primaryBtnText, { fontFamily: fonts.bold }]}>
                      {t.reels.publishCta}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => void handleSaveDraft()}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.secondaryBtnText, { fontFamily: fonts.bold }]}>
                      {t.reels.publishSaveDraft}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        )}

        {stage === 'uploading' && (
          <View style={styles.flex}>
            {header(t.reels.publishingTitle)}
            <View style={styles.uploadCenter}>
              {videoAsset ? (
                <Image
                  source={{ uri: videoAsset.uri }}
                  style={styles.uploadThumb}
                  contentFit="cover"
                />
              ) : null}
              <Text style={[styles.uploadHeadline, { fontFamily: fonts.bold }]}>
                {t.reels.publishingHeadline}
              </Text>
              <Text style={[styles.uploadSub, { fontFamily: fonts.regular }]}>
                {t.reels.publishingSubtitle}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
              </View>
              <Text style={[styles.progressPct, { fontFamily: fonts.bold }]}>{Math.round(progress)}%</Text>
            </View>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleClose} activeOpacity={0.9}>
              <Text style={[styles.secondaryBtnText, { fontFamily: fonts.bold }]}>
                {t.reels.publishingCancel}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {stage === 'success' && (
          <View style={styles.flex}>
            {header(t.reels.publishedTitle)}
            <View style={styles.successCenter}>
              <View style={styles.successIcon}>
                <Check size={36} color={FIGMA_PRIMARY} strokeWidth={3} />
              </View>
              <Text style={[styles.successHeadline, { fontFamily: fonts.bold }]}>
                {t.reels.publishedHeadline}
              </Text>
              <Text style={[styles.successSub, { fontFamily: fonts.regular }]}>
                {t.reels.publishedSubtitle}
              </Text>
              {videoAsset ? (
                <Image
                  source={{ uri: videoAsset.uri }}
                  style={styles.successThumb}
                  contentFit="cover"
                />
              ) : null}
            </View>
            <View style={styles.footerActions}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  const id = publishedReelId;
                  resetLocal();
                  onClose();
                  if (id) onWatchReel?.(id);
                }}
                activeOpacity={0.9}
              >
                <Text style={[styles.primaryBtnText, { fontFamily: fonts.bold }]}>
                  {t.reels.publishedWatch}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  resetLocal();
                  onClose();
                }}
                activeOpacity={0.9}
              >
                <Text style={[styles.secondaryBtnText, { fontFamily: fonts.bold }]}>
                  {t.reels.publishedBack}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 20,
  },
  flex: { flex: 1 },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    minHeight: 44,
  },
  headerTitle: {
    color: FIGMA_PRIMARY,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 0,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SOFT_BTN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  pickingText: {
    color: TEXT,
    fontSize: 15,
  },
  composeBody: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  composeRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  fieldsCol: {
    flex: 1,
  },
  label: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
  },
  descInput: {
    flex: 1,
    minHeight: 140,
    backgroundColor: INPUT_BG,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: TEXT,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  thumbWrap: {
    width: 118,
  },
  thumb: {
    width: 118,
    height: 168,
    borderRadius: 18,
    backgroundColor: '#DDD6F3',
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  hashInput: {
    backgroundColor: INPUT_BG,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: TEXT,
    fontSize: 14,
  },
  footerActions: {
    marginTop: 'auto',
    paddingTop: 28,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: FIGMA_PRIMARY,
    borderRadius: 18,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: SOFT_BTN,
    borderRadius: 18,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: FIGMA_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  uploadCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  uploadThumb: {
    width: 180,
    height: 260,
    borderRadius: 22,
    marginBottom: 22,
    backgroundColor: '#DDD6F3',
  },
  uploadHeadline: {
    color: FIGMA_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  uploadSub: {
    color: MUTED,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 20,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 8,
    backgroundColor: SOFT_BTN,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: FIGMA_PRIMARY,
    borderRadius: 8,
  },
  progressPct: {
    marginTop: 10,
    color: FIGMA_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
  },
  successCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: SOFT_BTN,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successHeadline: {
    color: TEXT,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  successSub: {
    color: MUTED,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 22,
  },
  successThumb: {
    width: 160,
    height: 230,
    borderRadius: 20,
    backgroundColor: '#DDD6F3',
  },
});
