/**
 * Print SHA-1 fingerprints of all Android keystores on EAS for 90plus.
 */
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const easRoot =
  process.env.EAS_CLI_ROOT ??
  'C:\\Users\\Eltwaheed\\AppData\\Roaming\\npm\\node_modules\\eas-cli';

const { createGraphqlClient } = require(join(
  easRoot,
  'build/commandUtils/context/contextUtils/createGraphqlClient.js',
));
const androidApi = require(join(
  easRoot,
  'build/credentials/android/api/GraphqlClient.js',
));
const { getOwnerAccountForProjectIdAsync } = require(join(
  easRoot,
  'build/project/projectUtils.js',
));

const TARGET = '9A:5F:85:D0:63:90:EE:74:99:70:3E:36:E1:F9:65:E0:CF:A6:73:11';

async function main() {
  const state = JSON.parse(readFileSync(join(homedir(), '.expo', 'state.json'), 'utf8'));
  const client = createGraphqlClient({
    accessToken: null,
    sessionSecret: state?.auth?.sessionSecret,
  });
  const projectId = JSON.parse(
    readFileSync(join(__dirname, '..', 'app.json'), 'utf8'),
  ).expo.extra.eas.projectId;
  const account = await getOwnerAccountForProjectIdAsync(client, projectId);

  const params = {
    account,
    projectName: '90plus',
    androidApplicationIdentifier: 'com.mhmdsh1892.ninetyplusapp',
  };

  const list = await androidApi.getAndroidAppBuildCredentialsListAsync(client, params);
  console.log('Account:', account.name);
  for (const cred of list ?? []) {
    const k = cred.androidKeystore;
    if (!k) continue;
    console.log('\n---', cred.name, '---');
    console.log('id:', k.id);
    console.log('alias:', k.keyAlias);
    console.log('type:', k.type);
    console.log('SHA1:', k.sha1CertificateFingerprint);
    console.log('SHA256:', k.sha256CertificateFingerprint);
    console.log('created:', k.createdAt);
    if (k.sha1CertificateFingerprint?.toUpperCase().includes('9A:5F:85')) {
      console.log('*** THIS IS THE PLAY UPLOAD KEY ***');
      const out = join(__dirname, '..', 'RECOVERED-upload-keystore.p12');
      writeFileSync(out, Buffer.from(k.keystore, 'base64'));
      writeFileSync(
        join(__dirname, '..', 'RECOVERED-keystore-passwords.txt'),
        `keystorePassword=${k.keystorePassword}\nkeyAlias=${k.keyAlias}\nkeyPassword=${k.keyPassword ?? k.keystorePassword}\n`,
      );
      console.log('Saved:', out);
    }
  }
  console.log('\nPlay expects:', TARGET);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
