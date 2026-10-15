/**
 * Egyptian-colloquial helpers for the football chat agent:
 *  - fan nicknames → searchable canonical names (الماجيكو → محمد أبو تريكة)
 *  - short confirmations after a "قصدك X؟" question (ايوه ده قصدي → X)
 *  - filler words around a name (لا قصدي / عايز اعرف عن / احكيلي عن …)
 */

import { foldArabic } from '../services/quiz-name-match.util';

type Alias = { names: string[]; canonical: string; wholeOnly?: boolean };

/**
 * `wholeOnly` aliases are common words ("الأحمر", "الملكي") that only mean the
 * club when they are the entire query, never inside a longer sentence.
 */
const ALIASES: Alias[] = [
  { names: ['الماجيكو', 'ماجيكو', 'تريكه', 'ابو تريكه', 'امير القلوب'], canonical: 'محمد أبو تريكة' },
  { names: ['ابو مكه', 'مو صلاح', 'مومو صلاح', 'الفرعون المصري', 'مو'], canonical: 'محمد صلاح' },
  { names: ['السد العالي', 'الحضري'], canonical: 'عصام الحضري' },
  { names: ['بيبو'], canonical: 'محمود الخطيب' },
  { names: ['الجنرال', 'الجوهري'], canonical: 'محمود الجوهري' },
  { names: ['المعلم', 'المعلم حسن شحاته'], canonical: 'حسن شحاتة' },
  { names: ['ميدو'], canonical: 'أحمد حسام ميدو' },
  { names: ['الدون', 'كريستيانو', 'cr7'], canonical: 'كريستيانو رونالدو' },
  { names: ['البرغوث', 'ليو ميسي'], canonical: 'ليونيل ميسي' },
  { names: ['الظاهره', 'رونالدو البرازيلي', 'رونالدو الظاهره'], canonical: 'رونالدو نازاريو' },
  { names: ['رونالدينيو', 'رونالدينهو', 'الساحر رونالدينيو'], canonical: 'رونالدينيو' },
  { names: ['زيزو الفرنسي', 'زين الدين زيدان'], canonical: 'زين الدين زيدان' },
  { names: ['الاحمر', 'المارد الاحمر', 'القلعه الحمراء', 'نادي القرن'], canonical: 'الأهلي المصري', wholeOnly: true },
  { names: ['الابيض', 'القلعه البيضاء', 'الفارس الابيض', 'الزملكاويه'], canonical: 'الزمالك', wholeOnly: true },
  { names: ['الملكي', 'الميرنجي', 'البلانكوس', 'الريال'], canonical: 'ريال مدريد', wholeOnly: true },
  { names: ['البلوجرانا', 'البارسا', 'البرسا'], canonical: 'برشلونة', wholeOnly: true },
  { names: ['الريدز'], canonical: 'ليفربول', wholeOnly: true },
  { names: ['الشياطين الحمر', 'اليونايتد', 'المان يونايتد'], canonical: 'مانشستر يونايتد', wholeOnly: true },
  { names: ['السيتيزنز', 'السيتي', 'المان سيتي'], canonical: 'مانشستر سيتي', wholeOnly: true },
  { names: ['الجانرز', 'المدفعجيه'], canonical: 'آرسنال', wholeOnly: true },
  { names: ['البلوز'], canonical: 'تشيلسي', wholeOnly: true },
  { names: ['السبيرز'], canonical: 'توتنهام', wholeOnly: true },
  { names: ['السيده العجوز', 'اليوفي'], canonical: 'يوفنتوس', wholeOnly: true },
  { names: ['البافاري', 'العملاق البافاري', 'البايرن'], canonical: 'بايرن ميونخ', wholeOnly: true },
  { names: ['النيراتزوري', 'الانتر'], canonical: 'إنتر ميلان', wholeOnly: true },
  { names: ['الروسونيري', 'الميلان'], canonical: 'ميلان', wholeOnly: true },
  { names: ['الزعيم'], canonical: 'الهلال السعودي', wholeOnly: true },
  { names: ['العالمي'], canonical: 'النصر السعودي', wholeOnly: true },
  { names: ['الفراعنه', 'منتخبنا', 'المنتخب', 'منتخب مصر'], canonical: 'منتخب مصر', wholeOnly: true },
  { names: ['السامبا', 'السيليساو'], canonical: 'منتخب البرازيل', wholeOnly: true },
  { names: ['التانجو', 'الالبيسيليستي'], canonical: 'منتخب الأرجنتين', wholeOnly: true },
  { names: ['الديوك'], canonical: 'منتخب فرنسا', wholeOnly: true },
  { names: ['الماكينات', 'المانشافت'], canonical: 'منتخب ألمانيا', wholeOnly: true },
  { names: ['الطواحين'], canonical: 'منتخب هولندا', wholeOnly: true },
  { names: ['اسود الاطلس'], canonical: 'منتخب المغرب', wholeOnly: true },
  { names: ['محاربي الصحراء', 'محاربو الصحراء', 'الخضر'], canonical: 'منتخب الجزائر', wholeOnly: true },
  { names: ['نسور قرطاج'], canonical: 'منتخب تونس', wholeOnly: true },
];

