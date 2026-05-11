/**
 * Utility to automatically detect category and relevant keywords from a question.
 */

const KEYWORDS = {
  football: ['ميسي', 'رونالدو', 'صلاح', 'مبابي', 'كرة قدم', 'مباراة', 'دوري', 'كأس العالم', 'تشكيل', 'تكتيك', 'منتخب'],
  training: ['تمرين', 'سرعة', 'لياقة', 'تدريب', 'عضلات', 'قوة', 'جري', 'جيم', 'اوزان'],
  nutrition: ['بروتين', 'اكل', 'غذاء', 'وجبة', 'دايت', 'سعرات', 'كاربوهيدرات', 'دهون', 'مكملات'],
  recovery: ['استشفاء', 'اصابة', 'ألم', 'نوم', 'ثلج', 'شد عضلي', 'مساج', 'علاج'],
};

/**
 * Extracts category based on keyword frequency in the text.
 */
export function detectCategory(text: string): string {
  const normalizedText = text.toLowerCase();
  
  let bestCategory = 'football'; // default
  let maxMatches = 0;

  for (const [category, words] of Object.entries(KEYWORDS)) {
    let matches = 0;
    for (const word of words) {
      if (normalizedText.includes(word)) {
        matches++;
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestCategory = category;
    }
  }

  return bestCategory;
}

/**
 * Advanced keyword extractor to remove stop words and keep relevant Arabic/English keywords.
 */
export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'في', 'من', 'على', 'إلى', 'عن', 'مع', 'هل', 'ما', 'ماذا', 'كيف', 'لماذا',
    'متى', 'أين', 'من', 'هو', 'هي', 'هم', 'أنا', 'أنت', 'نحن', 'كان', 'يكون',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when',
    'where', 'who', 'which', 'that', 'this', 'and', 'or', 'but', 'in', 'on',
    'at', 'to', 'for', 'of', 'with', 'by', 'do', 'does', 'did', 'can', 'could',
    'إيه', 'ايه', 'مين', 'فين', 'امتى', 'ليه', 'ازاي', 'وش', 'شو', 'كيف',
  ]);

  return text
    .toLowerCase()
    .replace(/[؟?!.,،؛;:]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 8); // Limit to top 8 keywords
}
