import type { QuizDatasetNation } from '../types/quiz-entity.types';

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Major FIFA World Cup nations — used as valid MCQ options in WORLD_CUP mode. */
const WORLD_CUP_NATION_NAMES: readonly { name: string; aliases?: string[] }[] = [
  { name: 'Brazil', aliases: ['البرازيل'] },
  { name: 'Argentina', aliases: ['الأرجنتين'] },
  { name: 'Germany', aliases: ['ألمانيا'] },
  { name: 'France', aliases: ['فرنسا'] },
  { name: 'Italy', aliases: ['إيطاليا'] },
  { name: 'Spain', aliases: ['إسبانيا'] },
  { name: 'England', aliases: ['إنجلترا'] },
  { name: 'Uruguay', aliases: ['أوروغواي'] },
  { name: 'Netherlands', aliases: ['هولندا'] },
  { name: 'Portugal', aliases: ['البرتغال'] },
  { name: 'Mexico', aliases: ['المكسيك'] },
  { name: 'United States', aliases: ['الولايات المتحدة', 'USA'] },
  { name: 'Japan', aliases: ['اليابان'] },
  { name: 'Morocco', aliases: ['المغرب'] },
  { name: 'Croatia', aliases: ['كرواتيا'] },
  { name: 'Belgium', aliases: ['بلجيكا'] },
  { name: 'Saudi Arabia', aliases: ['السعودية'] },
  { name: 'Egypt', aliases: ['مصر'] },
  { name: 'Senegal', aliases: ['السنغال'] },
  { name: 'Serbia', aliases: ['صربيا'] },
  { name: 'Poland', aliases: ['بولندا'] },
  { name: 'Switzerland', aliases: ['سويسرا'] },
  { name: 'Denmark', aliases: ['الدنمارك'] },
  { name: 'Sweden', aliases: ['السويد'] },
  { name: 'South Korea', aliases: ['كوريا الجنوبية'] },
  { name: 'Australia', aliases: ['أستراليا'] },
  { name: 'Cameroon', aliases: ['الكاميرون'] },
  { name: 'Ghana', aliases: ['غانا'] },
  { name: 'Nigeria', aliases: ['نيجيريا'] },
  { name: 'Tunisia', aliases: ['تونس'] },
  { name: 'Algeria', aliases: ['الجزائر'] },
  { name: 'Iran', aliases: ['إيران'] },
  { name: 'Qatar', aliases: ['قطر'] },
  { name: 'Colombia', aliases: ['كولومبيا'] },
  { name: 'Chile', aliases: ['تشيلي'] },
  { name: 'Turkey', aliases: ['تركيا'] },
  { name: 'Russia', aliases: ['روسيا'] },
  { name: 'Ukraine', aliases: ['أوكرانيا'] },
  { name: 'Wales', aliases: ['ويلز'] },
  { name: 'Scotland', aliases: ['اسكتلندا'] },
  { name: 'Canada', aliases: ['كندا'] },
  { name: 'South Africa', aliases: ['جنوب أفريقيا'] },
  { name: 'China', aliases: ['الصين'] },
  { name: 'Costa Rica', aliases: ['كوستاريكا'] },
  { name: 'Paraguay', aliases: ['باراغواي'] },
  { name: 'Peru', aliases: ['بيرو'] },
  { name: 'Czech Republic', aliases: ['التشيك'] },
];

export function buildWorldCupNations(): QuizDatasetNation[] {
  return WORLD_CUP_NATION_NAMES.map((entry) => ({
    id: `nation:${slug(entry.name)}`,
    name: entry.name,
    aliases: entry.aliases,
  }));
}