function fold(text: string): string {
  return foldArabic(text).toLowerCase().replace(/[؟?!.,،"«»]/g, ' ').replace(/\s+/g, ' ').trim();
}

const FOLDED_ALIASES = ALIASES.map((a) => ({
  ...a,
  folded: a.names.map(fold).sort((x, y) => y.length - x.length),
}));

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rewrite fan nicknames to the name the data sources know. Returns the input
 * unchanged when nothing matches.
 */
export function resolveFootballAlias(query: string): string {
  const q = fold(query);
  if (!q) return query;
  for (const a of FOLDED_ALIASES) {
    if (a.folded.includes(q)) return a.canonical;
  }
  for (const a of FOLDED_ALIASES) {
    if (a.wholeOnly) continue;
    for (const name of a.folded) {
      if (name.length < 4) continue;
      const re = new RegExp(`(^|\\s)${escapeRe(name)}(?=\\s|$)`);
      if (re.test(q)) return q.replace(re, `$1${a.canonical}`).trim();
    }
  }
  return query;
}

const CONFIRM_RE =
  /^(?:(?:ا|أ|آ)ي(?:و|وه|وة|وا|ون)|اه|آه|اها|أها|ايوه|أيوه|ايوة|أيوة|ايوا|أيوا|يب|ياه|اكيد|أكيد|بالظبط|بالضبط|مظبوط|مضبوط|صح|صحيح|تمام|هو|هو ده|هوا ده|هو بعينه|ده|دا|ده هو|دا هو|قصدي|ده قصدي|دا قصدي|هو ده قصدي|نعم|طبعا|طبعًا|yes|yeah|yep|yup|exactly|right|correct|that one|that's him|him)$/i;

/** "ايوه ده قصدي" / "اه هو" / "بالظبط" — a bare confirmation, no new name in it. */
export function isConfirmationReply(message: string): boolean {
  const m = message.replace(/[؟?!.,،]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!m || m.split(' ').length > 6) return false;
  const words = m.split(' ');
  const fillers = /^(?:يا|يعني|كده|كدا|بقى|بقي|والله|اكيد|أكيد|طبعا|طبعًا|ايوه|أيوه|اه|آه|هو|ده|دا|قصدي|اقصد|أقصد|صح|بالظبط|تمام|نعم|yes|yeah|exactly|that|one|him|it)$/i;
  if (!CONFIRM_RE.test(words[0]) && !CONFIRM_RE.test(m)) return false;
  return words.every((w) => CONFIRM_RE.test(w) || fillers.test(w) || /^(?:عم|ياعم|يا\s*عم|باشا|معلم|كابتن)$/i.test(w));
}

/** Name the assistant offered in its last "قصدك X؟" / "Did you mean X?" question. */
export function extractSuggestedName(assistantText: string): string | null {
  const text = assistantText ?? '';
  const askIdx = text.search(/قصدك|تقصد|did you mean|do you mean|which one/i);
  if (askIdx < 0) return null;
  const tail = text.slice(askIdx);
  const bold = tail.match(/\*\*([^*]{2,60})\*\*/);
  if (bold) return stripQualifier(bold[1]);
  const plain = tail.match(/(?:قصدك|تقصد|did you mean|do you mean)\s*[:：]?\s*([^؟?\n(،,]{2,60})/i);
  return plain ? stripQualifier(plain[1]) : null;
}

function stripQualifier(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').replace(/^["«]|["»]$/g, '').trim();
}

/**
 * When the user just confirms the assistant's "قصدك X؟", return X so the agent
 * searches for it instead of treating "ايوه ده قصدي" as a new query.
 */
export function resolveConfirmedName(
  history: Array<{ role: string; content: string }>,
  message: string,
): string | null {
  if (!isConfirmationReply(message)) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== 'assistant') continue;
    return extractSuggestedName(msg.content);
  }
  return null;
}

/** Spoken-Egyptian lead-ins around a name: "لا قصدي …", "عايز اعرف عن …", "احكيلي عن …". */
const FILLER_RE =
  /(?:^|\s)(?:لا|لأ|لاء|لا\s+يا\s+عم|قصدي|اقصد|أقصد|يعني|طب|طيب|بقولك|بص|عايز|عاوز|عايزه|عاوزه|محتاج|اعرف|أعرف|قولي|قوللي|قول\s+لي|احكيلي|احكي\s+لي|كلمني|كلمنى|معلومات|حاجه|حاجة|عن|اخبار|أخبار|رأيك|رايك|في|فى|ده|دي|دا|هو|هي|اللاعب|لاعب|الكابتن|كابتن|تاريخ|مسيرة|مسيره|سيرة|سيره|ايه|إيه|اي|إي)(?=\s|$)/gi;

export function stripColloquialFillers(text: string): string {
  let prev = '';
  let s = ` ${text} `;
  while (prev !== s) {
    prev = s;
    s = s.replace(FILLER_RE, ' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}
