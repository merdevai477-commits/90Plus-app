/**
 * Keep every numeral in Western/Latin form (0-9).
 *
 * Arabic UI copy stays Arabic; only the digit shapes are pinned so scores,
 * clocks, dates, and XP never flip to Eastern Arabic-Indic (٠١٢٣) or
 * Persian (۰۱۲۳) digits via Intl, the device locale, or translated strings.
 */

export const LATIN_NUMBERING_SYSTEM = 'latn' as const;

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const EXTENDED_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/g;
const ARABIC_NUMERIC_SEPARATORS: Record<string, string> = {
  '\u066A': '%',
  '\u066B': '.',
  '\u066C': ',',
};

type IntlLocales = string | string[];

let installed = false;

/** Convert Eastern/Persian digits and Arabic numeric separators to Latin. */
export function toLatinDigits(value: string | number): string {
  return String(value)
    .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x06F0))
    .replace(/[\u066A\u066B\u066C]/g, (ch) => ARABIC_NUMERIC_SEPARATORS[ch] ?? ch);
}

export function hasNonLatinDigits(value: string): boolean {
  return /[\u0660-\u0669\u06F0-\u06F9]/.test(value);
}

/**
 * BCP-47 tag for `Intl` / `toLocale*String`.
 * Arabic keeps Arabic month names; numbering is always Latin.
 */
export function localeWithLatinNumerals(language: string): string {
  const code = (language || 'en').trim().toLowerCase();
  if (code === 'ar' || code.startsWith('ar-') || code.startsWith('ar_')) {
    return 'ar-EG-u-nu-latn';
  }
  return 'en-US';
}

export function withLatinNumberingOptions<T extends object | undefined>(
  options?: T,
): (T & { numberingSystem: 'latn' }) | { numberingSystem: 'latn' } {
  return { ...(options as object | undefined), numberingSystem: LATIN_NUMBERING_SYSTEM };
}

function wrapStringFn<Args extends unknown[]>(
  original: (...args: Args) => string,
): (...args: Args) => string {
  return function wrapped(this: unknown, ...args: Args): string {
    return toLatinDigits(original.apply(this, args));
  };
}

function wrapPartsFn<Args extends unknown[]>(
  original: (...args: Args) => Array<{ value: string }>,
): (...args: Args) => Array<{ value: string }> {
  return function wrapped(this: unknown, ...args: Args): Array<{ value: string }> {
    return original.apply(this, args).map((part) => ({
      ...part,
      value: toLatinDigits(part.value),
    }));
  };
}

function patchFormatMethods(proto: object): void {
  const keys = ['format', 'formatRange', 'formatToParts', 'formatRangeToParts'] as const;
  for (const key of keys) {
    const desc = Object.getOwnPropertyDescriptor(proto, key);
    if (!desc || desc.configurable === false) continue;

    if (typeof desc.get === 'function') {
      const originalGet = desc.get;
      Object.defineProperty(proto, key, {
        configurable: true,
        enumerable: desc.enumerable,
        get: function patchedFormatGetter(this: unknown) {
          const fn = originalGet.call(this);
          if (typeof fn !== 'function') return fn;
          if (key === 'formatToParts' || key === 'formatRangeToParts') {
            return wrapPartsFn(fn as (...args: unknown[]) => Array<{ value: string }>);
          }
          return wrapStringFn(fn as (...args: unknown[]) => string);
        },
      });
      continue;
    }

    if (typeof desc.value === 'function') {
      const original = desc.value as (...args: unknown[]) => unknown;
      Object.defineProperty(proto, key, {
        ...desc,
        value:
          key === 'formatToParts' || key === 'formatRangeToParts'
            ? wrapPartsFn(original as (...args: unknown[]) => Array<{ value: string }>)
            : wrapStringFn(original as (...args: unknown[]) => string),
      });
    }
  }
}

function patchCtor(name: 'NumberFormat' | 'DateTimeFormat' | 'RelativeTimeFormat'): void {
  const Original = (Intl as unknown as Record<string, unknown>)[name] as
    | (new (locales?: IntlLocales, options?: object) => object)
    | undefined;
  if (typeof Original !== 'function') return;

  function Patched(this: unknown, locales?: IntlLocales, options?: object) {
    return Reflect.construct(
      Original,
      [locales, withLatinNumberingOptions(options)],
      new.target || Patched,
    );
  }

  Patched.prototype = Original.prototype;
  Object.defineProperty(Patched, 'name', { value: name });
  const supported = (Original as { supportedLocalesOf?: unknown }).supportedLocalesOf;
  if (typeof supported === 'function') {
    (Patched as { supportedLocalesOf: unknown }).supportedLocalesOf = supported.bind(Original);
  }

  try {
    Object.defineProperty(Intl, name, {
      configurable: true,
      writable: true,
      value: Patched,
    });
  } catch {
    (Intl as unknown as Record<string, unknown>)[name] = Patched;
  }
}

function patchPrototypeMethod(proto: object, key: string): void {
  const desc = Object.getOwnPropertyDescriptor(proto, key);
  if (!desc || typeof desc.value !== 'function' || desc.configurable === false) return;
  const original = desc.value as (locales?: IntlLocales, options?: object) => string;
  Object.defineProperty(proto, key, {
    ...desc,
    value: function patchedToLocale(
      this: unknown,
      locales?: IntlLocales,
      options?: object,
    ): string {
      try {
        return toLatinDigits(original.call(this, locales, withLatinNumberingOptions(options)));
      } catch {
        return toLatinDigits(original.call(this, locales, options));
      }
    },
  });
}

/**
 * Pin Latin digits on Intl + `toLocale*String`. Safe to call more than once.
 */
export function installLatinNumerals(): void {
  if (installed) return;
  installed = true;

  try {
    patchCtor('NumberFormat');
  } catch {
    /* Hermes / test env may freeze Intl */
  }
  try {
    patchCtor('DateTimeFormat');
  } catch {
    /* ignore */
  }
  try {
    patchCtor('RelativeTimeFormat');
  } catch {
    /* ignore */
  }

  try {
    patchFormatMethods(Intl.NumberFormat.prototype);
  } catch {
    /* ignore */
  }
  try {
    patchFormatMethods(Intl.DateTimeFormat.prototype);
  } catch {
    /* ignore */
  }
  try {
    if (typeof Intl.RelativeTimeFormat === 'function') {
      patchFormatMethods(Intl.RelativeTimeFormat.prototype);
    }
  } catch {
    /* ignore */
  }

  try {
    patchPrototypeMethod(Number.prototype, 'toLocaleString');
  } catch {
    /* ignore */
  }
  try {
    patchPrototypeMethod(Date.prototype, 'toLocaleString');
    patchPrototypeMethod(Date.prototype, 'toLocaleDateString');
    patchPrototypeMethod(Date.prototype, 'toLocaleTimeString');
  } catch {
    /* ignore */
  }
}

installLatinNumerals();
