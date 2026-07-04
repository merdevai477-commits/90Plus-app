import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import * as ImagePicker from 'expo-image-picker';

import { PredictionGroupsService, type GroupVisibility, type PredictionGroupListItem } from '../../services/predictionGroups.service';
import { toastManager } from '../../services/toastManager';

interface UseGroupsHomeOptions {
  errorTitle: string;
  warningTitle: string;
  groupActionFailedMessage: string;
  invalidInviteCodeMessage: string;
  alreadyMemberMessage: string;
}

export function useGroupsHome(options: UseGroupsHomeOptions) {
  const {
    errorTitle,
    warningTitle,
    groupActionFailedMessage,
    invalidInviteCodeMessage,
    alreadyMemberMessage,
  } = options;

  const { getToken } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ invite?: string | string[] }>();
  const inviteFromLink = Array.isArray(params.invite) ? params.invite[0] : params.invite;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<PredictionGroupListItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupVisibility, setNewGroupVisibility] = useState<GroupVisibility>('PRIVATE');
  const [newGroupImage, setNewGroupImage] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);
  const [inviteCode, setInviteCode] = useState(inviteFromLink || '');

  const didBootstrapRef = useRef(false);
  const autoJoinAttemptedRef = useRef(false);

  const isPrivateSelected = newGroupVisibility === 'PRIVATE';
  const isPublicSelected = newGroupVisibility === 'PUBLIC';

  const loadGroups = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const list = await PredictionGroupsService.listMyGroups(token);
    setGroups(list);
  }, [getToken]);

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      await loadGroups();
    } catch {
      toastManager.showError(errorTitle, groupActionFailedMessage);
    } finally {
      setLoading(false);
    }
  }, [errorTitle, groupActionFailedMessage, loadGroups]);

  useEffect(() => {
    if (didBootstrapRef.current) return;
    didBootstrapRef.current = true;
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!inviteFromLink || autoJoinAttemptedRef.current || loading) return;
    autoJoinAttemptedRef.current = true;
    setInviteCode(inviteFromLink);
    setShowJoin(true);
  }, [inviteFromLink, loading]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadGroups();
    } finally {
      setRefreshing(false);
    }
  }, [loadGroups]);

  const pickGroupImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toastManager.showError(errorTitle, groupActionFailedMessage);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;
      setNewGroupImage(result.assets[0].uri);
    } catch {
      toastManager.showError(errorTitle, groupActionFailedMessage);
    }
  }, [errorTitle, groupActionFailedMessage]);

  const createGroup = useCallback(async () => {
    const token = await getToken();
    if (!token || !newGroupName.trim() || creatingGroup) return;

    try {
      setCreatingGroup(true);
      const created = await PredictionGroupsService.createGroup(token, {
        name: newGroupName.trim(),
        imageUrl: newGroupImage,
        visibility: newGroupVisibility,
      });

      setShowCreate(false);
      setNewGroupName('');
      setNewGroupVisibility('PRIVATE');
      setNewGroupImage(null);

      await loadGroups();
      router.push({ pathname: '/groups/[groupId]', params: { groupId: created.id } });
    } catch (error: any) {
      toastManager.showError(errorTitle, error?.message || groupActionFailedMessage);
    } finally {
      setCreatingGroup(false);
    }
  }, [creatingGroup, errorTitle, getToken, groupActionFailedMessage, loadGroups, newGroupImage, newGroupName, newGroupVisibility, router]);

  const joinGroup = useCallback(async () => {
    const token = await getToken();
    if (!token || !inviteCode.trim() || joiningGroup) return;

    try {
      setJoiningGroup(true);
      const joined = await PredictionGroupsService.joinGroup(token, {
        inviteCode: inviteCode.trim().toUpperCase(),
      });

      setShowJoin(false);
      await loadGroups();
      router.push({ pathname: '/groups/[groupId]', params: { groupId: joined.id } });

      if (joined.alreadyMember) {
        toastManager.showInfo(warningTitle, alreadyMemberMessage);
      }
    } catch (error: any) {
      const rawMessage = String(error?.message || '').toLowerCase();
      const isInvalidInvite =
        rawMessage.includes('invite') ||
        rawMessage.includes('code') ||
        rawMessage.includes('not found') ||
        rawMessage.includes('invalid');

      toastManager.showError(
        errorTitle,
        isInvalidInvite ? invalidInviteCodeMessage : (error?.message || groupActionFailedMessage),
      );
    } finally {
      setJoiningGroup(false);
    }
  }, [alreadyMemberMessage, errorTitle, getToken, groupActionFailedMessage, invalidInviteCodeMessage, inviteCode, joiningGroup, loadGroups, router, warningTitle]);

  const overview = useMemo(() => ({
    groupsCount: groups.length,
    bestRank: '-',
    myPoints: 0,
  }), [groups.length]);

  return {
    loading,
    refreshing,
    groups,
    showCreate,
    showJoin,
    newGroupName,
    newGroupVisibility,
    newGroupImage,
    creatingGroup,
    joiningGroup,
    inviteCode,
    isPrivateSelected,
    isPublicSelected,
    overview,
    setShowCreate,
    setShowJoin,
    setNewGroupName,
    setNewGroupVisibility,
    setInviteCode,
    onRefresh,
    pickGroupImage,
    createGroup,
    joinGroup,
  };
}
