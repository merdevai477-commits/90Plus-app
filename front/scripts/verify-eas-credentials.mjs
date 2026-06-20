/**
 * Pre-build credentials check for @90-plus-app/90plus
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontRoot = join(__dirname, '..');
const require = createRequire(import.meta.url);
const easRoot =
  process.env.EAS_CLI_ROOT ??
  'C:\\Users\\Eltwaheed\\AppData\\Roaming\\npm\\node_modules\\eas-cli';

const { createGraphqlClient } = require(join(
  easRoot,
  'build/commandUtils/context/contextUtils/createGraphqlClient.js'
));
const androidApi = require(join(easRoot, 'build/credentials/android/api/GraphqlClient.js'));
const iosApi = require(join(easRoot, 'build/credentials/ios/api/GraphqlClient.js'));
const { getOwnerAccountForProjectIdAsync } = require(join(
  easRoot,
  'build/project/projectUtils.js'
));

function loadSession() {
  const state = JSON.parse(readFileSync(join(homedir(), '.expo', 'state.json'), 'utf8'));
  return state?.auth?.sessionSecret;
}

async function main() {
  const projectId = JSON.parse(readFileSync(join(frontRoot, 'app.json'), 'utf8')).expo.extra.eas
    .projectId;
  const client = createGraphqlClient({ accessToken: null, sessionSecret: loadSession() });
  const account = await getOwnerAccountForProjectIdAsync(client, projectId);

  const androidParams = {
    account,
    projectName: '90plus',
    androidApplicationIdentifier: 'com.mhmdsh1892.ninetyplusapp',
  };
  const iosParams = {
    account,
    projectName: '90plus',
    bundleIdentifier: 'com.mhmdsh1892.ninetyplusapp',
  };

  const issues = [];
  const ok = [];

  const androidCreds = await androidApi.getAndroidAppCredentialsWithCommonFieldsAsync(
    client,
    androidParams
  );
  const androidBuildList = await androidApi.getAndroidAppBuildCredentialsListAsync(
    client,
    androidParams
  );
  const defaultAndroidBuild = androidBuildList.find((b) => b.isDefault);

  if (!defaultAndroidBuild?.androidKeystore) {
    issues.push('Android: missing default keystore');
  } else {
    ok.push(`Android keystore: ${defaultAndroidBuild.androidKeystore.type} (${defaultAndroidBuild.name})`);
  }
  if (!androidCreds?.googleServiceAccountKeyForFcmV1) {
    issues.push('Android: missing FCM V1 service account');
  } else {
    ok.push('Android FCM V1: configured');
  }

  const iosCommon = await iosApi.getIosAppCredentialsWithCommonFieldsAsync(client, iosParams);
  const iosStoreCreds = await iosApi.getIosAppCredentialsWithBuildCredentialsAsync(
    client,
    iosParams,
    { iosDistributionType: 'APP_STORE' }
  );
  const pushKey = iosCommon?.pushKey ?? (await iosApi.getPushKeyForAppAsync(client, iosParams));
  const distCert = await iosApi.getDistributionCertificateForAppAsync(
    client,
    iosParams,
    'APP_STORE',
    {}
  );

  if (!distCert) {
    issues.push('iOS: missing distribution certificate (APP_STORE)');
  } else {
    ok.push(`iOS distribution certificate: ${distCert.serialNumber?.slice?.(0, 8) ?? 'configured'}...`);
  }

  const storeBuild = iosStoreCreds?.iosAppBuildCredentialsList?.[0];
  if (!storeBuild?.provisioningProfile) {
    issues.push('iOS: missing provisioning profile (APP_STORE)');
  } else {
    ok.push('iOS provisioning profile: configured');
  }
  if (!pushKey) {
    issues.push('iOS: missing push key (APNs)');
  } else {
    ok.push(`iOS push key: ${pushKey.keyIdentifier}`);
  }

  console.log('=== Pre-build check @90-plus-app/90plus ===\n');
  for (const line of ok) console.log('OK  ', line);
  for (const line of issues) console.log('FAIL', line);

  const files = [
    ['google-services.json', join(frontRoot, 'google-services.json')],
    ['eas.json', join(frontRoot, 'eas.json')],
  ];
  for (const [name, path] of files) {
    try {
      readFileSync(path);
      console.log('OK  ', `Local file: ${name}`);
    } catch {
      issues.push(`Missing local file: ${name}`);
      console.log('FAIL', `Missing local file: ${name}`);
    }
  }

  console.log('\n' + (issues.length ? `NOT READY (${issues.length} issue(s))` : 'READY FOR BUILD'));
  process.exit(issues.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
