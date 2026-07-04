/**
 * Mock data for the "ملك التوقعات" (King of Predictions) prediction-groups feature.
 *
 * This is UI-only seed data so the screen renders a complete, believable
 * experience. Wire these types to a real API later; the shapes are intentionally
 * close to what a backend would return.
 */

export interface Team {
  name: string;
  /** Two-color gradient used to render a neutral crest placeholder. */
  crest: [string, string];
  short: string;
}

export interface PredictionMatch {
  id: string;
  home: Team;
  away: Team;
  day: string;
  time: string;
  /** Present only for finished matches (النتائج tab). */
  result?: { home: number; away: number };
}

export interface GroupMember {
  rank: number;
  name: string;
  points: number;
  isMe?: boolean;
  /** wins this window, used for the subtitle. */
  correct: number;
}

export interface RankedGroup {
  rank: number;
  name: string;
  points: number;
  members: number;
}

export const GROUP = {
  name: 'شلة الكورة',
  tagline: 'مجموعة خاصة',
  membersCount: 20,
  createdAt: 'أنشئت في 20 مايو 2024',
  code: '90PLUS123',
  isPrivate: true,
  myRank: 4,
  myPoints: 35,
  pointsToNext: 3,
} as const;

const TEAMS: Record<string, Team> = {
  barca: { name: 'برشلونة', short: 'BAR', crest: ['#A50044', '#004D98'] },
  real: { name: 'ريال مدريد', short: 'RMA', crest: ['#FEFEFE', '#C8B560'] },
  arsenal: { name: 'أرسنال', short: 'ARS', crest: ['#EF0107', '#8A0000'] },
  liverpool: { name: 'ليفربول', short: 'LIV', crest: ['#C8102E', '#5A0715'] },
  marseille: { name: 'مارسيليا', short: 'OM', crest: ['#2FAEE0', '#0E6BA8'] },
  psg: { name: 'باريس سان جيرمان', short: 'PSG', crest: ['#004170', '#DA291C'] },
  city: { name: 'مانشستر سيتي', short: 'MCI', crest: ['#6CABDD', '#1C2C5B'] },
  united: { name: 'مانشستر يونايتد', short: 'MUN', crest: ['#DA291C', '#7A1418'] },
  bayern: { name: 'بايرن ميونخ', short: 'BAY', crest: ['#DC052D', '#0066B2'] },
  dortmund: { name: 'دورتموند', short: 'BVB', crest: ['#FDE100', '#111111'] },
  inter: { name: 'إنتر ميلان', short: 'INT', crest: ['#0068A8', '#111111'] },
  juventus: { name: 'يوفنتوس', short: 'JUV', crest: ['#111111', '#FFFFFF'] },
  chelsea: { name: 'تشيلسي', short: 'CHE', crest: ['#034694', '#001489'] },
  atletico: { name: 'أتلتيكو', short: 'ATM', crest: ['#CB3524', '#172554'] },
  napoli: { name: 'نابولي', short: 'NAP', crest: ['#12A0D7', '#003D74'] },
  milan: { name: 'ميلان', short: 'ACM', crest: ['#FB090B', '#111111'] },
  tottenham: { name: 'توتنهام', short: 'TOT', crest: ['#132257', '#FFFFFF'] },
  newcastle: { name: 'نيوكاسل', short: 'NEW', crest: ['#241F20', '#FFFFFF'] },
  leipzig: { name: 'لايبزيغ', short: 'RBL', crest: ['#DD0741', '#001F47'] },
  benfica: { name: 'بنفيكا', short: 'SLB', crest: ['#E30613', '#7A0B12'] },
};

