/**
 * Probe multiple EAS project IDs / slugs for Android keystores.
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
  'build/commandUtils/context/contextUtils/createGraphqlClient.js',
));
const androidApi = require(join(
  easRoot,
  'build/credentials/android/api/GraphqlClient.js',
));

const PROBES = [
  { account: '90-plus-app', project: '90plus', pkg: 'com.mhmdsh1892.ninetyplusapp' },
  { account: '90-plus-app', project: '90plus-backend', pkg: 'com.mhmdsh1892.ninetyplusapp' },
  { account: '90-plus-app1', project: '90plus', pkg: 'com.mhmdsh1892.ninetyplusapp' },
  { account: '90-plus-app1', project: '90plus', pkg: 'com.mrdev187.ninetyplusapp' },
];

async function main() {
  const state = JSON.parse(readFileSync(join(homedir(), '.expo', 'state.json'), 'utf8'));
  const client = createGraphqlClient({
    accessToken: null,
    sessionSecret: state?.auth?.sessionSecret,
  });

  for (const p of PROBES) {
    const params = {
      account: { id: p.account, name: p.account },
      projectName: p.project,
      androidApplicationIdentifier: p.pkg,
    };
    try {
      const list = await androidApi.getAndroidAppBuildCredentialsListAsync(client, params);
      console.log(`\n✅ @${p.account}/${p.project} (${p.pkg}) — ${list?.length ?? 0} cred(s)`);
      for (const c of list ?? []) {
        const k = c.androidKeystore;
        console.log(
          `   ${c.name} SHA1=${k?.sha1CertificateFingerprint ?? 'n/a'} id=${k?.id}`,
        );
      }
    } catch (e) {
      console.log(`\n❌ @${p.account}/${p.project} (${p.pkg}) — ${e?.message ?? e}`);
    }
  }
}

main().catch(console.error);
