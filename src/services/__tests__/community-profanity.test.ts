import { createProfanityMatcher, mergeBannedWords, DEFAULT_PROFANITY_LISTS } from '../community-profanity';

const matcher = createProfanityMatcher();
const flagged = (text: string) => matcher.check(text).flagged;

describe('community profanity matcher', () => {
    describe('catches Arabic insults', () => {
        it.each([
            'انت شرموط',
            'يا ابن الكلب',
            'ابن الوسخة',
            'كسمك يا عم',
            'كس امك',
            'ك س م ك',
            'شـــرمـوط',
            'شررررموط',
            'والشرموطة دي',
            'الحكم متناك',
            'يلعن دينك',
            'ياكلب',
            'إبن الكلب',
            'ابنالكلب',
            'الحكم معرص',
            'يا خول',
            'وكسمك',
            'كسختك',
        ])('%s', (text) => {
            expect(flagged(text)).toBe(true);
        });
    });

    describe('catches English insults and obfuscation', () => {
        it.each([
            'fuck you',
            'F U C K',
            'f.u.c.k this',
            'fuuuuuck',
            'f*ck',
            'sh1t team',
            'you are a b!tch',
            'motherfucker',
            'youfuckingidiot',
            'stfu',
            'kill yourself',
            'a55hole',
            'what a bullshit decision',
        ])('%s', (text) => {
            expect(flagged(text)).toBe(true);
        });
    });

    describe('catches Franco (Arabizi) insults', () => {
        it.each([
            'a7a ya 3am',
            'kosomak',
            'kos omak',
            'ya ibn el kalb',
            'ebn el wes5a',
            'enta metnak',
            'sharmoota',
            'ya 3ars',
            'yakalb',
        ])('%s', (text) => {
            expect(flagged(text)).toBe(true);
        });
    });

    describe('does not flag clean football talk', () => {
        it.each([
            'باريس تكسب في ماتش النهاردة؟ شاركوني رأيكم🔥',
            'المنافسة شديدة 🔥',
            'الزبون دايما على حق',
            'خولة بتشجع الأهلي',
            'كسبنا الماتش بعد كسر الدفاع',
            'لابس نايكي جديد',
            'نيك بوب حارس عظيم',
            'الكلب بتاعي بيتفرج على الماتش',
            'Great assist by Salah',
            'Classic Arsenal performance',
            'FK Crvena Zvezda won',
            'Is this the shiitake pizza?',
            'cocktail after the match',
            'Liverpool pass the ball',
            '#ماتش_النهارده @mohamed',
            'قرار غبي من الحكم',
        ])('%s', (text) => {
            expect(flagged(text)).toBe(false);
        });
    });

    it('merges admin-added BannedWord rows', () => {
        const custom = createProfanityMatcher(
            mergeBannedWords(DEFAULT_PROFANITY_LISTS, [
                { word: 'كلمةممنوعة', language: 'ar' },
                { word: 'badword', language: 'en' },
            ]),
        );
        expect(custom.check('دي كلمةممنوعة').flagged).toBe(true);
        expect(custom.check('this is a badword').flagged).toBe(true);
        expect(matcher.check('this is a badword').flagged).toBe(false);
    });
});
