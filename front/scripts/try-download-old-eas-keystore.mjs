/**
 * Try to list/download Android keystores from old @90-plus-app1 project.
 * Run from front/: node scripts/try-download-old-eas-keystore.mjs
 */
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const easRoot =
  process.env.EAS_CLI_ROOT ??
  'C:\\Users\\Eltwaheed\\AppData\\Roaming\\npm\\node_modules\\eas-cli';

const { createGraphqlClient } = require(join(
  easRoot,
  'build/commandUtils/context/contextUtils/createGraphqlClient.js'
));
const androidApi = require(join(easRoot, 'build/credentials/android/api/GraphqlClient.js'));

const OLD_PROJECT_ID = 'fb514ea5-f43c-4443-b295-a258b5a022cb';
const PACKAGE = 'com.mhmdsh1892.ninetyplusapp';

function loadSession() {
  const state = JSON.parse(readFileSync(join(homedir(), '.expo', 'state.json'), 'utf8'));
  return state?.auth?.sessionSecret;
}

async function probeAccount(client, accountName) {
  const account = { id: accountName, name: accountName };
  const params = {
    account,
    projectName: '90plus',
    androidApplicationIdentifier: PACKAGE,
  };
  try {
    const list = await androidApi.getAndroidAppBuildCredentialsListAsync(client, params);
    console.log(`\n[${accountName}] build credentials:`, list?.length ?? 0);
    for (const cred of list ?? []) {
      console.log(' -', cred.name, cred.isDefault ? '(default)' : '', cred.androidKeystore?.type ?? 'no keystore');
      if (cred.androidKeystore?.id) {
        console.log('   keystore id:', cred.androidKeystore.id);
      }
    }
  } catch (e) {
    console.log(`[${accountName}] error:`, e?.message ?? e);
  }
}

async function main() {
  const client = createGraphqlClient({ accessToken: null, sessionSecret: loadSession() });
  console.log('Logged in — probing EAS Android credentials for 90plus');
  await probeAccount(client, '90-plus-app');
  await probeAccount(client, '90-plus-app1');
  await probeAccount(client, 'mrdev_10');
  console.log('\nOld project id (from terminal):', OLD_PROJECT_ID);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
