import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';

export interface Club {
  id: string;
  name: string;
  logo: string;
  country: string;
  league: string;
  isPopular?: boolean;
}

// شعارات الأندية العربية
export const arabicClubs: Club[] = [
  // مصر
  {
    id: 'al-ahly',
    name: 'الأهلي',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/9/9e/Al_Ahly_SC_logo.png',
    country: 'مصر',
    league: 'الدوري المصري',
    isPopular: true
  },
  {
    id: 'zamalek',
    name: 'الزمالك',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/4/4a/Zamalek_SC_logo.png',
    country: 'مصر',
    league: 'الدوري المصري',
    isPopular: true
  },
  {
    id: 'pyramids',
    name: 'الأهرام',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/8/8a/Pyramids_FC_logo.png',
    country: 'مصر',
    league: 'الدوري المصري'
  },
  
  // السعودية
  {
    id: 'al-hilal',
    name: 'الهلال',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/1/1b/Al_Hilal_FC_logo.png',
    country: 'السعودية',
    league: 'الدوري السعودي',
    isPopular: true
  },
  {
    id: 'al-nassr',
    name: 'النصر',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/2/2a/Al_Nassr_FC_logo.png',
    country: 'السعودية',
    league: 'الدوري السعودي',
    isPopular: true
  },
  {
    id: 'al-ittihad',
    name: 'الاتحاد',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/9/9e/Al_Ittihad_FC_logo.png',
    country: 'السعودية',
    league: 'الدوري السعودي',
    isPopular: true
  },
  {
    id: 'al-shabab',
    name: 'الشباب',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/1/1b/Al_Shabab_FC_logo.png',
    country: 'السعودية',
    league: 'الدوري السعودي'
  },
  
  // الإمارات
  {
    id: 'al-ain',
    name: 'العين',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/1/1b/Al_Ain_FC_logo.png',
    country: 'الإمارات',
    league: 'الدوري الإماراتي',
    isPopular: true
  },
  {
    id: 'al-wahda',
    name: 'الوحدة',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/9/9e/Al_Wahda_FC_logo.png',
    country: 'الإمارات',
    league: 'الدوري الإماراتي'
  },
  
  // قطر
  {
    id: 'al-sadd',
    name: 'السد',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/1/1b/Al_Sadd_SC_logo.png',
    country: 'قطر',
    league: 'الدوري القطري',
    isPopular: true
  },
  {
    id: 'al-rayyan',
    name: 'الريان',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/9/9e/Al_Rayyan_SC_logo.png',
    country: 'قطر',
    league: 'الدوري القطري'
  },
  
  // المغرب
  {
    id: 'wydad',
    name: 'الوداد',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/1/1b/Wydad_Casablanca_logo.png',
    country: 'المغرب',
    league: 'الدوري المغربي',
    isPopular: true
  },
  {
    id: 'raja',
    name: 'الرجاء',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/9/9e/Raja_Casablanca_logo.png',
    country: 'المغرب',
    league: 'الدوري المغربي',
    isPopular: true
  },
  
  // الجزائر
  {
    id: 'mouloudia',
    name: 'مولودية الجزائر',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/1/1b/Mouloudia_Club_d%27Alger_logo.png',
    country: 'الجزائر',
    league: 'الدوري الجزائري'
  },
  
  // تونس
  {
    id: 'esperance',
    name: 'الترجي',
    logo: 'https://upload.wikimedia.org/wikipedia/ar/9/9e/Espérance_Sportive_de_Tunis_logo.png',
    country: 'تونس',
    league: 'الدوري التونسي',
    isPopular: true
  }
];

