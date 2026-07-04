import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    Share,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import {
    ChartColumn,
    Copy,
    Crown,
    Search,
    Share2,
    Swords,
    Target,
    Trophy,
    Users,
    Zap,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

import { useTranslation } from '../../src/i18n';
import { useCoins } from '../../contexts/CoinsContext';
import { toastManager } from '../../services/toastManager';
import { type PredictionGroupDetails } from '../../services/predictionGroups.service';
import { PredictionsService, PredictionApiError } from '../../services/predictions.service';
import { buildGroupInviteShareUrl } from '../../constants/shareLinks';
import { AuthService, FollowService } from '../../src/services/authService';
import { useGroupDetails } from '../../hooks/groups/useGroupDetails';
import { groupViewStyles as styles } from '../../styles/groups/groupView.styles';
import { GROUP_COLORS } from '../../styles/groups/colors';
import { GroupsHeader } from '../../components/groups/GroupsHeader';

type Variant = 'details' | 'ranking' | 'round';

interface FriendCandidate {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
}

function normalizePredictionLabel(
    value: PredictionGroupDetails['upcomingRoundMatches'][number]['myPrediction'],
    t: ReturnType<typeof useTranslation>['t'],
): string {
    if (!value) return t.groups.noPrediction;
    if (value === 'home') return t.groups.predictionHome;
    if (value === 'away') return t.groups.predictionAway;
    return t.groups.predictionDraw;
}

export function GroupViewScreen({ variant }: { variant: Variant }) {
    const { t, isRTL } = useTranslation();
    const { getToken } = useAuth();
    const { coins } = useCoins();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ groupId?: string | string[] }>();
    const rawGroupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
    const groupId = rawGroupId || '';

    const {
        loading,
        refreshing,
        details,
        onRefresh,
    } = useGroupDetails({
        groupId,
        errorTitle: t.common.error,
        errorMessage: t.groups.groupActionFailed,
    });
    const [friendsVisible, setFriendsVisible] = useState(false);
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [friends, setFriends] = useState<FriendCandidate[]>([]);
    const [friendSearch, setFriendSearch] = useState('');
    const [scoreInputs, setScoreInputs] = useState<Record<number, { home: string; away: string }>>({});
    const [submittingMatchId, setSubmittingMatchId] = useState<number | null>(null);
    const didLoadFriendsRef = useRef(false);
    const shareInviteLink = useCallback(async () => {
        if (!details?.group.inviteCode) return;
        const url = buildGroupInviteShareUrl(details.group.inviteCode);
        await Share.share({
            title: details.group.name,
            message: `${t.groups.shareGroupMessage.replace('{group}', details.group.name)}\n${url}`,
        });
    }, [details?.group.inviteCode, details?.group.name, t.groups.shareGroupMessage]);

    const loadFriends = useCallback(async () => {
        const token = await getToken();
        if (!token) return;

        try {
            setFriendsLoading(true);
            const me = await AuthService.syncUserWithBackend(token);
            if (!me?.id) return;
            const following = await FollowService.getFollowing(token, me.id, 100, 0);
            setFriends((following || []).map((item: any) => ({
                id: String(item.id),
                username: item.username,
                displayName: item.displayName,
                avatar: item.avatar,
            })));
        } catch {
            toastManager.showError(t.common.error, t.groups.friendsLoadFailed);
        } finally {
            setFriendsLoading(false);
        }
    }, [getToken, t.common.error, t.groups.friendsLoadFailed]);

    const openFriendsModal = useCallback(async () => {
        setFriendsVisible(true);
        if (didLoadFriendsRef.current) return;
        didLoadFriendsRef.current = true;
        await loadFriends();
    }, [loadFriends]);

    const filteredFriends = useMemo(() => {
        const q = friendSearch.trim().toLowerCase();
        if (!q) return friends;
        return friends.filter((item) => {
            const display = `${item.displayName || ''} ${item.username || ''}`.toLowerCase();
            return display.includes(q);
        });
    }, [friendSearch, friends]);

    const inviteFriend = useCallback(async (friend: FriendCandidate) => {
        if (!details?.group.inviteCode) return;
        const url = buildGroupInviteShareUrl(details.group.inviteCode);
        await Share.share({
            title: details.group.name,
            message: `${t.groups.inviteFriendMessage.replace('{name}', friend.displayName || friend.username)}\n${url}`,
        });
    }, [details?.group.inviteCode, details?.group.name, t.groups.inviteFriendMessage]);

    const overview = useMemo(() => {
        const currentUser = details?.summary.currentUser;
        return {
            accuracy: currentUser?.totalAccuracy ?? 0,
            correctMatches: currentUser?.totalCorrect ?? 0,
            totalMembers: details?.group.membersCount ?? 0,
            myRank: details?.summary.userInsight.rank ?? '-',
            myPoints: currentUser?.totalPoints ?? 0,
        };
    }, [details]);

    const rows = useMemo(() => {
        if (!details) return [];
        if (variant === 'ranking') return details.summary.tabs.overall;
        return [];
    }, [details, variant]);

    const getInputScore = useCallback((fixtureId: number, side: 'home' | 'away') => {
        return scoreInputs[fixtureId]?.[side] ?? '';
    }, [scoreInputs]);

    const setInputScore = useCallback((fixtureId: number, side: 'home' | 'away', value: string) => {
        const digitsOnly = value.replace(/[^0-9]/g, '').slice(0, 2);
        setScoreInputs((prev) => ({
            ...prev,
            [fixtureId]: {
                home: side === 'home' ? digitsOnly : (prev[fixtureId]?.home ?? ''),
                away: side === 'away' ? digitsOnly : (prev[fixtureId]?.away ?? ''),
            },
        }));
    }, []);

    const submitScorePrediction = useCallback(async (match: PredictionGroupDetails['upcomingRoundMatches'][number]) => {
        if (submittingMatchId) return;

        if (match.myPrediction || !match.canSubmitPrediction || match.isFinished) {
            return;
        }

        const home = getInputScore(match.fixtureId, 'home');
        const away = getInputScore(match.fixtureId, 'away');
        if (!home || !away) {
            toastManager.showError(t.common.error, t.common.fillAllFields);
            return;
        }

        const homeNum = Number.parseInt(home, 10);
        const awayNum = Number.parseInt(away, 10);
        const predictionType: 'home' | 'draw' | 'away' = homeNum > awayNum ? 'home' : homeNum < awayNum ? 'away' : 'draw';

        const token = await getToken();
        if (!token) {
            toastManager.showError(t.common.error, t.toastManager.authErrorMessage);
            return;
        }

        try {
            setSubmittingMatchId(match.fixtureId);
            await PredictionsService.submitPrediction(token, {
                apiMatchId: String(match.fixtureId),
                predictionType,
                homeTeam: match.homeTeamName,
                awayTeam: match.awayTeamName,
                matchDate: match.matchDate,
                predictedHomeScore: homeNum,
                predictedAwayScore: awayNum,
            });
            toastManager.showSuccess(t.toastManager.predictionSavedTitle, t.toastManager.predictionSavedMessage);
            await onRefresh();
        } catch (error: any) {
            if (error instanceof PredictionApiError && error.code === 'E005') {
                toastManager.showError(t.toastManager.predictionFailedTitle, t.groups.noPrediction);
            } else {
                toastManager.showError(t.toastManager.predictionFailedTitle, t.toastManager.predictionFailedMessage);
            }
        } finally {
            setSubmittingMatchId(null);
        }
    }, [getInputScore, getToken, onRefresh, submittingMatchId, t]);

    if (loading || !details) {
        return (
            <View style={[styles.root, styles.centered]}>
                <ActivityIndicator color={GROUP_COLORS.accent} />
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <ScrollView
                contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 120, paddingHorizontal: 16 }}
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
                    <View style={styles.heroTopCentered}>
                        <View style={styles.heroAvatarWrap}>
                            {details.group.imageUrl ? (
                                <Image
                                    source={{ uri: details.group.imageUrl }}
                                    style={styles.heroAvatar}
                                />
                            ) : (
                                <View style={styles.heroAvatar}>
                                    <Users size={30} color="#C98BFF" />
                                </View>
                            )}

                            <View style={styles.heroBadge}>
                                <Crown size={14} color="#2A1600" fill="#2A1600" />
                            </View>
                        </View>

                        <Text
                            numberOfLines={1}
                            style={[
                                styles.heroTitle,
                                {
                                    textAlign: 'center',
                                    marginTop: 12,
                                },
                            ]}
                        >
                            {details.group.name}
                        </Text>

                        <Text
                            style={[
                                styles.heroSub,
                                {
                                    textAlign: 'center',
                                    marginTop: 2,
                                },
                            ]}
                        >
                            {t.groups.membersCountLabel.replace(
                                '{count}',
                                String(details.group.membersCount),
                            )}
                        </Text>
                    </View>

                    <View style={[styles.heroButtonsRow, isRTL && styles.rowReverse]}>
                        <Pressable style={styles.primaryButton} onPress={() => void openFriendsModal()}>
                            <Users size={16} color="#fff" />
                            <Text style={styles.primaryButtonText}>{t.groups.inviteFriend}</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryButton} onPress={() => void shareInviteLink()}>
                            <Share2 size={16} color="#D8B4FE" />
                            <Text style={styles.secondaryButtonText}>{t.groups.share}</Text>
                        </Pressable>
                    </View>
                </View>

                <View style={styles.codeCard}>
                    <Text style={[styles.codeLabel, isRTL && styles.rtlText]}>{t.groups.groupCodeLabel}</Text>
                    <View style={[styles.codeRow, isRTL && styles.rowReverse]}>
                        <Text style={styles.codeValue}>{details.group.inviteCode}</Text>
                        <Pressable
                            style={styles.copyChip}
                            onPress={async () => {
                                await Clipboard.setStringAsync(details.group.inviteCode);
                                toastManager.showSuccess(t.toastManager.successTitle, t.groups.copyInviteSuccess);
                            }}
                        >
                            <Text style={styles.copyChipText}>{t.groups.copyCode}</Text>
                            <Copy size={14} color="#D8B4FE" />
                        </Pressable>
                    </View>
                </View>

                {variant === 'details' ? (
                    <>
                        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t.groups.groupStatsTitle}</Text>
                        <View style={styles.infoGrid}>
                            <View style={styles.infoCard}>
                                <ChartColumn size={16} color="#A855F7" />
                                <Text style={styles.infoLabel}>{t.groups.accuracyLabel}</Text>
                                <Text style={[styles.infoValue, { color: "#A855F7" }]}>
                                    {overview.accuracy}%
                                </Text>
                            </View>

                            <View style={styles.infoCard}>
                                <Target size={16} color={GROUP_COLORS.successMint} />
                                <Text style={styles.infoLabel}>{t.groups.correctMatchesLabel}</Text>
                                <Text style={[styles.infoValue, { color: GROUP_COLORS.successMint }]}>
                                    {overview.correctMatches}
                                </Text>
                            </View>

                            <View style={styles.infoCard}>
                                <Trophy size={16} color="#F59E0B" />
                                <Text style={styles.infoLabel}>{t.groups.bestRank}</Text>
                                <Text style={[styles.infoValue, { color: GROUP_COLORS.accentAmber }]}>
                                    #{overview.myRank}
                                </Text>
                            </View>

                            <View style={styles.infoCard}>
                                <Zap size={16} color="#FBBF24" />
                                <Text style={[styles.infoLabel]}>{t.groups.myPoints}</Text>
                                <Text style={[styles.infoValue, { color: GROUP_COLORS.warningGold }]}>
                                    {overview.myPoints}
                                </Text>
                            </View>                       </View>

                        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t.groups.membersTitle}</Text>
                        <View style={styles.membersWrap}>
                            {details.summary.leaderboard.map((member, index) => {
                                const isOwner = index === 0;
                                const isMe = details.summary.currentUser?.userId === member.userId;
                                return (
                                    <View key={member.userId} style={[styles.memberCard, isRTL && styles.rowReverse]}>
                                        <View style={[styles.memberAvatar, isOwner && styles.ownerAvatar]}>
                                            <Text style={styles.memberAvatarText}>{(member.displayName || member.username).slice(0, 1).toUpperCase()}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={[styles.memberNameRow, isRTL && styles.rowReverse]}>
                                                <Text style={[styles.memberName, isRTL && styles.rtlText]}>{isMe ? t.groups.youLabel : (member.displayName || member.username)}</Text>
                                                {isOwner ? <Crown size={14} color="#FBBF24" /> : null}
                                            </View>
                                            <Text style={[styles.memberRole, isRTL && styles.rtlText]}>{isOwner ? t.groups.groupOwner : t.groups.groupMember}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </>
                ) : null}

                {variant === 'ranking' ? (
                    <>
                        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t.groups.rankingTitle}</Text>
                        <View style={styles.podiumCard}>
                            <View style={[styles.podiumRow, isRTL && styles.rowReverse]}>
                                {details.summary.leaderboard.slice(0, 3).map((member, index) => (
                                    <View key={member.userId} style={[styles.podiumItem, { marginTop: index === 0 ? 14 : index === 1 ? 34 : 22 }]}>
                                        <View style={[styles.podiumCircle, index === 0 && styles.podiumCirclePrimary]}>
                                            <Text style={styles.podiumText}>{(member.displayName || member.username).slice(0, 1).toUpperCase()}</Text>
                                        </View>
                                        <Text style={styles.podiumName}>{member.displayName || member.username}</Text>
                                        <View style={[styles.podiumBase, { height: index === 0 ? 110 : index === 1 ? 84 : 96 }]}>
                                            <Text style={styles.podiumRank}>{member.rank}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>

                        <View style={styles.tableHead}><Text style={styles.tableHeadText}>#</Text><Text style={styles.tableHeadText}>{t.groups.groupNameLabel}</Text><Text style={styles.tableHeadText}>{t.groups.correctMatchesLabel}</Text><Text style={styles.tableHeadText}>{t.groups.accuracyLabel}</Text><Text style={styles.tableHeadText}>{t.groups.myPoints}</Text></View>
                        {rows.map((item) => (
                            <View key={item.userId} style={[styles.rankCard, isRTL && styles.rowReverse]}>
                                <View style={styles.rankBadge}><Text style={styles.rankBadgeText}>{item.rank}</Text></View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.rankName, isRTL && styles.rtlText]}>{item.displayName || item.username}</Text>
                                    <Text style={[styles.rankSub, isRTL && styles.rtlText]}>{t.groups.membersCountLabel.replace('{count}', String(details.group.membersCount))}</Text>
                                </View>
                                <Text style={styles.rankMetricStrong}>{item.totalCorrect}</Text>
                                <Text style={styles.rankMetric}>{item.totalAccuracy}%</Text>
                                <Text style={styles.rankMetricStrong}>{item.totalPoints}</Text>
                            </View>
                        ))}
                    </>
                ) : null}

                {variant === 'round' ? (
                    <>
                        <View style={[styles.roundHeader, isRTL && styles.rowReverse]}>
                            <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t.groups.roundTitle}</Text>
                            <Pressable onPress={() => router.push({ pathname: '/matches', params: { filter: 'Predictions' } } as never)}>
                                <Text style={styles.roundLink}>{t.groups.openPredictions}</Text>
                            </Pressable>
                        </View>
                        {details.upcomingRoundMatches.map((match) => (
                            <View key={match.fixtureId} style={styles.matchCard}>
                                <View style={[styles.matchTop, isRTL && styles.rowReverse]}>
                                    <Text style={styles.matchTime}>{new Date(match.matchDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                    <View style={styles.matchPillsRow}>
                                        <View style={styles.pillMuted}><Text style={styles.pillMutedText}>{t.groups.winnerPointsHint}</Text></View>
                                        <View style={styles.pillPrimary}><Text style={styles.pillPrimaryText}>{t.groups.precisePredictionHint}</Text></View>
                                    </View>
                                </View>
                                <View style={[styles.teamsRow, isRTL && styles.rowReverse]}>
                                    <View style={styles.teamBlock}><View style={styles.teamDotA} /><Text style={[styles.teamName, isRTL && styles.rtlText]}>{match.homeTeamName}</Text></View>
                                    <View style={styles.scoreRow}>
                                        <View style={styles.scoreBall}><Text style={styles.scoreBallText}>{match.isFinished ? String(match.homeScore ?? '-') : '-'}</Text></View>
                                        <View style={styles.scoreBall}><Text style={styles.scoreBallText}>{match.isFinished ? String(match.awayScore ?? '-') : '-'}</Text></View>
                                    </View>
                                    <View style={styles.teamBlock}><View style={styles.teamDotB} /><Text style={[styles.teamName, isRTL && styles.rtlText]}>{match.awayTeamName}</Text></View>
                                </View>
                                <View style={[styles.predFooter, isRTL && styles.rowReverse]}><Swords size={14} color="#A78BFA" /><Text style={[styles.predFooterText, isRTL && styles.rtlText]}>{t.groups.myPrediction}: {normalizePredictionLabel(match.myPrediction, t)}</Text></View>
                                {!match.isFinished ? (
                                    <View style={{ marginTop: 10, gap: 8 }}>
                                        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
                                            <TextInput
                                                style={{ flex: 1, borderWidth: 1, borderColor: 'rgba(168,85,247,0.32)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', textAlign: 'center' }}
                                                keyboardType="number-pad"
                                                value={getInputScore(match.fixtureId, 'home')}
                                                onChangeText={(value) => setInputScore(match.fixtureId, 'home', value)}
                                                editable={!match.myPrediction && match.canSubmitPrediction && !match.isFinished}
                                                placeholder="0"
                                                placeholderTextColor="rgba(255,255,255,0.35)"
                                            />
                                            <TextInput
                                                style={{ flex: 1, borderWidth: 1, borderColor: 'rgba(168,85,247,0.32)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', textAlign: 'center' }}
                                                keyboardType="number-pad"
                                                value={getInputScore(match.fixtureId, 'away')}
                                                onChangeText={(value) => setInputScore(match.fixtureId, 'away', value)}
                                                editable={!match.myPrediction && match.canSubmitPrediction && !match.isFinished}
                                                placeholder="0"
                                                placeholderTextColor="rgba(255,255,255,0.35)"
                                            />
                                        </View>
                                        {match.myPrediction ? (
                                            <Text style={[styles.predFooterText, isRTL && styles.rtlText]}>
                                                {t.groups.myPrediction}: {normalizePredictionLabel(match.myPrediction, t)}
                                            </Text>
                                        ) : null}
                                        {!match.myPrediction && !match.canSubmitPrediction ? (
                                            <Text style={[styles.predFooterText, isRTL && styles.rtlText]}>
                                                {t.predictions.cannotPredictLive}
                                            </Text>
                                        ) : null}
                                        <Pressable
                                            onPress={() => void submitScorePrediction(match)}
                                            disabled={
                                                submittingMatchId === match.fixtureId
                                                || Boolean(match.myPrediction)
                                                || !match.canSubmitPrediction
                                                || match.isFinished
                                            }
                                            style={{
                                                borderRadius: 12,
                                                paddingVertical: 11,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: GROUP_COLORS.accent,
                                                opacity: (
                                                    submittingMatchId === match.fixtureId
                                                    || Boolean(match.myPrediction)
                                                    || !match.canSubmitPrediction
                                                    || match.isFinished
                                                ) ? 0.55 : 1,
                                            }}
                                        >
                                            <Text style={{ color: '#fff', fontWeight: '800' }}>
                                                {match.myPrediction
                                                    ? t.predictions.cannotPredictLive
                                                    : (submittingMatchId === match.fixtureId ? t.common.loading : t.predictions.submitPrediction)}
                                            </Text>
                                        </Pressable>
                                    </View>
                                ) : null}
                                {match.isFinished ? (
                                    <View style={{ marginTop: 10, gap: 6 }}>
                                        {match.predictions.length === 0 ? (
                                            <Text style={[styles.predFooterText, isRTL && styles.rtlText]}>{t.groups.noPrediction}</Text>
                                        ) : match.predictions.map((memberPrediction) => (
                                        <View
                                            key={`${match.fixtureId}-${memberPrediction.userId}`}
                                            style={{
                                                flexDirection: isRTL ? 'row-reverse' : 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                borderWidth: 1,
                                                borderColor: 'rgba(168, 85, 247, 0.25)',
                                                borderRadius: 12,
                                                paddingHorizontal: 10,
                                                paddingVertical: 8,
                                                backgroundColor: 'rgba(255,255,255,0.03)',
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: memberPrediction.isCurrentUser ? '#FBBF24' : '#EDE9FE',
                                                    fontWeight: memberPrediction.isCurrentUser ? '700' : '600',
                                                    flexShrink: 1,
                                                    textAlign: isRTL ? 'right' : 'left',
                                                }}
                                            >
                                                {memberPrediction.isCurrentUser
                                                    ? t.groups.youLabel
                                                    : (memberPrediction.displayName || memberPrediction.username)}
                                            </Text>
                                            <Text style={{ color: '#C4B5FD', fontWeight: '700' }}>
                                                {memberPrediction.predictedHomeScore !== null && memberPrediction.predictedAwayScore !== null
                                                    ? `${memberPrediction.predictedHomeScore}-${memberPrediction.predictedAwayScore}`
                                                    : normalizePredictionLabel(memberPrediction.prediction, t)}
                                            </Text>
                                        </View>
                                    ))}
                                    </View>
                                ) : null}
                            </View>
                        ))}
                    </>
                ) : null}
            </ScrollView>

            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                <View style={[styles.bottomTabs, isRTL && styles.rowReverse]}>
                    <Pressable style={[styles.bottomTab, variant === 'ranking' && styles.bottomTabActive]} onPress={() => router.replace({ pathname: '/groups/[groupId]/ranking', params: { groupId } })}>
                        <Trophy size={16} color={variant === 'ranking' ? '#fff' : '#A78BFA'} />
                        <Text style={[styles.bottomTabText, variant === 'ranking' && styles.bottomTabTextActive]}>{t.groups.rankingTitle}</Text>
                    </Pressable>
                    <Pressable style={[styles.bottomTab, variant === 'round' && styles.bottomTabActive]} onPress={() => router.replace({ pathname: '/groups/[groupId]/round', params: { groupId } })}>
                        <Swords size={16} color={variant === 'round' ? '#fff' : '#A78BFA'} />
                        <Text style={[styles.bottomTabText, variant === 'round' && styles.bottomTabTextActive]}>{t.groups.roundNavLabel}</Text>
                    </Pressable>
                    <Pressable style={[styles.bottomTab, variant === 'details' && styles.bottomTabActive]} onPress={() => router.replace({ pathname: '/groups/[groupId]', params: { groupId } })}>
                        <Users size={16} color={variant === 'details' ? '#fff' : '#A78BFA'} />
                        <Text style={[styles.bottomTabText, variant === 'details' && styles.bottomTabTextActive]}>{t.groups.openFromRank}</Text>
                    </Pressable>
                </View>
            </View>

            <Modal visible={friendsVisible} transparent animationType="slide" onRequestClose={() => setFriendsVisible(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.sheetHandle} />
                        <Pressable style={styles.closeBtn} onPress={() => setFriendsVisible(false)}><Text style={styles.closeBtnText}>×</Text></Pressable>
                        <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>{t.groups.inviteFriend}</Text>
                        <View style={[styles.searchBox, isRTL && styles.rowReverse]}>
                            <Search size={16} color={GROUP_COLORS.accentSoft} />
                            <TextInput
                                style={[styles.searchInput, isRTL && styles.rtlText]}
                                value={friendSearch}
                                onChangeText={setFriendSearch}
                                placeholder={t.groups.searchFriendPlaceholder}
                                placeholderTextColor="rgba(255,255,255,0.35)"
                                textAlign={isRTL ? 'right' : 'left'}
                            />
                        </View>
                        {friendsLoading ? (
                            <ActivityIndicator color={GROUP_COLORS.accent} style={{ marginTop: 24 }} />
                        ) : filteredFriends.length === 0 ? (
                            <Text style={[styles.emptyModalText, isRTL && styles.rtlText]}>{friends.length === 0 ? t.groups.noFriendsToInvite : t.groups.noFriendsFound}</Text>
                        ) : (
                            <FlatList
                                data={filteredFriends}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <View style={[styles.friendRow, isRTL && styles.rowReverse]}>
                                        <Pressable style={styles.friendInviteBtn} onPress={() => void inviteFriend(item)}>
                                            <Text style={styles.friendInviteText}>{t.groups.inviteButton}</Text>
                                        </Pressable>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.friendName, isRTL && styles.rtlText]}>{item.displayName || item.username}</Text>
                                            <Text style={[styles.friendSub, isRTL && styles.rtlText]}>@{item.username}</Text>
                                        </View>
                                        <View style={styles.friendAvatar}><Text style={styles.friendAvatarText}>{(item.displayName || item.username).slice(0, 1).toUpperCase()}</Text></View>
                                    </View>
                                )}
                                contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

