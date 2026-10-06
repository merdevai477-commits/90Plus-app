/**
 * Top Scorers Five — the Serie A players the competition allows, as supplied
 * by product. Same shape and rules as the LaLiga list: `teamId` is the club's
 * 365Scores competitor id and `nameEn` is only a resolution hint, left null
 * where the supplied Arabic name does not map to one obvious player.
 */

import type { TopScorersFiveSeedClub } from './top-scorers-five-laliga';

export const TOP_SCORERS_FIVE_SERIEA: TopScorersFiveSeedClub[] = [
  {
    clubNameAr: 'أتلانتا',
    clubNameEn: 'Atalanta',
    teamId: 232,
    players: [
      { nameAr: 'جيانلوكا سكاماكا', nameEn: 'Gianluca Scamacca' },
      { nameAr: 'نيكولا كرستوفيتش', nameEn: 'Nikola Krstovic' },
      { nameAr: 'جاكومو راسبادوري', nameEn: 'Giacomo Raspadori' },
    ],
  },
  {
    clubNameAr: 'بولونيا',
    clubNameEn: 'Bologna',
    teamId: 245,
    players: [
      { nameAr: 'أرتيم دوفبيك', nameEn: 'Artem Dovbyk' },
      { nameAr: 'ريكاردو أورسوليني', nameEn: 'Riccardo Orsolini' },
      { nameAr: 'روبرتو بيكولي', nameEn: 'Roberto Piccoli' },
    ],
  },
  {
    clubNameAr: 'كالياري',
    clubNameEn: 'Cagliari',
    teamId: 243,
    players: [
      { nameAr: 'مبالا نزولا', nameEn: "M'Bala Nzola" },
      { nameAr: 'كيفن كارلوس', nameEn: null },
      { nameAr: 'أليو فاديرا', nameEn: 'Alieu Fadera' },
    ],
  },
  {
    clubNameAr: 'كومو',
    clubNameEn: 'Como',
    teamId: 6117,
    players: [
      { nameAr: 'مويس كين', nameEn: 'Moise Kean' },
      { nameAr: 'أناستاسيوس دوفيكاس', nameEn: 'Anastasios Douvikas' },
      { nameAr: 'أساني دياو', nameEn: 'Assane Diao' },
    ],
  },
  {
    clubNameAr: 'فيورنتينا',
    clubNameEn: 'Fiorentina',
    teamId: 228,
    players: [
      { nameAr: 'ماتيو بيليغريني', nameEn: 'Mateo Pellegrino', athleteId: 88570 },
      { nameAr: 'فرانكو ماستانتونو', nameEn: 'Franco Mastantuono' },
      { nameAr: 'ويلفريد نونتو', nameEn: 'Wilfried Gnonto' },
    ],
  },
  {
    clubNameAr: 'فروزينوني',
    clubNameEn: 'Frosinone',
    teamId: 254,
    players: [
      { nameAr: 'أنطونيو رايموندو', nameEn: 'Antonio Raimondo' },
      { nameAr: 'جورجي كفيركفيليا', nameEn: 'Giorgi Kvernadze', athleteId: 136509 },
      { nameAr: 'جورج بريلغيا', nameEn: 'Daniel Birligea', athleteId: 126967 },
    ],
  },
  {
    clubNameAr: 'جنوى',
    clubNameEn: 'Genoa',
    teamId: 231,
    players: [
      { nameAr: 'لورينزو كولومبو', nameEn: 'Lorenzo Colombo' },
      { nameAr: 'ميلوتين أوسمايتش', nameEn: 'Milutin Osmajic' },
      { nameAr: 'لورينزو فينتورينو', nameEn: 'Lorenzo Venturino' },
    ],
  },
  {
    clubNameAr: 'إنتر ميلان',
    clubNameEn: 'Inter Milan',
    teamId: 224,
    players: [
      { nameAr: 'لاوتارو مارتينيز', nameEn: 'Lautaro Martinez' },
      { nameAr: 'ماركوس تورام', nameEn: 'Marcus Thuram' },
      { nameAr: 'فرانشيسكو بيو إسبوزيتو', nameEn: 'Francesco Pio Esposito' },
    ],
  },
  {
    clubNameAr: 'يوفنتوس',
    clubNameEn: 'Juventus',
    teamId: 226,
    players: [
      { nameAr: 'كينان يلديز', nameEn: 'Kenan Yildiz', athleteId: 136674 },
      { nameAr: 'راندال كولو مواني', nameEn: 'Randal Kolo Muani' },
      { nameAr: 'نيك وولتيماده', nameEn: 'Nick Woltemade' },
    ],
  },
  {
    clubNameAr: 'لاتسيو',
    clubNameEn: 'Lazio',
    teamId: 236,
    players: [
      { nameAr: 'أندريا بينامونتي', nameEn: 'Andrea Pinamonti' },
      { nameAr: 'ماتيا زاكاني', nameEn: 'Mattia Zaccagni' },
      { nameAr: 'غوستاف إيساكسن', nameEn: 'Gustav Isaksen' },
    ],
  },
  {
    clubNameAr: 'ليتشي',
    clubNameEn: 'Lecce',
    teamId: 246,
    players: [
      { nameAr: 'نيكولا شتوليتش', nameEn: 'Nikola Stulic' },
      { nameAr: 'تيتي مورينتي', nameEn: 'Tete Morente' },
      { nameAr: 'كامال الدين سحراوي', nameEn: 'Kamaldeen Sulemana' },
    ],
  },
  {
    clubNameAr: 'ميلان',
    clubNameEn: 'AC Milan',
    teamId: 227,
    players: [
      { nameAr: 'كريستيان بوليسيتش', nameEn: 'Christian Pulisic' },
      { nameAr: 'غونسالو راموس', nameEn: 'Goncalo Ramos' },
      { nameAr: 'أليكسيس سايلمايكرز', nameEn: 'Alexis Saelemaekers' },
    ],
  },
  {
    clubNameAr: 'مونزا',
    clubNameEn: 'Monza',
    teamId: 293,
    players: [
      { nameAr: 'غوستافو فاريلا', nameEn: null },
      { nameAr: 'إكسيكيل زيبايوس', nameEn: 'Exequiel Zeballos' },
      { nameAr: 'سيريل نونغ', nameEn: 'Cyril Ngonge' },
    ],
  },
  {
    clubNameAr: 'نابولي',
    clubNameEn: 'Napoli',
    teamId: 234,
    players: [
      { nameAr: 'راسموس هويلوند', nameEn: 'Rasmus Hojlund' },
      { nameAr: 'لورينزو لوكا', nameEn: 'Lorenzo Lucca' },
      { nameAr: 'ديفيد نيريس', nameEn: 'David Neres' },
    ],
  },
  {
    clubNameAr: 'بارما',
    clubNameEn: 'Parma',
    teamId: 241,
    players: [
      { nameAr: 'ماتيا فريغان', nameEn: 'Matija Frigan' },
      { nameAr: 'إل بلال توريه', nameEn: 'El Bilal Toure' },
      { nameAr: 'جوزيه دافيد روميرو', nameEn: null },
    ],
  },
  {
    clubNameAr: 'روما',
    clubNameEn: 'AS Roma',
    teamId: 225,
    players: [
      { nameAr: 'دونييل مالين', nameEn: 'Donyell Malen' },
      { nameAr: 'باولو ديبالا', nameEn: 'Paulo Dybala' },
      { nameAr: 'سانتياغو كاسترو', nameEn: 'Santiago Castro' },
    ],
  },
  {
    clubNameAr: 'ساسولو',
    clubNameEn: 'Sassuolo',
    teamId: 266,
    players: [
      { nameAr: 'دومينيكو بيراردي', nameEn: 'Domenico Berardi' },
      { nameAr: 'سيباستيانو إسبوزيتو', nameEn: 'Sebastiano Esposito' },
      { nameAr: 'أرمان لورينتي', nameEn: 'Armand Lauriente' },
    ],
  },
  {
    clubNameAr: 'تورينو',
    clubNameEn: 'Torino',
    teamId: 235,
    players: [
      { nameAr: 'جيوفاني سيميوني', nameEn: 'Giovanni Simeone' },
      { nameAr: 'زكريا أبو خلال', nameEn: 'Zakaria Aboukhlal' },
      { nameAr: 'دوفان زاباتا', nameEn: 'Duvan Zapata' },
    ],
  },
  {
    clubNameAr: 'أودينيزي',
    clubNameEn: 'Udinese',
    teamId: 229,
    players: [
      { nameAr: 'نيكولو زانيولو', nameEn: 'Nicolo Zaniolo' },
      { nameAr: 'كينان ديفيس', nameEn: 'Keinan Davis' },
      { nameAr: 'فاكون بايو', nameEn: 'Vakoun Bayo' },
    ],
  },
  {
    clubNameAr: 'فينيزيا',
    clubNameEn: 'Venezia',
    teamId: 308,
    players: [
      { nameAr: 'كريستيان ييبواه', nameEn: 'John Yeboah', athleteId: 61954 },
      { nameAr: 'ليون لاوبر باخ', nameEn: 'Lion Lauberbach', athleteId: 68978 },
      { nameAr: 'ألبيون رحماني', nameEn: 'Albion Rrahmani' },
    ],
  },
];
