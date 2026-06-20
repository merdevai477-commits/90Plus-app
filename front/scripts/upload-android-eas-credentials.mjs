/**
 * Upload Android keystore + FCM V1 service account to EAS (90-plus-app).
 * Uses the logged-in eas session from ~/.expo/state.json
 *
 * Usage (from front/):
 *   node scripts/upload-android-eas-credentials.mjs
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontRoot = join(__dirname, '..');

const KEYSTORE_P12 =
  process.env.EAS_KEYSTORE_PATH ??
  'C:\\Users\\Eltwaheed\\Downloads\\@mrdev_10__90plus-keystore-backup\\90plus-upload.p12';
const FCM_JSON =
  process.env.EAS_FCM_JSON_PATH ??
  'C:\\Users\\Eltwaheed\\Downloads\\plus-63a27-2ef165c873d1.json';
const CREDS_MD =
  process.env.EAS_KEYSTORE_CREDS_MD ??
  'C:\\Users\\Eltwaheed\\Downloads\\@mrdev_10__90plus-keystore-backup\\@mrdev_10__90plus-keystore-credentials.md';

function loadKeystorePasswords() {
  const md = readFileSync(CREDS_MD, 'utf8');
  const storePass = md.match(/keystore password:\s*(\S+)/i)?.[1];
  const alias = md.match(/key alias:\s*(\S+)/i)?.[1];
  if (!storePass || !alias) {
    throw new Error(`Could not parse keystore credentials from ${CREDS_MD}`);
  }
  // PKCS12 (.p12) uses a single password for store + key
  return { storePass, alias, keyPass: storePass };
}

const require = createRequire(import.meta.url);
const easRoot =
  process.env.EAS_CLI_ROOT ??
  'C:\\Users\\Eltwaheed\\AppData\\Roaming\\npm\\node_modules\\eas-cli';
const { createGraphqlClient } = require(join(
  easRoot,
  'build/commandUtils/context/contextUtils/createGraphqlClient.js'
));
const androidApi = require(join(easRoot, 'build/credentials/android/api/GraphqlClient.js'));
const { getKeystoreWithType } = require(join(
  easRoot,
  'build/credentials/android/utils/keystoreNew.js'
));
const { readAndValidateServiceAccountKey } = require(join(
  easRoot,
  'build/credentials/android/utils/googleServiceAccountKey.js'
));
const { getOwnerAccountForProjectIdAsync } = require(join(
  easRoot,
  'build/project/projectUtils.js'
));

function loadSessionSecret() {
  const statePath = join(homedir(), '.expo', 'state.json');
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  const secret = state?.auth?.sessionSecret;
  if (!secret) {
    throw new Error('Not logged in. Run: eas login');
  }
  return secret;
}

function loadProjectId() {
  const appJson = JSON.parse(readFileSync(join(frontRoot, 'app.json'), 'utf8'));
  const id = appJson?.expo?.extra?.eas?.projectId;
  if (!id) throw new Error('Missing extra.eas.projectId in app.json');
  return id;
}

async function main() {
  const sessionSecret = loadSessionSecret();
  const projectId = loadProjectId();
  const graphqlClient = createGraphqlClient({ accessToken: null, sessionSecret });

  const account = await getOwnerAccountForProjectIdAsync(graphqlClient, projectId);
  const appLookupParams = {
    account,
    projectName: '90plus',
    androidApplicationIdentifier: 'com.mhmdsh1892.ninetyplusapp',
  };

  const { storePass, alias, keyPass } = loadKeystorePasswords();

  console.log('Account:', account.name);
  console.log('Uploading keystore from', KEYSTORE_P12);

  const keystoreBase64 = readFileSync(KEYSTORE_P12).toString('base64');
  const keystoreWithType = getKeystoreWithType({
    keystore: keystoreBase64,
    keystorePassword: storePass,
    keyAlias: alias,
    keyPassword: keyPass,
  });
  console.log('Keystore type:', keystoreWithType.type);

  const keystoreFragment = await androidApi.createKeystoreAsync(
    graphqlClient,
    account,
    keystoreWithType
  );
  console.log('Keystore created on EAS:', keystoreFragment.id);

  const buildCredentials = await androidApi.createAndroidAppBuildCredentialsAsync(
    graphqlClient,
    appLookupParams,
    {
      name: 'Production Upload Keystore',
      isDefault: true,
      androidKeystoreId: keystoreFragment.id,
    }
  );
  console.log('Build credentials linked:', buildCredentials.id);

  console.log('Uploading FCM V1 from', FCM_JSON);
  const jsonKey = readAndValidateServiceAccountKey(FCM_JSON);
  const gsaKey = await androidApi.createGoogleServiceAccountKeyAsync(
    graphqlClient,
    account,
    jsonKey
  );
  console.log('Google Service Account Key uploaded:', gsaKey.id);

  const appCredentials = await androidApi.updateAndroidAppCredentialsAsync(
    graphqlClient,
    await androidApi.createOrGetExistingAndroidAppCredentialsWithBuildCredentialsAsync(
      graphqlClient,
      appLookupParams
    ),
    { googleServiceAccountKeyForFcmV1Id: gsaKey.id }
  );
  console.log('FCM V1 assigned to app credentials:', appCredentials.id);
  console.log('\nDone. Android keystore + FCM V1 are on @90-plus-app/90plus');
}

main().catch((err) => {
  console.error('Upload failed:', err?.message ?? err);
  if (err?.graphQLErrors) {
    for (const e of err.graphQLErrors) console.error(' GraphQL:', e.message);
  }
  process.exit(1);
});
