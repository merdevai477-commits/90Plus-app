import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Dimensions,
    Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Check, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { COLORS } from '../components/reels/constants';
import { CLUBS } from '../data/clubs';
import { COUNTRIES } from '../data/countries';
import { LEAGUES } from '../data/leagues';
import { useAuth } from '@clerk/clerk-expo';
import { getApiUrl } from '../config/api.config';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    FadeIn,
} from 'react-native-reanimated';
import { globalState } from '../globalState';
import { useTranslation } from '../src/i18n';
import { clubLogoService } from '../services/clubLogoService';
import { useSettings } from '../contexts/SettingsContext';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 48) / 3;

type Step = 'club' | 'country' | 'leagues';

export default function OnboardingScreen() {
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>('club');
    const [selectedClub, setSelectedClub] = useState<string | null>(null);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedLeagues, setSelectedLeagues] = useState<number[]>([]);

    const { getToken } = useAuth();
    const { addFavoriteLeague } = useSettings();
    const progress = useSharedValue(0.33);

    useEffect(() => {
        const stepProgress = { club: 0.33, country: 0.66, leagues: 1 };
        progress.value = withSpring(stepProgress[step], { damping: 15 });
    }, [step]);

    const handleNext = useCallback(async () => {
        try {
            if (step === 'club' && selectedClub) {
                setStep('country');
            } else if (step === 'country' && selectedCountry) {
                setStep('leagues');
            } else if (step === 'leagues' && selectedLeagues.length >= 3) {
                try {
                    const token = await getToken();
                    if (!token) {
                        Alert.alert(
                            t.onboardingFlow.authError,
                            t.onboardingFlow.pleaseLoginAgain,
                            [{ text: t.onboardingFlow.okay, onPress: () => router.replace('/auth/login') }],
                        );
                        return;
                    }

                    await savePreferences();

                    for (const leagueId of selectedLeagues) {
                        await addFavoriteLeague(leagueId);
                    }

                    try {
                        globalState.setUserType('diamond');
                    } catch (stateError) {
                        console.error('Error updating global state:', stateError);
                    }

                    try {
                        router.replace('/(tabs)/matches');
                    } catch (navError) {
                        router.push('/(tabs)/matches');
                    }
                } catch (error) {
                    console.error('Save preferences error:', error);
                    Alert.alert(t.common.error, t.onboardingFlow.saveError, [
                        { text: t.onboardingFlow.retry, onPress: () => handleNext() },
                        {
                            text: t.onboardingFlow.skip,
                            onPress: () => {
                                try {
                                    router.replace('/(tabs)/matches');
                                } catch {
                                    router.push('/(tabs)/matches');
                                }
                            },
                            style: 'cancel',
                        },
                    ]);
                }
            }
        } catch (error) {
            console.error('Unexpected error in handleNext:', error);
            Alert.alert(t.onboardingFlow.unexpectedError, t.onboardingFlow.unexpectedErrorMessage, [
                {
                    text: t.onboardingFlow.okay,
                    onPress: () => {
                        try {
                            router.replace('/(tabs)/matches');
                        } catch {
                            router.push('/(tabs)/matches');
                        }
                    },
                },
            ]);
        }
    }, [step, selectedClub, selectedCountry, selectedLeagues, addFavoriteLeague, getToken, t]);

    const handleBack = useCallback(() => {
        if (step === 'country') setStep('club');
        else if (step === 'leagues') setStep('country');
    }, [step]);

    const toggleLeague = useCallback((leagueId: number) => {
        setSelectedLeagues(prev =>
            prev.includes(leagueId) ? prev.filter(id => id !== leagueId) : [...prev, leagueId],
        );
    }, []);

    const savePreferences = async () => {
        const token = await getToken();
        if (!token) throw new Error('No authentication token available');

        const clubData = CLUBS.find(c => c.name === selectedClub);
        const countryData = COUNTRIES.find(c => c.id === selectedCountry);

        let realClubLogo: string | null = null;
        try {
            if (clubData?.apiId) {
                realClubLogo = await Promise.race([
                    clubLogoService.getClubLogo(clubData.apiId),
                    new Promise<null>((_, reject) =>
                        setTimeout(() => reject(new Error('Club logo fetch timeout')), 5000),
                    ),
                ]).catch(() => null);
            }
        } catch (logoError) {
            console.warn('Failed to fetch club logo:', logoError);
        }

        const apiUrl = getApiUrl();
        if (!apiUrl) throw new Error('API URL not configured');

        const response = await fetch(`${apiUrl}/api/clerk/preferences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                favoriteTeam: selectedClub,
                country: selectedCountry,
                favoriteLeagues: selectedLeagues,
                clubLogo: realClubLogo || clubData?.logo || '',
                countryFlag: countryData?.flag,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Failed to save preferences: ${response.status} - ${errorText}`);
        }

        return await response.json();
    };

    const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

    const canProceed =
        step === 'club' ? !!selectedClub : step === 'country' ? !!selectedCountry : selectedLeagues.length >= 3;

    const titles: Record<Step, string> = {
        club: t.onboardingFlow.titleClub,
        country: t.onboardingFlow.titleCountry,
        leagues: t.onboardingFlow.titleLeagues,
    };

    const progressLabel =
        step === 'club' ? '1/3' : step === 'country' ? '2/3' : '3/3';

    const renderClubItem = useCallback(({ item }: { item: typeof CLUBS[0] }) => {
        const isSelected = selectedClub === item.name;
        return (
            <TouchableOpacity style={[styles.gridItem, isSelected && styles.selectedItem]} onPress={() => setSelectedClub(item.name)} activeOpacity={0.7}>
                {item.logo ? (
                    <Image source={{ uri: item.logo }} style={styles.itemLogo} contentFit="contain" />
                ) : (
                    <View style={[styles.itemLogoFallback, { backgroundColor: item.color || '#333' }]}>
                        <Text style={styles.itemLogoText}>{item.name.charAt(0)}</Text>
                    </View>
                )}
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                {isSelected && <View style={styles.checkBadge}><Check size={12} color="#000" strokeWidth={3} /></View>}
            </TouchableOpacity>
        );
    }, [selectedClub]);

    const renderCountryItem = useCallback(({ item }: { item: typeof COUNTRIES[0] }) => {
        const isSelected = selectedCountry === item.id;
        return (
            <TouchableOpacity style={[styles.countryItem, isSelected && styles.selectedItem]} onPress={() => setSelectedCountry(item.id)} activeOpacity={0.7}>
                <Text style={styles.countryFlag}>{item.flag}</Text>
                <Text style={styles.countryName}>{item.name}</Text>
                {isSelected && <View style={styles.checkBadgeSmall}><Check size={10} color="#000" strokeWidth={3} /></View>}
            </TouchableOpacity>
        );
    }, [selectedCountry]);

    const renderLeagueItem = useCallback(({ item }: { item: typeof LEAGUES[0] }) => {
        const isSelected = selectedLeagues.includes(item.id);
        return (
            <TouchableOpacity style={[styles.leagueItem, isSelected && styles.selectedItem]} onPress={() => toggleLeague(item.id)} activeOpacity={0.7}>
                <Image source={{ uri: item.logo }} style={styles.leagueLogo} />
                <View style={styles.leagueInfo}>
                    <Text style={styles.leagueName}>{item.nameAr}</Text>
                    <Text style={styles.leagueCountry}>{item.countryFlag} {item.country}</Text>
                </View>
                {isSelected && <View style={styles.checkBadge}><Check size={12} color="#000" strokeWidth={3} /></View>}
            </TouchableOpacity>
        );
    }, [selectedLeagues, toggleLeague]);

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient colors={['#000', '#0a1a0a', '#000']} style={StyleSheet.absoluteFill} />

            <View style={styles.progressContainer}>
                <View style={styles.progressBg}><Animated.View style={[styles.progressFill, progressStyle]} /></View>
                <Text style={styles.progressText}>{progressLabel}</Text>
            </View>

            <Animated.View entering={FadeIn.duration(200)} style={styles.header}>
                <Text style={styles.title}>{titles[step]}</Text>
                {step === 'leagues' && <Text style={styles.subtitle}>{t.onboardingFlow.leaguesSelected.replace('{count}', String(selectedLeagues.length))}</Text>}
            </Animated.View>

            <View style={styles.content}>
                {step === 'club' && <FlatList data={CLUBS} renderItem={renderClubItem} keyExtractor={item => item.id} numColumns={3} showsVerticalScrollIndicator={false} contentContainerStyle={styles.gridContainer} removeClippedSubviews maxToRenderPerBatch={15} windowSize={5} />}
                {step === 'country' && <FlatList data={COUNTRIES} renderItem={renderCountryItem} keyExtractor={item => item.id} numColumns={2} showsVerticalScrollIndicator={false} contentContainerStyle={styles.gridContainer} removeClippedSubviews />}
                {step === 'leagues' && <FlatList data={LEAGUES} renderItem={renderLeagueItem} keyExtractor={item => item.id.toString()} showsVerticalScrollIndicator={false} contentContainerStyle={styles.leaguesContainer} removeClippedSubviews />}
            </View>

            <View style={styles.bottomButtons}>
                {step !== 'club' && (
                    <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
                        <ChevronLeft size={20} color="#fff" /><Text style={styles.backButtonText}>{t.onboardingFlow.back}</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.nextButton, !canProceed && styles.disabledButton]} onPress={handleNext} disabled={!canProceed} activeOpacity={0.8}>
                    <LinearGradient colors={canProceed ? ['#FFD700', '#FFA500'] : ['#333', '#222']} style={styles.nextButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={[styles.nextButtonText, !canProceed && styles.disabledText]}>{step === 'leagues' ? t.onboardingFlow.finish : t.onboardingFlow.next}</Text>
                        <ChevronRight size={20} color={canProceed ? '#000' : '#666'} />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    progressContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, gap: 12 },
    progressBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#FFD700', borderRadius: 3 },
    progressText: { color: '#888', fontSize: 14, fontWeight: '600' },
    header: { alignItems: 'center', paddingVertical: 20 },
    title: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
    subtitle: { fontSize: 14, color: '#FFD700', marginTop: 4, fontWeight: '600' },
    content: { flex: 1, paddingHorizontal: 12 },
    gridContainer: { paddingBottom: 20 },
    gridItem: { width: ITEM_SIZE, height: ITEM_SIZE, margin: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
    selectedItem: { borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.15)' },
    itemLogo: { width: 50, height: 50, borderRadius: 25 },
    itemLogoFallback: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    itemLogoText: { color: '#fff', fontSize: 20, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
    itemName: { color: '#fff', fontSize: 11, marginTop: 6, textAlign: 'center', fontWeight: '500' },
    checkBadge: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center' },
    checkBadgeSmall: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center' },
    countryItem: { width: (width - 40) / 2, flexDirection: 'row', alignItems: 'center', margin: 4, padding: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 2, borderColor: 'transparent', gap: 10 },
    countryFlag: { fontSize: 28 },
    countryName: { color: '#fff', fontSize: 15, flex: 1, fontWeight: '500' },
    leaguesContainer: { paddingBottom: 20 },
    leagueItem: { flexDirection: 'row', alignItems: 'center', padding: 14, marginVertical: 4, marginHorizontal: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 2, borderColor: 'transparent', gap: 12 },
    leagueLogo: { width: 44, height: 44, borderRadius: 22 },
    leagueInfo: { flex: 1 },
    leagueName: { color: '#fff', fontSize: 16, fontWeight: '600' },
    leagueCountry: { color: '#888', fontSize: 12, marginTop: 2 },
    bottomButtons: { flexDirection: 'row', padding: 16, paddingBottom: 30, gap: 12 },
    backButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', gap: 4 },
    backButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    nextButton: { flex: 2, borderRadius: 14, overflow: 'hidden' },
    nextButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6 },
    nextButtonText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
    disabledButton: { opacity: 0.5 },
    disabledText: { color: '#666' },
});
