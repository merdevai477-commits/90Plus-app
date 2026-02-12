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
import { BRANDS } from '../data/brands';
import { COUNTRIES } from '../data/countries';
import { LEAGUES } from '../data/leagues';
import { useAuth } from '@clerk/clerk-expo';
import { getApiUrl } from '../config/api.config';
import { clubLogoService } from '../services/clubLogoService';
import { brandLogoService } from '../services/brandLogoService';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    FadeIn,
} from 'react-native-reanimated';
import { globalState } from '../globalState';
import { useHomeStore } from '../src/store/home.store';
import { useSettings } from '../contexts/SettingsContext';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 48) / 3;

type Step = 'club' | 'brand' | 'country' | 'leagues';

export default function OnboardingScreen() {
    const [step, setStep] = useState<Step>('club');
    const [selectedClub, setSelectedClub] = useState<string | null>(null);
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedLeagues, setSelectedLeagues] = useState<number[]>([]);

    const { getToken } = useAuth();
    const { addFavoriteLeague } = useSettings();
    const progress = useSharedValue(0.25);

    useEffect(() => {
        const stepProgress = { club: 0.25, brand: 0.5, country: 0.75, leagues: 1 };
        progress.value = withSpring(stepProgress[step], { damping: 15 });
    }, [step]);

    const handleNext = useCallback(async () => {
        try {
            if (step === 'club' && selectedClub) {
                setStep('brand');
            } else if (step === 'brand' && selectedBrand) {
                setStep('country');
            } else if (step === 'country' && selectedCountry) {
                setStep('leagues');
            } else if (step === 'leagues' && selectedLeagues.length >= 3) {
                // Save preferences first, then navigate
                try {
                    // Validate token before proceeding
                    const token = await getToken();
                    if (!token) {
                        console.error('No auth token available');
                        Alert.alert(
                            'خطأ في المصادقة',
                            'يرجى تسجيل الدخول مرة أخرى',
                            [
                                { 
                                    text: 'حسناً', 
                                    onPress: () => router.replace('/auth')
                                }
                            ]
                        );
                        return;
                    }

                    await savePreferences();
                    
                    // Save favorite leagues to local settings
                    for (const leagueId of selectedLeagues) {
                        await addFavoriteLeague(leagueId);
                    }
                    
                    // Update global state safely
                    try {
                        globalState.setUserType('diamond');
                        useHomeStore.getState().setUserMode('diamond');
                    } catch (stateError) {
                        console.error('Error updating global state:', stateError);
                        // Continue anyway - state update is not critical
                    }
                    
                    // Navigate safely
                    try {
                        router.replace('/(tabs)/Home');
                    } catch (navError) {
                        console.error('Navigation error:', navError);
                        // Fallback navigation
                        router.push('/(tabs)/Home');
                    }
                } catch (error) {
                    console.error('Save preferences error:', error);
                    Alert.alert(
                        'خطأ',
                        'حدث خطأ أثناء حفظ التفضيلات. هل تريد المحاولة مرة أخرى؟',
                        [
                            { 
                                text: 'إعادة المحاولة', 
                                onPress: () => handleNext()
                            },
                            { 
                                text: 'تخطي', 
                                onPress: () => {
                                    try {
                                        router.replace('/(tabs)/Home');
                                    } catch (navError) {
                                        router.push('/(tabs)/Home');
                                    }
                                },
                                style: 'cancel'
                            }
                        ]
                    );
                }
            }
        } catch (error) {
            console.error('Unexpected error in handleNext:', error);
            Alert.alert(
                'خطأ غير متوقع',
                'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
                [
                    { 
                        text: 'حسناً',
                        onPress: () => {
                            // Safe fallback - go to home anyway
                            try {
                                router.replace('/(tabs)/Home');
                            } catch (navError) {
                                router.push('/(tabs)/Home');
                            }
                        }
                    }
                ]
            );
        }
    }, [step, selectedClub, selectedBrand, selectedCountry, selectedLeagues, addFavoriteLeague, getToken]);

    const handleBack = useCallback(() => {
        if (step === 'brand') setStep('club');
        else if (step === 'country') setStep('brand');
        else if (step === 'leagues') setStep('country');
    }, [step]);

    const toggleLeague = useCallback((leagueId: number) => {
        setSelectedLeagues(prev =>
            prev.includes(leagueId) ? prev.filter(id => id !== leagueId) : [...prev, leagueId]
        );
    }, []);

    // Save preferences to backend with comprehensive error handling
    const savePreferences = async () => {
        try {
            const token = await getToken();
            
            if (!token) {
                throw new Error('No authentication token available');
            }
            
            // Get the full club and brand objects to send logos
            const clubData = CLUBS.find(c => c.name === selectedClub);
            const brandData = BRANDS.find(b => b.name === selectedBrand);
            const countryData = COUNTRIES.find(c => c.id === selectedCountry);
            
            // Fetch real logos from external APIs with timeout
            let realClubLogo: string | null = null;
            let realBrandLogo: string | null = null;
            
            try {
                if (clubData?.apiId) {
                    realClubLogo = await Promise.race([
                        clubLogoService.fetchClubLogo(clubData.apiId),
                        new Promise<null>((_, reject) => 
                            setTimeout(() => reject(new Error('Club logo fetch timeout')), 5000)
                        )
                    ]).catch(() => null);
                }
            } catch (logoError) {
                console.warn('Failed to fetch club logo:', logoError);
                // Continue with default logo
            }
            
            try {
                if (brandData?.apiId) {
                    realBrandLogo = await Promise.race([
                        brandLogoService.fetchBrandLogo(brandData.apiId),
                        new Promise<null>((_, reject) => 
                            setTimeout(() => reject(new Error('Brand logo fetch timeout')), 5000)
                        )
                    ]).catch(() => null);
                }
            } catch (logoError) {
                console.warn('Failed to fetch brand logo:', logoError);
                // Continue with default logo
            }
            
            const apiUrl = getApiUrl();
            if (!apiUrl) {
                throw new Error('API URL not configured');
            }
            
            const response = await fetch(`${apiUrl}/api/clerk/preferences`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    favoriteTeam: selectedClub,
                    favoriteBrand: selectedBrand,
                    country: selectedCountry,
                    favoriteLeagues: selectedLeagues,
                    // Send real logos for profile card (or fallback to default)
                    clubLogo: realClubLogo || clubData?.logo || '',
                    brandLogo: realBrandLogo || brandData?.logo || '',
                    countryFlag: countryData?.flag,
                }),
            });
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`Failed to save preferences: ${response.status} - ${errorText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error in savePreferences:', error);
            throw error;
        }
    };

    const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

    const canProceed = step === 'club' ? !!selectedClub 
        : step === 'brand' ? !!selectedBrand 
        : step === 'country' ? !!selectedCountry 
        : selectedLeagues.length >= 3;

    const titles: Record<Step, string> = {
        club: 'اختر ناديك المفضل ⚽',
        brand: 'اختر براندك المفضل 👕',
        country: 'اختر بلدك 🌍',
        leagues: 'اختر 3 دوريات على الأقل ⭐',
    };

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

    const renderBrandItem = useCallback(({ item }: { item: typeof BRANDS[0] }) => {
        const isSelected = selectedBrand === item.name;
        return (
            <TouchableOpacity style={[styles.gridItem, isSelected && styles.selectedItem, { backgroundColor: item.color || '#333' }]} onPress={() => setSelectedBrand(item.name)} activeOpacity={0.7}>
                {item.logo ? (
                    <Image source={{ uri: item.logo }} style={styles.brandLogo} contentFit="contain" />
                ) : null}
                <Text style={styles.brandItemName} numberOfLines={1}>{item.name}</Text>
                {isSelected && <View style={styles.checkBadge}><Check size={12} color="#000" strokeWidth={3} /></View>}
            </TouchableOpacity>
        );
    }, [selectedBrand]);

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
                <Text style={styles.progressText}>{step === 'club' ? '1/4' : step === 'brand' ? '2/4' : step === 'country' ? '3/4' : '4/4'}</Text>
            </View>

            <Animated.View entering={FadeIn.duration(200)} style={styles.header}>
                <Text style={styles.title}>{titles[step]}</Text>
                {step === 'leagues' && <Text style={styles.subtitle}>تم اختيار {selectedLeagues.length}/3</Text>}
            </Animated.View>

            <View style={styles.content}>
                {step === 'club' && <FlatList data={CLUBS} renderItem={renderClubItem} keyExtractor={item => item.id} numColumns={3} showsVerticalScrollIndicator={false} contentContainerStyle={styles.gridContainer} removeClippedSubviews maxToRenderPerBatch={15} windowSize={5} />}
                {step === 'brand' && <FlatList data={BRANDS} renderItem={renderBrandItem} keyExtractor={item => item.id} numColumns={3} showsVerticalScrollIndicator={false} contentContainerStyle={styles.gridContainer} />}
                {step === 'country' && <FlatList data={COUNTRIES} renderItem={renderCountryItem} keyExtractor={item => item.id} numColumns={2} showsVerticalScrollIndicator={false} contentContainerStyle={styles.gridContainer} removeClippedSubviews />}
                {step === 'leagues' && <FlatList data={LEAGUES} renderItem={renderLeagueItem} keyExtractor={item => item.id.toString()} showsVerticalScrollIndicator={false} contentContainerStyle={styles.leaguesContainer} removeClippedSubviews />}
            </View>

            <View style={styles.bottomButtons}>
                {step !== 'club' && (
                    <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
                        <ChevronLeft size={20} color="#fff" /><Text style={styles.backButtonText}>رجوع</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.nextButton, !canProceed && styles.disabledButton]} onPress={handleNext} disabled={!canProceed} activeOpacity={0.8}>
                    <LinearGradient colors={canProceed ? ['#FFD700', '#FFA500'] : ['#333', '#222']} style={styles.nextButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={[styles.nextButtonText, !canProceed && styles.disabledText]}>{step === 'leagues' ? 'ابدأ الآن! 🚀' : 'التالي'}</Text>
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
    brandLogo: { width: 50, height: 35, backgroundColor: '#fff', borderRadius: 6 },
    brandItemName: { color: '#fff', fontSize: 11, marginTop: 6, textAlign: 'center', fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
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
