export interface Profile {
  id: string;
  displayName: string;
  username: string;
  avatar: string;
  favoriteClub: {
    name: string;
    logo: string;
  };
  stats?: {
    followers?: number;
    following?: number;
    predictions?: number;
  };
}

export const allProfiles: Profile[] = [
  {
    id: 'profile1',
    displayName: 'محمد أحمد',
    username: 'mohamed_ahmed',
    avatar: 'https://i.pravatar.cc/150?img=1',
    favoriteClub: {
      name: 'الأهلي',
      logo: 'https://upload.wikimedia.org/wikipedia/ar/9/9e/Al_Ahly_SC_logo.png'
    },
    stats: {
      followers: 1250,
      following: 340,
      predictions: 89
    }
  },
  {
    id: 'profile2',
    displayName: 'أحمد علي',
    username: 'ahmed_ali',
    avatar: 'https://i.pravatar.cc/150?img=2',
    favoriteClub: {
      name: 'الزمالك',
      logo: 'https://upload.wikimedia.org/wikipedia/en/c/c8/Zamalek_SC_logo.svg'
    },
    stats: {
      followers: 890,
      following: 210,
      predictions: 67
    }
  },
  {
    id: 'profile3',
    displayName: 'عمر حسن',
    username: 'omar_hassan',
    avatar: 'https://i.pravatar.cc/150?img=3',
    favoriteClub: {
      name: 'ريال مدريد',
      logo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg'
    },
    stats: {
      followers: 2100,
      following: 450,
      predictions: 124
    }
  },
  {
    id: 'profile4',
    displayName: 'يوسف محمود',
    username: 'youssef_mahmoud',
    avatar: 'https://i.pravatar.cc/150?img=4',
    favoriteClub: {
      name: 'برشلونة',
      logo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg'
    },
    stats: {
      followers: 1560,
      following: 380,
      predictions: 95
    }
  },
  {
    id: 'profile5',
    displayName: 'كريم سعيد',
    username: 'karim_said',
    avatar: 'https://i.pravatar.cc/150?img=5',
    favoriteClub: {
      name: 'ليفربول',
      logo: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg'
    },
    stats: {
      followers: 980,
      following: 290,
      predictions: 72
    }
  }
];

export const searchProfiles = (query: string): Profile[] => {
  const lowerQuery = query.toLowerCase();
  return allProfiles.filter(profile => 
    profile.displayName.toLowerCase().includes(lowerQuery) ||
    profile.username.toLowerCase().includes(lowerQuery) ||
    profile.favoriteClub.name.toLowerCase().includes(lowerQuery)
  );
};