// شعارات الأندية العالمية
export const worldClubs: Club[] = [
  // إسبانيا
  {
    id: 'real-madrid',
    name: 'ريال مدريد',
    logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
    country: 'إسبانيا',
    league: 'الدوري الإسباني',
    isPopular: true
  },
  {
    id: 'barcelona',
    name: 'برشلونة',
    logo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
    country: 'إسبانيا',
    league: 'الدوري الإسباني',
    isPopular: true
  },
  {
    id: 'atletico-madrid',
    name: 'أتلتيكو مدريد',
    logo: 'https://upload.wikimedia.org/wikipedia/en/1/15/Atletico_Madrid_logo.svg',
    country: 'إسبانيا',
    league: 'الدوري الإسباني'
  },
  
  // إنجلترا
  {
    id: 'manchester-city',
    name: 'مانشستر سيتي',
    logo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
    country: 'إنجلترا',
    league: 'الدوري الإنجليزي',
    isPopular: true
  },
  {
    id: 'liverpool',
    name: 'ليفربول',
    logo: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
    country: 'إنجلترا',
    league: 'الدوري الإنجليزي',
    isPopular: true
  },
  {
    id: 'manchester-united',
    name: 'مانشستر يونايتد',
    logo: 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg',
    country: 'إنجلترا',
    league: 'الدوري الإنجليزي',
    isPopular: true
  },
  {
    id: 'arsenal',
    name: 'أرسنال',
    logo: 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
    country: 'إنجلترا',
    league: 'الدوري الإنجليزي',
    isPopular: true
  },
  {
    id: 'chelsea',
    name: 'تشيلسي',
    logo: 'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',
    country: 'إنجلترا',
    league: 'الدوري الإنجليزي'
  },
  
  // ألمانيا
  {
    id: 'bayern-munich',
    name: 'بايرن ميونخ',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',
    country: 'ألمانيا',
    league: 'الدوري الألماني',
    isPopular: true
  },
  {
    id: 'borussia-dortmund',
    name: 'دورتموند',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg',
    country: 'ألمانيا',
    league: 'الدوري الألماني'
  },
  
  // فرنسا
  {
    id: 'psg',
    name: 'باريس سان جيرمان',
    logo: 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
    country: 'فرنسا',
    league: 'الدوري الفرنسي',
    isPopular: true
  },
  {
    id: 'marseille',
    name: 'أولمبيك مارسيليا',
    logo: 'https://upload.wikimedia.org/wikipedia/en/4/4e/Olympique_de_Marseille.svg',
    country: 'فرنسا',
    league: 'الدوري الفرنسي'
  },
  
  // إيطاليا
  {
    id: 'juventus',
    name: 'يوفنتوس',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Juventus_FC_2017_logo.svg',
    country: 'إيطاليا',
    league: 'الدوري الإيطالي',
    isPopular: true
  },
  {
    id: 'inter-milan',
    name: 'إنتر ميلان',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',
    country: 'إيطاليا',
    league: 'الدوري الإيطالي'
  },
  {
    id: 'ac-milan',
    name: 'إيه سي ميلان',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Logo_of_AC_Milan.svg',
    country: 'إيطاليا',
    league: 'الدوري الإيطالي'
  },
  
  // هولندا
  {
    id: 'ajax',
    name: 'أياكس',
    logo: 'https://upload.wikimedia.org/wikipedia/en/7/79/Ajax_Amsterdam.svg',
    country: 'هولندا',
    league: 'الدوري الهولندي'
  },
  
  // البرتغال
  {
    id: 'benfica',
    name: 'بنفيكا',
    logo: 'https://upload.wikimedia.org/wikipedia/en/4/4a/SL_Benfica_logo.svg',
    country: 'البرتغال',
    league: 'الدوري البرتغالي'
  },
  {
    id: 'porto',
    name: 'بورتو',
    logo: 'https://upload.wikimedia.org/wikipedia/en/f/fc/FC_Porto_logo.svg',
    country: 'البرتغال',
    league: 'الدوري البرتغالي'
  }
];

// مكون عرض شعار النادي
interface ClubLogoProps {
  club: Club;
  size?: number;
  onPress?: () => void;
  showName?: boolean;
}

export const ClubLogo: React.FC<ClubLogoProps> = ({ 
  club, 
  size = 50, 
  onPress, 
  showName = true 
}) => {
  return (
    <TouchableOpacity 
      style={[styles.clubContainer, { width: size + 20 }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: club.logo }} 
        style={[styles.clubLogo, { width: size, height: size }]} 
      />
      {showName && (
        <Text style={styles.clubName} numberOfLines={2}>
          {club.name}
        </Text>
      )}
      {club.isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>⭐</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// مكون قائمة الأندية
interface ClubListProps {
  clubs: Club[];
  onClubSelect?: (club: Club) => void;
  showPopularOnly?: boolean;
}

export const ClubList: React.FC<ClubListProps> = ({ 
  clubs, 
  onClubSelect, 
  showPopularOnly = false 
}) => {
  const filteredClubs = showPopularOnly 
    ? clubs.filter(club => club.isPopular)
    : clubs;

  return (
    <View style={styles.clubList}>
      {filteredClubs.map((club) => (
        <ClubLogo
          key={club.id}
          club={club}
          onPress={() => onClubSelect?.(club)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  clubContainer: {
    alignItems: 'center',
    margin: 8,
    padding: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  clubLogo: {
    borderRadius: 25,
    marginBottom: 8,
  },
  clubName: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  popularBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FFD700',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularText: {
    fontSize: 10,
  },
  clubList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
});

export default ClubLogo;
