/**
 * Obfuscation-aware profanity matcher for Community posts and comments.
 *
 * Pure (no DB / network) so it can be unit-tested and rebuilt cheaply when
 * admins add BannedWord rows.
 */

import { AR_ALLOW, AR_EMBEDDED, AR_EXACT, AR_PHRASES } from '../constants/profanity/ar';
import { EN_ALLOW, EN_EMBEDDED, EN_EXACT, EN_PHRASES, EN_PREFIX } from '../constants/profanity/en';
import { FRANCO_EMBEDDED, FRANCO_EXACT, FRANCO_PHRASES } from '../constants/profanity/franco';

export interface ProfanityLists {
    arExact: readonly string[];
    arPhrases: readonly string[];
    arEmbedded: readonly string[];
    arAllow: readonly string[];
    enExact: readonly string[];
    enPrefix: readonly string[];
    enPhrases: readonly string[];
    enEmbedded: readonly string[];
    enAllow: readonly string[];
    francoExact: readonly string[];
    francoPhrases: readonly string[];
    francoEmbedded: readonly string[];
}

export interface ProfanityResult {
    flagged: boolean;
    matches: string[];
}

export interface ProfanityMatcher {
    check(text: string): ProfanityResult;
}

export const DEFAULT_PROFANITY_LISTS: ProfanityLists = {
    arExact: AR_EXACT,
    arPhrases: AR_PHRASES,
    arEmbedded: AR_EMBEDDED,
    arAllow: AR_ALLOW,
    enExact: EN_EXACT,
    enPrefix: EN_PREFIX,
    enPhrases: EN_PHRASES,
    enEmbedded: EN_EMBEDDED,
    enAllow: EN_ALLOW,
    francoExact: FRANCO_EXACT,
    francoPhrases: FRANCO_PHRASES,
    francoEmbedded: FRANCO_EMBEDDED,
};

const INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
const AR_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const ARABIC_CHAR = /[\u0600-\u06FF]/;

