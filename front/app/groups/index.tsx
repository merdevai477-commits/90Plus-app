import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Plus, Trophy, Users, Zap } from 'lucide-react-native';
import { Crown } from 'lucide-react-native';

import { useTranslation } from '../../src/i18n';
import { useCoins } from '../../contexts/CoinsContext';
import { useGroupsHome } from '../../hooks/groups/useGroupsHome';
import { GroupsHeader } from '../../components/groups/GroupsHeader';
import { groupsHomeStyles as styles } from '../../styles/groups/groupsHome.styles';
import { GROUP_COLORS } from '../../styles/groups/colors';

export default function GroupsHomeScreen() {
  const { t, isRTL } = useTranslation();
  const { coins } = useCoins();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
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
  } = useGroupsHome({
    errorTitle: t.common.error,
    warningTitle: t.common.warning,
    groupActionFailedMessage: t.groups.groupActionFailed,
    invalidInviteCodeMessage: t.groups.invalidInviteCode,
    alreadyMemberMessage: t.groups.alreadyMember,
  });

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={GROUP_COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GROUP_COLORS.accent} />}
      >
        <GroupsHeader
          isRTL={isRTL}
          title={t.groups.title}
          subtitle={t.groups.subtitle}
          coins={coins}
          onBack={() => router.back()}
          styles={styles}
        />

        <View style={styles.heroCard}>
          <View style={styles.heroIconWrapper}>
            <View style={styles.heroBadge}>
              <Crown size={14} color="#4A2B00" fill="#4A2B00" />
            </View>
            <View style={styles.heroIcon}>
              <Users size={34} color="#C78DFF" />
            </View>
          </View>
          <Text style={[styles.heroText, isRTL && styles.rtlText]}>{t.groups.emptyBody}</Text>
        </View>

        <Pressable style={[styles.actionCard, styles.createCard]} onPress={() => setShowCreate(true)}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, isRTL && styles.rtlText]}>{t.groups.createModalTitle}</Text>
            <Text style={[styles.actionSub, isRTL && styles.rtlText]}>{t.groups.createGroupHint}</Text>
          </View>
          <View style={styles.actionIcon}><Users size={18} color="#E8D5FF" /></View>
        </Pressable>

        <Pressable style={[styles.actionCard, styles.joinCard]} onPress={() => setShowJoin(true)}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, isRTL && styles.rtlText]}>{t.groups.joinModalTitle}</Text>
            <Text style={[styles.actionSub, isRTL && styles.rtlText]}>{t.groups.joinGroupHint}</Text>
          </View>
          <View style={styles.actionIcon}><Plus size={18} color="#FFD89A" /></View>
        </Pressable>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Users size={16} color="#7E3AF2" />
            <Text style={[styles.statValue, { color: '#7E3AF2' }]}>{overview.groupsCount}</Text>
            <Text style={[styles.statLabel, isRTL && styles.rtlText]}>{t.groups.myGroups}</Text>
          </View>
          <View style={[styles.statCard, styles.statCardHighlighted]}>
            <Trophy size={16} color={GROUP_COLORS.accentAmber} />
            <Text style={styles.statValue}>{overview.bestRank}</Text>
            <Text style={[styles.statLabel, isRTL && styles.rtlText]}>{t.groups.bestRank}</Text>
          </View>
          <View style={styles.statCard}>
            <Zap size={16} color={GROUP_COLORS.successMint} />
            <Text style={styles.statValue}>{overview.myPoints}</Text>
            <Text style={[styles.statLabel, isRTL && styles.rtlText]}>{t.groups.myPoints}</Text>
          </View>
        </View>

        {groups.length > 0 ? (
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t.groups.myGroups}</Text>
            {groups.map((group) => (
              <Pressable key={group.id} style={styles.groupCard} onPress={() => router.push({ pathname: '/groups/[groupId]', params: { groupId: group.id } })}>
                <View style={[styles.groupCardRow, isRTL && styles.rowReverse]}>
                  <View style={styles.groupAvatar}><Users size={16} color="#D8B4FE" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.groupName, isRTL && styles.rtlText]}>{group.name}</Text>
                    <Text style={[styles.groupSub, isRTL && styles.rtlText]}>{t.groups.membersCountLabel.replace('{count}', String(group.membersCount))}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView style={styles.keyboardAvoidWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheetCard}>
              <View style={styles.sheetHandle} />
              <Pressable style={styles.closeBtn} onPress={() => setShowCreate(false)}><Text style={styles.closeBtnText}>x</Text></Pressable>
              <Text style={[styles.sheetTitle, isRTL && styles.rtlText]}>{t.groups.createModalTitle}</Text>
              <Pressable style={styles.imageUploadBox} onPress={() => void pickGroupImage()}>
                <Camera size={22} color="#A78BFA" />
                <Text style={styles.imageUploadText}>{newGroupImage ? t.groups.changeImage : t.groups.uploadImage}</Text>
              </Pressable>
              <Text style={[styles.fieldLabel, isRTL && styles.rtlText]}>{t.groups.groupNameLabel}</Text>
              <TextInput
                style={[styles.sheetInput, isRTL && styles.rtlText]}
                value={newGroupName}
                onChangeText={setNewGroupName}
                placeholder={t.groups.groupNameExample}
                placeholderTextColor="rgba(255,255,255,0.4)"
                textAlign={isRTL ? 'right' : 'left'}
              />
              <View style={[styles.visibilityRow, isRTL && styles.rowReverse]}>
                <Pressable style={[styles.visibilityChip, isPrivateSelected && styles.visibilityChipActive]} onPress={() => setNewGroupVisibility('PRIVATE')}>
                  <Text style={[styles.visibilityText, isPrivateSelected && styles.visibilityTextActive]}>{t.groups.privateType}</Text>
                </Pressable>
                <Pressable style={[styles.visibilityChip, isPublicSelected && styles.visibilityChipActive]} onPress={() => setNewGroupVisibility('PUBLIC')}>
                  <Text style={[styles.visibilityText, isPublicSelected && styles.visibilityTextActive]}>{t.groups.publicType}</Text>
                </Pressable>
              </View>
              <Pressable style={[styles.submitBtn, creatingGroup && styles.submitBtnDisabled]} onPress={() => void createGroup()} disabled={creatingGroup}>
                <Text style={styles.submitBtnText}>{creatingGroup ? t.common.loading : t.groups.create}</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showJoin} transparent animationType="slide" onRequestClose={() => setShowJoin(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView style={styles.keyboardAvoidWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheetCard}>
              <View style={styles.sheetHandle} />
              <Pressable style={styles.closeBtn} onPress={() => setShowJoin(false)}><Text style={styles.closeBtnText}>x</Text></Pressable>
              <Text style={[styles.sheetTitle, isRTL && styles.rtlText]}>{t.groups.joinModalTitle}</Text>
              <TextInput
                style={[styles.sheetInput, isRTL && styles.rtlText]}
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="characters"
                placeholder={t.groups.inviteCodePlaceholder}
                placeholderTextColor="rgba(255,255,255,0.4)"
                textAlign={isRTL ? 'right' : 'left'}
              />
              <Pressable style={[styles.submitBtn, joiningGroup && styles.submitBtnDisabled]} onPress={() => void joinGroup()} disabled={joiningGroup}>
                <Text style={styles.submitBtnText}>{joiningGroup ? t.common.loading : t.groups.join}</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
