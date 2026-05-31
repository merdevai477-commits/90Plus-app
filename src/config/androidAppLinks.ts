/**
 * Android App Links — release signing certificate fingerprints.
 * Used by /.well-known/assetlinks.json so https://90plus.app/* opens the app.
 *
 * SHA-1  → Google Play Console / Firebase / OAuth (reference only here)
 * SHA-256 → Required in assetlinks.json for verified App Links
 */

export const ANDROID_PACKAGE_NAME = 'com.mhmdsh1892.ninetyplusapp';

/** Release keystore SHA-1 (Google Play / Firebase console) */
export const ANDROID_RELEASE_SHA1 =
  '7D:17:3D:86:F4:B5:95:A3:AC:ED:23:3E:BD:B0:23:B3:CA:4F:F8:29';

/** Release keystore SHA-256 (Android App Links verification) */
export const ANDROID_RELEASE_SHA256 =
  'B9:AF:90:A5:F8:31:6E:B3:67:D2:94:EA:ED:ED:58:99:F6:BE:9C:FE:6A:9B:29:70:72:32:C4:D4:D0:07:C6:E8';

/** Default fingerprints served when ANDROID_RELEASE_SHA256 env is unset */
export const DEFAULT_ANDROID_SHA256_FINGERPRINTS: string[] = [ANDROID_RELEASE_SHA256];

/** Merge env (comma-separated) with defaults; dedupe case-insensitively */
export function resolveAndroidSha256Fingerprints(envValue?: string): string[] {
  const fromEnv = (envValue ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const merged = [...fromEnv, ...DEFAULT_ANDROID_SHA256_FINGERPRINTS.map((f) => f.toUpperCase())];
  return [...new Set(merged)];
}

export function buildAssetLinksJson(fingerprints: string[]) {
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: ANDROID_PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
