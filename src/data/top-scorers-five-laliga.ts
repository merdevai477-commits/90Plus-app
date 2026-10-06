/**
 * Top Scorers Five — the LaLiga players the competition allows, as supplied by
 * product. The admin endpoint / seed script upserts these into
 * `top_scorers_five_players` and resolves each to a 365Scores athleteId.
 *
 * `teamId` is the club's 365Scores competitor id (the id `CachedFixture` uses for
 * LaLiga). `nameEn` is a resolution hint only — left null where the supplied
 * Arabic name does not map to a single obvious player, so the club squad decides.
 */

export type TopScorersFiveSeedPlayer = {
  nameAr: string;
  nameEn: string | null;
};

export type TopScorersFiveSeedClub = {
  clubNameAr: string;
  clubNameEn: string;
  teamId: number;
  players: TopScorersFiveSeedPlayer[];
};

export const TOP_SCORERS_FIVE_LALIGA: TopScorersFiveSeedClub[] = [
  {
    clubNameAr: 'برشلونة',
    clubNameEn: 'Barcelona',
    teamId: 132,
    players: [
      { nameAr: 'لامين يامال', nameEn: 'Lamine Yamal' },
      { nameAr: 'رافينيا', nameEn: 'Raphinha' },
      { nameAr: 'غابرييل جيسوس', nameEn: 'Gabriel Jesus' },
      { nameAr: 'اديمي', nameEn: 'Karim Adeyemi' },
    ],
  },
  {
    clubNameAr: 'ريال مدريد',
    clubNameEn: 'Real Madrid',
    teamId: 131,
    players: [
      { nameAr: 'كيليان مبابي', nameEn: 'Kylian Mbappe' },
      { nameAr: 'فينيسيوس جونيور', nameEn: 'Vinicius Junior' },
      { nameAr: 'رودريغو', nameEn: 'Rodrygo' },
      { nameAr: 'بيلنغهام', nameEn: 'Jude Bellingham' },
    ],
  },
  {
    clubNameAr: 'أتلتيكو مدريد',
    clubNameEn: 'Atletico Madrid',
    teamId: 134,
    players: [
      { nameAr: 'جوليان ألفاريز', nameEn: 'Julian Alvarez' },
      { nameAr: 'جوناثان ديفيد', nameEn: 'Jonathan David' },
      { nameAr: 'ألكسندر سورلوث', nameEn: 'Alexander Sorloth' },
    ],
  },
  {
    clubNameAr: 'ريال بيتيس',
    clubNameEn: 'Real Betis',
    teamId: 146,
    players: [
      { nameAr: 'أنطوني', nameEn: 'Antony' },
      { nameAr: 'كوتشو هيرنانديز', nameEn: 'Cucho Hernandez' },
      { nameAr: 'باروت', nameEn: null },
    ],
  },
  {
    clubNameAr: 'إشبيلية',
    clubNameEn: 'Sevilla',
    teamId: 135,
    players: [
      { nameAr: 'دودي لوكيباكيو', nameEn: 'Dodi Lukebakio' },
      { nameAr: 'إسحاق روميرو', nameEn: 'Isaac Romero' },
      { nameAr: 'يوسف فوفانا', nameEn: 'Youssouf Fofana' },
    ],
  },
  {
    clubNameAr: 'ألافيس',
    clubNameEn: 'Alaves',
    teamId: 168,
    players: [
      { nameAr: 'كيكي غارسيا', nameEn: 'Kike Garcia' },
      { nameAr: 'كارلوس فيسنتي', nameEn: 'Carlos Vicente' },
      { nameAr: 'كارلوس مارتن', nameEn: 'Carlos Martin' },
    ],
  },
  {
    clubNameAr: 'ديبورتيفو لاكورونيا',
    clubNameEn: 'Deportivo A Coruna',
    teamId: 148,
    players: [
      { nameAr: 'أوباميانغ', nameEn: 'Pierre-Emerick Aubameyang' },
      { nameAr: 'أداما تراوري', nameEn: 'Adama Traore' },
      { nameAr: 'أنغيلينيو', nameEn: 'Angelino' },
    ],
  },
  {
    clubNameAr: 'ريال سوسيداد',
    clubNameEn: 'Real Sociedad',
    teamId: 154,
    players: [
      { nameAr: 'ميكيل أويارزابال', nameEn: 'Mikel Oyarzabal' },
      { nameAr: 'تاكيفوسا كوبو', nameEn: 'Takefusa Kubo' },
      { nameAr: 'أورّي أوسكارسن', nameEn: 'Orri Oskarsson' },
    ],
  },
  {
    clubNameAr: 'فياريال',
    clubNameEn: 'Villarreal',
    teamId: 133,
    players: [
      { nameAr: 'أيوزي بيريز', nameEn: 'Ayoze Perez' },
      { nameAr: 'جيرارد مورينو', nameEn: 'Gerard Moreno' },
      { nameAr: 'نيكولاس بيبي', nameEn: 'Nicolas Pepe' },
    ],
  },
  {
    clubNameAr: 'أتلتيك بلباو',
    clubNameEn: 'Athletic Bilbao',
    teamId: 144,
    players: [
      { nameAr: 'نيكو ويليامز', nameEn: 'Nico Williams' },
      { nameAr: 'إينياكي ويليامز', nameEn: 'Inaki Williams' },
      { nameAr: 'غوروزيتا', nameEn: 'Gorka Guruzeta' },
    ],
  },
  {
    clubNameAr: 'خيتافي',
    clubNameEn: 'Getafe',
    teamId: 140,
    players: [
      { nameAr: 'بورخا مايورال', nameEn: 'Borja Mayoral' },
      { nameAr: 'كريسان', nameEn: null },
      { nameAr: 'أرامباري', nameEn: 'Mauro Arambarri' },
    ],
  },
  {
    clubNameAr: 'رايو فايكانو',
    clubNameEn: 'Rayo Vallecano',
    teamId: 174,
    players: [
      { nameAr: 'ألفارو غارسيا', nameEn: 'Alvaro Garcia' },
      { nameAr: 'سيرخيو كاميلو', nameEn: 'Sergio Camello' },
      { nameAr: 'أوناي لوبيز', nameEn: 'Unai Lopez' },
    ],
  },
  {
    clubNameAr: 'أوساسونا',
    clubNameEn: 'Osasuna',
    teamId: 143,
    players: [
      { nameAr: 'أنتي بوديمير', nameEn: 'Ante Budimir' },
      { nameAr: 'أيمار أوروز', nameEn: 'Aimar Oroz' },
      { nameAr: 'برايان سرقسطة', nameEn: 'Bryan Zaragoza' },
    ],
  },
  {
    clubNameAr: 'سيلتا فيغو',
    clubNameEn: 'Celta Vigo',
    teamId: 158,
    players: [
      { nameAr: 'إياغو أسباس', nameEn: 'Iago Aspas' },
      { nameAr: 'ويليوت سويدبيرغ', nameEn: 'Williot Swedberg' },
      { nameAr: 'جوناثان بامبا', nameEn: 'Jonathan Bamba' },
    ],
  },
  {
    clubNameAr: 'إسبانيول',
    clubNameEn: 'Espanyol',
    teamId: 136,
    players: [
      { nameAr: 'خافي بوادو', nameEn: 'Javi Puado' },
      { nameAr: 'روبرتو فرنانديز', nameEn: 'Roberto Fernandez' },
      { nameAr: 'كريس راموس', nameEn: 'Cris Ramos' },
    ],
  },
  {
    clubNameAr: 'راسينغ سانتاندير',
    clubNameEn: 'Racing Santander',
    teamId: 137,
    players: [
      { nameAr: 'بابلو غارسيا', nameEn: null },
      { nameAr: 'أندريه ألميدا', nameEn: null },
      { nameAr: 'آرون مارتين', nameEn: null },
    ],
  },
  {
    clubNameAr: 'ليفانتي',
    clubNameEn: 'Levante',
    teamId: 150,
    players: [
      { nameAr: 'داني غوميز', nameEn: 'Dani Gomez' },
      { nameAr: 'إيفان روميرو', nameEn: 'Ivan Romero' },
      { nameAr: 'كارلوس إسبّي', nameEn: 'Carlos Espi' },
    ],
  },
  {
    clubNameAr: 'إلتشي',
    clubNameEn: 'Elche',
    teamId: 156,
    players: [
      { nameAr: 'توماس ليمار', nameEn: 'Thomas Lemar' },
      { nameAr: 'روبين سانشيز', nameEn: null },
      { nameAr: 'ريفيفو', nameEn: 'Roy Revivo' },
    ],
  },
  {
    clubNameAr: 'فالنسيا',
    clubNameEn: 'Valencia',
    teamId: 139,
    players: [
      { nameAr: 'هوغو دورو', nameEn: 'Hugo Duro' },
      { nameAr: 'لويس ريوخا', nameEn: 'Luis Rioja' },
      { nameAr: 'دييغو لوبيز', nameEn: 'Diego Lopez' },
    ],
  },
  {
    clubNameAr: 'مالقا',
    clubNameEn: 'Malaga',
    teamId: 152,
    players: [
      { nameAr: 'خوان كروز', nameEn: null },
      { nameAr: 'بابلو مارتينيز', nameEn: null },
    ],
  },
];
