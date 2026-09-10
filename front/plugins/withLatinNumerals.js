/**
 * Force Western digits (0-9) in native Android text even when the device
 * language is Arabic. Fabric's TextPaint uses Locale.getDefault(), and Cairo
 * includes Eastern Arabic-Indic glyphs — without this, "90" becomes "٩٠".
 */

const {
  AndroidConfig,
  withAndroidStyles,
  withMainApplication,
  createRunOncePlugin,
} = require('expo/config-plugins');

const MARKER = '90plus-latin-numerals';

const KOTLIN_SNIPPET = `    // ${MARKER}: keep 0-9 even when the device locale is Arabic
    try {
      val defaultLocale = java.util.Locale.getDefault()
      val latinDigitsLocale = java.util.Locale.Builder()
        .setLocale(defaultLocale)
        .setUnicodeLocaleKeyword("nu", "latn")
        .build()
      java.util.Locale.setDefault(latinDigitsLocale)
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
        android.os.LocaleList.setDefault(android.os.LocaleList(latinDigitsLocale))
      }
    } catch (_: Throwable) {}
`;

const JAVA_SNIPPET = `    // ${MARKER}: keep 0-9 even when the device locale is Arabic
    try {
      java.util.Locale defaultLocale = java.util.Locale.getDefault();
      java.util.Locale latinDigitsLocale = new java.util.Locale.Builder()
          .setLocale(defaultLocale)
          .setUnicodeLocaleKeyword("nu", "latn")
          .build();
      java.util.Locale.setDefault(latinDigitsLocale);
      if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
        android.os.LocaleList.setDefault(new android.os.LocaleList(latinDigitsLocale));
      }
    } catch (Throwable ignored) {}
`;

function withLatinNumeralsMainApplication(config) {
  return withMainApplication(config, (modConfig) => {
    if (modConfig.modResults.contents.includes(MARKER)) {
      return modConfig;
    }

    const snippet =
      modConfig.modResults.language === 'kt' ? KOTLIN_SNIPPET : JAVA_SNIPPET;
    const next = modConfig.modResults.contents.replace(
      /super\.onCreate\(\);\s*/,
      `super.onCreate();\n${snippet}\n`,
    );

    if (next === modConfig.modResults.contents) {
      console.warn(
        `[${MARKER}] Could not find super.onCreate() in MainApplication; skipped locale patch.`,
      );
    } else {
      modConfig.modResults.contents = next;
    }

    return modConfig;
  });
}

function withLatinNumeralsStyles(config) {
  return withAndroidStyles(config, (modConfig) => {
    modConfig.modResults = AndroidConfig.Styles.assignStylesValue(modConfig.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'android:textLocale',
      value: 'en-US',
    });
    return modConfig;
  });
}

function withLatinNumerals(config) {
  return withLatinNumeralsStyles(withLatinNumeralsMainApplication(config));
}

module.exports = createRunOncePlugin(withLatinNumerals, MARKER, '1.0.0');
