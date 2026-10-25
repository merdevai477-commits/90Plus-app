/**
 * English profanity. The matcher lowercases, maps leetspeak (0→o, 1→i, 3→e,
 * 4→a, 5→s, 7→t, @→a, $→s…), tolerates repeated letters and re-joins letters
 * split by spaces or punctuation (f.u.c.k, f u c k).
 */

/** Exact tokens. */
export const EN_EXACT: readonly string[] = [
    'fck', 'fuk', 'fuq', 'fking', 'fkn', 'fkin', 'fcking', 'fcuk', 'phuck', 'phuk',
    'stfu', 'gtfo', 'kys', 'ass', 'dick', 'dicks', 'cock', 'cocks', 'pussy', 'pussies',
    'twat', 'prick', 'douche', 'fag', 'tits', 'titties', 'cum', 'porn', 'milf', 'hentai',
    'bullshit', 'horseshit', 'dipshit', 'dumbass', 'jackass', 'asses', 'biatch',
    'skank', 'thot', 'tranny',
];

/** Token starts-with (catches fucking, bitches, shithead…). */
export const EN_PREFIX: readonly string[] = [
    'fuck', 'motherfuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'fagg', 'nigg',
    'retard', 'wank', 'dickhead', 'cocksuck', 'asshol', 'arsehol', 'bastard', 'dildo',
    'blowjob', 'douchebag', 'jerkoff', 'pornhub',
];

/** Multi-word. */
export const EN_PHRASES: readonly string[] = [
    'kill yourself', 'kill urself', 'go die', 'suck my', 'piss off', 'son of a bitch',
    'jerk off', 'eat shit', 'up yours',
];

/** Substrings safe to catch even when glued to other words. */
export const EN_EMBEDDED: readonly string[] = [
    'fuck', 'motherf', 'nigger', 'nigga', 'bitch', 'whore', 'blowjob', 'cocksuck',
];

/** Legit words that start with a prefix above. */
export const EN_ALLOW: readonly string[] = [
    'shitake', 'shiitake', 'bitchute', 'assess', 'assist', 'assistant', 'assume', 'class',
    'passing', 'scunthorpe', 'cocktail', 'dickens', 'cumulative', 'grasshopper',
];

/** The short list the reels moderator has always used (kept stable for reels). */
export const EN_LEGACY: readonly string[] = [
    'fuck', 'shit', 'bitch', 'asshole', 'bastard',
    'dick', 'cock', 'pussy', 'cunt', 'whore', 'slut', 'fag', 'nigger',
    'retard', 'piss',
];