/** Upcoming round (الجولة 12) — 10 matches open for predictions. */
export const CURRENT_ROUND: PredictionMatch[] = [
  { id: 'm1', home: TEAMS.barca, away: TEAMS.real, day: 'السبت', time: '22:00' },
  { id: 'm2', home: TEAMS.arsenal, away: TEAMS.liverpool, day: 'الأحد', time: '18:30' },
  { id: 'm3', home: TEAMS.marseille, away: TEAMS.psg, day: 'الأحد', time: '22:00' },
  { id: 'm4', home: TEAMS.city, away: TEAMS.united, day: 'السبت', time: '19:30' },
  { id: 'm5', home: TEAMS.bayern, away: TEAMS.dortmund, day: 'السبت', time: '20:30' },
  { id: 'm6', home: TEAMS.inter, away: TEAMS.juventus, day: 'الأحد', time: '21:45' },
  { id: 'm7', home: TEAMS.chelsea, away: TEAMS.tottenham, day: 'الأحد', time: '17:00' },
  { id: 'm8', home: TEAMS.atletico, away: TEAMS.napoli, day: 'السبت', time: '23:00' },
  { id: 'm9', home: TEAMS.milan, away: TEAMS.newcastle, day: 'الأحد', time: '19:00' },
  { id: 'm10', home: TEAMS.leipzig, away: TEAMS.benfica, day: 'الأحد', time: '20:00' },
];

/** Next round (الجولة القادمة) — locked preview. */
export const NEXT_ROUND: PredictionMatch[] = [
  { id: 'n1', home: TEAMS.real, away: TEAMS.atletico, day: 'السبت', time: '22:00' },
  { id: 'n2', home: TEAMS.liverpool, away: TEAMS.city, day: 'الأحد', time: '18:30' },
  { id: 'n3', home: TEAMS.psg, away: TEAMS.marseille, day: 'الأحد', time: '21:00' },
];

/** Finished round (النتائج) — with real results to compare against. */
export const RESULTS_ROUND: PredictionMatch[] = [
  { id: 'r1', home: TEAMS.united, away: TEAMS.chelsea, day: 'الجولة 11', time: '', result: { home: 2, away: 1 } },
  { id: 'r2', home: TEAMS.dortmund, away: TEAMS.bayern, day: 'الجولة 11', time: '', result: { home: 0, away: 3 } },
  { id: 'r3', home: TEAMS.napoli, away: TEAMS.inter, day: 'الجولة 11', time: '', result: { home: 1, away: 1 } },
  { id: 'r4', home: TEAMS.tottenham, away: TEAMS.arsenal, day: 'الجولة 11', time: '', result: { home: 1, away: 2 } },
];

export const MEMBERS: GroupMember[] = [
  { rank: 1, name: 'محمد', points: 45, correct: 14 },
  { rank: 2, name: 'أحمد', points: 42, correct: 13 },
  { rank: 3, name: 'علي', points: 38, correct: 12 },
  { rank: 4, name: 'سامر', points: 35, correct: 11, isMe: true },
  { rank: 5, name: 'كريم', points: 31, correct: 10 },
  { rank: 6, name: 'يوسف', points: 28, correct: 9 },
  { rank: 7, name: 'خالد', points: 24, correct: 8 },
  { rank: 8, name: 'طارق', points: 21, correct: 7 },
];

export const TOP_GROUPS: RankedGroup[] = [
  { rank: 1, name: 'أساطير الكرة', points: 512, members: 20 },
  { rank: 2, name: 'نجوم الدوري', points: 498, members: 18 },
  { rank: 3, name: 'شلة الكورة', points: 476, members: 20 },
  { rank: 4, name: 'عشاق الساحرة', points: 455, members: 16 },
  { rank: 5, name: 'ملوك التوقع', points: 441, members: 19 },
  { rank: 6, name: 'صقور التحدي', points: 420, members: 15 },
  { rank: 7, name: 'فرسان الملعب', points: 398, members: 17 },
  { rank: 8, name: 'أبطال الجولة', points: 377, members: 14 },
  { rank: 9, name: 'محترفو التوقع', points: 350, members: 12 },
  { rank: 10, name: 'عمالقة الكرة', points: 333, members: 13 },
];

export const MY_STATS = {
  totalPoints: 35,
  wins: 24,
  losses: 8,
  draws: 3,
  exactHits: 6,
  accuracy: 76,
  bestStreak: 6,
  currentStreak: 3,
  predictionsMade: 118,
} as const;
