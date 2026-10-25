/**
 * Franco-Arabic (Arabizi) profanity — Arabic written with Latin letters and
 * digits (3=ع، 7=ح، 2=ء، 5=خ، 8=غ، 9=ق). Matched against the lowercased text
 * with digits preserved, tolerant of repeated letters.
 */

export const FRANCO_EXACT: readonly string[] = [
    'a7a', 'a7aa', 'kos', 'koss', 'kosom', 'kossom', 'ksom', 'kosomak', 'kosomk', 'kossomak',
    'ksomak', 'kosomek', 'kosomkom', 'kosomha', 'kosokhtak', 'kosekhtak', 'kosommak',
    'teez', 'tez', 'tizak', 'teezak', 'teezo', 'zeb', 'zebby', 'zebi', 'zobr', 'zbr', 'zeby',
    'metnak', 'mitnak', 'metnaka', 'metnaken', 'mnyok', 'manyook', 'manyok', 'mnyk', 'menyak',
    'sharmoot', 'sharmoota', 'sharmouta', 'sharmota', 'sharmot', 'sharameet', 'sharmata',
    '3ars', '3rs', 'm3ars', 'mo3ars', 'me3ars', 'khawal', '5awal', '5wal', 'khwal',
    'wes5', 'wes5a', 'wiskha', 'weskha', 'labwa', 'a7ba', '2a7ba', 'qa7ba', 'ka7ba', '9a7ba',
    'kahba', 'qahba', 'neek', 'neik', 'anikak', 'aneekak', 'hanikak', 'hanekak', 'yel3an',
    'yl3n', 'dayoos', 'dayouth', 'ma3ras', '5ara', 'khara', 'manyak',
];

export const FRANCO_PHRASES: readonly string[] = [
    'kos omak', 'kos ommak', 'kos omk', 'kos okhtak', 'kos ekhtak', 'kos abook',
    'ibn el kalb', 'ebn el kalb', 'ibn el kalba', 'ya kalb', 'ya kalba', 'weld el kalb',
    'ibn el wes5a', 'ebn el wes5a', 'ibn el weskha', 'ebn el weskha', 'ibn el metnaka',
    'ebn el metnaka', 'ibn el sharmoota', 'ebn el sharmoota', 'ibn el 7aram', 'ebn el 7aram',
    'yel3an abook', 'yel3an omak', 'yel3an deenak', 'yel3an dinak', 'yel3an rabak',
    'deen omak', 'din omak', 'deen abook', 'kosom deenak', 'kosom dinak',
    'ya 7mar', 'ya 7omar', 'ya homar', 'ya 7ayawan', 'ya hayawan', 'ya 5anzeer',
    'ya khanzeer', 'ya gazma', 'ya zbala', 'ya zebala', 'ya wes5', 'ya 3ars', 'ya khawal',
    'ya 5awal', 'ya metnak', 'ya manyook', 'ya sharmoota', 'ya labwa', 'ya wati', 'ya waty',
    'ya ghabi', 'ya 8aby', 'ya 8abi', 'ya ahbal', 'ya 3abeet', 'ya mutakhalef', 'ya mot5alef',
    'mos zebby', 'hanikak', 'anik omak', 'aneek omak',
];

export const FRANCO_EMBEDDED: readonly string[] = [
    'sharmoot', 'sharmout', 'metnak', 'manyook', 'kosomak', 'kossomak', 'ebnelkalb',
    'ibnelkalb', 'ebnelwes5a', 'ibnelwes5a',
];