const AR_PREFIXES = ['وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'يا', 'و', 'ف', 'ب', 'ل', 'ك'];
const AR_SUFFIXES = ['ها', 'هم', 'كم', 'كو', 'نا', 'ين', 'ات', 'ه', 'ك', 'ي', 'و'];

const LEET: Record<string, string> = {
    '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g',
    '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't', '€': 'e', '£': 'l',
};

export function foldText(text: string): string {
    return text
        .normalize('NFKC')
        .toLowerCase()
        .replace(INVISIBLE, '')
        .replace(AR_MARKS, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/[ىی]/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/ک/g, 'ك')
        .replace(/گ/g, 'ك')
        .replace(/ڤ/g, 'ف')
        .replace(/پ/g, 'ب')
        .replace(/چ/g, 'ج');
}

function escapeChar(c: string): string {
    return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "fuck" → "f+u+c+k+" so "fuuuuck" still matches. */
function stretch(word: string): string {
    return Array.from(word).map((c) => (c === ' ' ? ' ' : `${escapeChar(c)}+`)).join('');
}

function alternation(words: Iterable<string>): string {
    const unique = Array.from(new Set(Array.from(words).filter(Boolean)));
    unique.sort((a, b) => b.length - a.length);
    return unique.map(stretch).join('|');
}

function compile(source: string, flags = 'u'): RegExp | null {
    return source ? new RegExp(source, flags) : null;
}

function stripToken(token: string): string {
    return token.replace(/[^\p{L}\p{N}*]/gu, '');
}

function leetToken(token: string): string {
    return Array.from(token).map((c) => LEET[c] ?? c).join('');
}

/** Re-join letters split by spaces/punctuation: "ك س م ك" → "كسمك", "f u c k" → "fuck". */
function withMergedSingles(tokens: string[]): string[] {
    const out = [...tokens];
    let run: string[] = [];
    const flush = () => {
        if (run.length >= 2) out.push(run.join(''));
        run = [];
    };
    for (const t of tokens) {
        if (Array.from(t).length === 1) run.push(t);
        else flush();
    }
    flush();
    return out;
}

function arabicCandidates(token: string): string[] {
    const firstPass = [token];
    for (const p of AR_PREFIXES) {
        if (token.startsWith(p) && token.length - p.length >= 2) firstPass.push(token.slice(p.length));
    }
    const all = [...firstPass];
    for (const c of firstPass) {
        for (const s of AR_SUFFIXES) {
            if (c.endsWith(s) && c.length - s.length >= 2) all.push(c.slice(0, -s.length));
        }
    }
    return all;
}

function phraseToTokens(phrase: string): string[] {
    return foldText(phrase).split(/\s+/).map(stripToken).filter(Boolean);
}

/** Two+ word phrases are also matched when typed glued together ("ياكلب", "kosomak"). */
function gluedForms(phrases: readonly string[]): string[] {
    return phrases.map((p) => phraseToTokens(p).join('')).filter((g) => Array.from(g).length >= 4);
}

function phraseRegex(phrases: readonly string[]): RegExp | null {
    const body = alternation(phrases.map((p) => phraseToTokens(p).join(' ')).filter((p) => p.includes(' ')));
    return compile(body ? `(?:^| )(?:${body})(?= |$)` : '');
}

export function createProfanityMatcher(lists: ProfanityLists = DEFAULT_PROFANITY_LISTS): ProfanityMatcher {
    const norm = (words: readonly string[]) => words.map((w) => stripToken(foldText(w))).filter(Boolean);

    const arAllow = new Set(norm(lists.arAllow));
    const enAllow = new Set(norm(lists.enAllow));

    const arExact = compile(`^(?:${alternation([...norm(lists.arExact), ...gluedForms(lists.arPhrases)])})$`);
    const arEmbedded = compile(alternation(norm(lists.arEmbedded)));
    const arPhrase = phraseRegex(lists.arPhrases);

    const enExact = compile(`^(?:${alternation([...norm(lists.enExact), ...gluedForms(lists.enPhrases)])})$`);
    const enPrefix = compile(`^(?:${alternation(norm(lists.enPrefix))})`);
    const enEmbedded = compile(alternation(norm(lists.enEmbedded)));
    const enPhrase = phraseRegex(lists.enPhrases);

    const frExact = compile(`^(?:${alternation([...norm(lists.francoExact), ...gluedForms(lists.francoPhrases)])})$`);
    const frEmbedded = compile(alternation(norm(lists.francoEmbedded)));
    const frPhrase = phraseRegex(lists.francoPhrases);

    const wildcardTargets = Array.from(
        new Set([...norm(lists.enExact), ...norm(lists.enPrefix), ...norm(lists.enEmbedded)]),
    );

    return {
        check(text: string): ProfanityResult {
            const matches = new Set<string>();
            if (!text || !text.trim()) return { flagged: false, matches: [] };

            const folded = foldText(text);
            const rawTokens = folded.split(/\s+/).filter(Boolean);

            const plain = withMergedSingles(rawTokens.map(stripToken).filter(Boolean));
            const leet = withMergedSingles(rawTokens.map((t) => stripToken(leetToken(t))).filter(Boolean));

            for (const token of plain) {
                if (token.includes('*')) continue;
                if (ARABIC_CHAR.test(token)) {
                    const candidates = arabicCandidates(token);
                    if (candidates.some((c) => arAllow.has(c))) continue;
                    for (const c of candidates) {
                        if (arExact?.test(c)) {
                            matches.add(c);
                            break;
                        }
                    }
                    const emb = arEmbedded && token.match(arEmbedded);
                    if (emb) matches.add(emb[0]);
                } else {
                    if (frExact?.test(token)) matches.add(token);
                    const emb = frEmbedded && token.match(frEmbedded);
                    if (emb) matches.add(emb[0]);
                }
            }

            for (const token of leet) {
                if (ARABIC_CHAR.test(token) || enAllow.has(token)) continue;
                if (token.includes('*')) {
                    const pattern = token.replace(/\*+/g, '*');
                    const letters = pattern.replace(/\*/g, '');
                    if (letters.length < 2) continue;
                    const rx = new RegExp(`^${Array.from(pattern).map((c) => (c === '*' ? '.{1,3}' : escapeChar(c))).join('')}`, 'u');
                    const hit = wildcardTargets.find((w) => rx.test(w));
                    if (hit) matches.add(hit);
                    continue;
                }
                if (enExact?.test(token) || enPrefix?.test(token)) {
                    matches.add(token);
                    continue;
                }
                const emb = enEmbedded && token.match(enEmbedded);
                if (emb) matches.add(emb[0]);
            }

            const plainStream = rawTokens.map(stripToken).filter(Boolean).join(' ');
            const conjStream = rawTokens
                .map(stripToken)
                .filter(Boolean)
                .map((t) => (ARABIC_CHAR.test(t) && /^[وف]/.test(t) && t.length > 3 ? t.slice(1) : t))
                .join(' ');
            const leetStream = rawTokens.map((t) => stripToken(leetToken(t))).filter(Boolean).join(' ');

            for (const [rx, stream] of [
                [arPhrase, plainStream],
                [arPhrase, conjStream],
                [frPhrase, plainStream],
                [enPhrase, leetStream],
            ] as const) {
                const m = rx && stream.match(rx);
                if (m) matches.add(m[0].trim());
            }

            return { flagged: matches.size > 0, matches: Array.from(matches) };
        },
    };
}

/** Extra words from the BannedWord table, merged into the static lists. */
export function mergeBannedWords(
    base: ProfanityLists,
    rows: ReadonlyArray<{ word: string; language: string }>,
): ProfanityLists {
    const arExact = [...base.arExact];
    const arPhrases = [...base.arPhrases];
    const enExact = [...base.enExact];
    const enPhrases = [...base.enPhrases];
    const francoExact = [...base.francoExact];
    const francoPhrases = [...base.francoPhrases];

    for (const { word, language } of rows) {
        const w = word.trim();
        if (!w) continue;
        const isPhrase = /\s/.test(w);
        const lang = language.toLowerCase();
        if (ARABIC_CHAR.test(w) || lang === 'ar') (isPhrase ? arPhrases : arExact).push(w);
        else if (lang === 'franco' || /\d/.test(w)) (isPhrase ? francoPhrases : francoExact).push(w);
        else (isPhrase ? enPhrases : enExact).push(w);
    }

    return { ...base, arExact, arPhrases, enExact, enPhrases, francoExact, francoPhrases };
}
