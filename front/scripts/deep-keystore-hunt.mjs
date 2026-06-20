/**
 * Deep hunt: list all Android keystores on EAS account + fingerprint local files.
 * Run: node scripts/deep-keystore-hunt.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET_SHA1 = '9A:5F:85:D0:63:90:EE:74:99:70:3E:36:E1:F9:65:E0:CF:A6:73:11';
const ALT_SHA1 = '7D:17:3D:86:F4:B5:95:A3:AC:ED:23:3E:BD:B0:23:B3:CA:4F:F8:29';
const KEYTOOL =
  process.env.KEYTOOL_PATH ??
  'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe';

const PASSES = [
  'c4928759a49d63bde13f6c0995ceba35',
  '1fb37127030e0fef157bd5e1764fcc0a',
  'android',
  'upload',
  'password',
  '123456',
  'ninetyplus',
  '90plus',
];

function normSha1(line) {
  return (line || '').replace(/.*SHA1:\s*/i, '').trim().toUpperCase();
}

function fingerprintFile(file) {
  for (const pass of PASSES) {
    try {
      const out = execSync(
        `"${KEYTOOL}" -list -v -keystore "${file}" -storepass ${pass}`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      const sha1 = normSha1(out.match(/SHA1:.*$/m)?.[0]);
      if (sha1) return { sha1, pass };
    } catch {
      /* try next password */
    }
  }
  return null;
}

function walk(dir, depth = 0, acc = []) {
  if (depth > 6 || !existsSync(dir)) return acc;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (/node_modules|\.git|AppData\\Local\\Temp/i.test(p)) continue;
      walk(p, depth + 1, acc);
    } else if (/\.(jks|p12|keystore)$/i.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

async function probeEas() {
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

  const state = JSON.parse(readFileSync(join(homedir(), '.expo', 'state.json'), 'utf8'));
  const client = createGraphqlClient({
    accessToken: null,
    sessionSecret: state?.auth?.sessionSecret,
  });
  const projectId = JSON.parse(
    readFileSync(join(__dirname, '..', 'app.json'), 'utf8'),
  ).expo.extra.eas.projectId;
  const account = await getOwnerAccountForProjectIdAsync(client, projectId);

  const accounts = [account.name, '90-plus-app1', 'mrdev_10', '90-plus-app'];
  console.log('\n=== EAS Android credentials ===');
  for (const name of [...new Set(accounts)]) {
    const params = {
      account: { id: name, name },
      projectName: '90plus',
      androidApplicationIdentifier: 'com.mhmdsh1892.ninetyplusapp',
    };
    try {
      const list = await androidApi.getAndroidAppBuildCredentialsListAsync(client, params);
      console.log(`\n@${name}: ${list?.length ?? 0} credential(s)`);
      for (const c of list ?? []) {
        const k = c.androidKeystore;
        console.log(`  - ${c.name} default=${c.isDefault} type=${k?.type} id=${k?.id}`);
        if (k?.keyAlias) console.log(`    alias=${k.keyAlias}`);
        if (k?.keyPassword) console.log(`    hasKeyPassword=yes`);
        if (k?.keystorePassword) console.log(`    hasKeystorePassword=yes`);
      }
    } catch (e) {
      console.log(`\n@${name}: ${e?.message ?? e}`);
    }
  }
}

function main() {
  console.log('Target upload key SHA-1:', TARGET_SHA1);
  console.log('Alt documented SHA-1:   ', ALT_SHA1);

  const roots = [
    join(homedir(), 'Downloads'),
    join(homedir(), 'Desktop'),
    join(homedir(), 'Documents'),
    join(homedir(), 'OneDrive'),
    join(__dirname, '..'),
    join(__dirname, '..', '..'),
  ];

  const files = [...new Set(roots.flatMap((r) => walk(r)))];
  console.log(`\n=== Local keystore scan (${files.length} files) ===`);
  let foundTarget = false;
  for (const f of files) {
    const fp = fingerprintFile(f);
    if (!fp) {
      console.log(`SKIP (no password) ${f}`);
      continue;
    }
    const mark =
      fp.sha1 === TARGET_SHA1
        ? '*** PLAY UPLOAD KEY FOUND ***'
        : fp.sha1 === ALT_SHA1
          ? '*** DOCUMENTED KEY (7D:17) ***'
          : '';
    console.log(`${fp.sha1} | ${f} ${mark}`);
    if (fp.sha1 === TARGET_SHA1) foundTarget = true;
  }

  if (!foundTarget) {
    console.log('\n❌ Upload key 9A:5F:85 NOT found locally.');
  }

  return probeEas();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
