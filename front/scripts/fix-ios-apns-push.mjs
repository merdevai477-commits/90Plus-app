/**
 * Diagnose + fix iOS APNs push credentials on EAS.
 * Requires: Expo login (.expo/state.json) + Apple Developer login (keychain or EXPO_APPLE_* env).
 *
 * Usage:
 *   node scripts/fix-ios-apns-push.mjs           # diagnose only
 *   node scripts/fix-ios-apns-push.mjs --fix     # assign valid key or create new one
 */
import 'dotenv/config';
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
  'build/commandUtils/context/contextUtils/createGraphqlClient.js',
));
const iosApi = require(join(easRoot, 'build/credentials/ios/api/GraphqlClient.js'));
const { getOwnerAccountForProjectIdAsync } = require(join(
  easRoot,
  'build/project/projectUtils.js',
));
const { CredentialsContext } = require(join(easRoot, 'build/credentials/context.js'));
const { CreatePushKey } = require(join(easRoot, 'build/credentials/ios/actions/CreatePushKey.js'));
const { AssignPushKey } = require(join(easRoot, 'build/credentials/ios/actions/AssignPushKey.js'));
const { getValidAndTrackedPushKeysOnEasServersAsync } = require(join(
  easRoot,
  'build/credentials/ios/actions/PushKeyUtils.js',
));
const { isPushKeyValidAndTrackedAsync } = require(join(
  easRoot,
  'build/credentials/ios/validators/validatePushKey.js',
));

const BUNDLE_ID = 'com.mhmdsh1892.ninetyplusapp';
const PROJECT_NAME = '90plus';

function loadSession() {
  const state = JSON.parse(readFileSync(join(homedir(), '.expo', 'state.json'), 'utf8'));
  return state?.auth?.sessionSecret;
}

function loadProjectId() {
  return JSON.parse(readFileSync(join(frontRoot, 'app.json'), 'utf8')).expo.extra.eas.projectId;
}

function easPushKeyToAppleShape(pushKey) {
  return {
    apnsKeyId: pushKey.keyIdentifier,
    teamId: pushKey.appleTeam?.appleTeamIdentifier ?? pushKey.appleTeam?.id,
    teamName: pushKey.appleTeam?.appleTeamName ?? pushKey.appleTeam?.name,
  };
}

async function main() {
  const fix = process.argv.includes('--fix');
  const forceNew = process.argv.includes('--force-new');
  const projectId = loadProjectId();
  const graphqlClient = createGraphqlClient({ accessToken: null, sessionSecret: loadSession() });
  const account = await getOwnerAccountForProjectIdAsync(graphqlClient, projectId);
  const appLookupParams = { account, projectName: PROJECT_NAME, bundleIdentifier: BUNDLE_ID };

  const currentPushKey =
    (await iosApi.getIosAppCredentialsWithCommonFieldsAsync(graphqlClient, appLookupParams))?.pushKey ??
    (await iosApi.getPushKeyForAppAsync(graphqlClient, appLookupParams));

  console.log('\n=== iOS APNs Push Key Diagnostic ===\n');
  console.log('App:', `@${account.name}/${PROJECT_NAME}`);
  console.log('Bundle:', BUNDLE_ID);

  if (!currentPushKey) {
    console.log('\nFAIL: No push key assigned to this app on EAS.');
  } else {
    console.log('\nCurrent EAS push key:', currentPushKey.keyIdentifier, `(id=${currentPushKey.id})`);
  }

  const ctx = new CredentialsContext({
    projectDir: frontRoot,
    projectInfo: {
      exp: JSON.parse(readFileSync(join(frontRoot, 'app.json'), 'utf8')).expo,
      projectId,
    },
    user: { accounts: [account], primaryAccount: account },
    graphqlClient,
    analytics: { logEvent: () => {} },
    vcsClient: { resolveProjectRootAsync: async () => frontRoot },
    nonInteractive: true,
    autoAcceptCredentialReuse: true,
    shouldAskAuthenticateAppStore: false,
  });

  try {
    await ctx.appStore.ensureUserAuthenticatedAsync();
    console.log('Apple auth: OK (user session)');
  } catch (err) {
    console.error('\nFAIL: Cannot authenticate with Apple Developer.');
    console.error('Run `eas credentials -p ios` locally and log in, or set EXPO_APPLE_ID + keychain password.');
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const appleKeys = await ctx.appStore.listPushKeysAsync();
  console.log(`\nPush keys on Apple Developer Portal: ${appleKeys.length}`);
  for (const k of appleKeys) {
    console.log(`  - ${k.id}  ${k.name ?? ''}`);
  }

  const easKeys = await iosApi.getPushKeysForAccountAsync(graphqlClient, account);
  console.log(`\nPush keys stored on EAS: ${easKeys.length}`);
  for (const k of easKeys) {
    const onApple = appleKeys.some((a) => a.id === k.keyIdentifier);
    console.log(`  - ${k.keyIdentifier}  onApple=${onApple ? 'yes' : 'NO (revoked/missing)'}`);
  }

  if (currentPushKey) {
    const valid = await isPushKeyValidAndTrackedAsync(ctx, easPushKeyToAppleShape(currentPushKey));
    console.log(`\nCurrent key valid on Apple: ${valid ? 'YES' : 'NO ← likely cause of InvalidProviderToken'}`);
  }

  const validOnEas = await getValidAndTrackedPushKeysOnEasServersAsync(ctx, easKeys);
  console.log(`Valid keys on EAS+Apple: ${validOnEas.length}`);
  for (const k of validOnEas) {
    console.log(`  ✓ ${k.keyIdentifier}`);
  }

  if (!fix) {
    console.log('\nRun with --fix to assign a valid key or generate a new one.\n');
    return;
  }

  let targetKey = null;

  if (forceNew) {
    console.log('\n--force-new: generating a fresh Apple push key for Expo...');
    try {
      targetKey = await new CreatePushKey(account).runAsync({
        ...ctx,
        nonInteractive: false,
        autoAcceptCredentialReuse: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('maximum allowed number')) {
        throw err;
      }
      // Apple allows 3 APNs keys — revoke the oldest Expo-generated key and retry.
      const stale = appleKeys.find((k) => k.name?.includes('Expo Push Notifications Key'));
      if (!stale) {
        throw new Error(
          'Apple APNs key limit reached and no stale Expo key found to revoke. Revoke one key manually in Apple Developer → Keys.',
        );
      }
      console.log(`\nRevoking stale Expo key on Apple: ${stale.id} (${stale.name})`);
      await ctx.appStore.revokePushKeyAsync([stale.id]);
      targetKey = await new CreatePushKey(account).runAsync({
        ...ctx,
        nonInteractive: false,
        autoAcceptCredentialReuse: true,
      });
    }
  } else {
    targetKey = validOnEas.find((k) => k.id !== currentPushKey?.id) ?? validOnEas[0] ?? null;

    if (!targetKey) {
      console.log('\nNo valid push key found — creating a new Apple push key...');
      targetKey = await new CreatePushKey(account).runAsync({
        ...ctx,
        nonInteractive: false,
        autoAcceptCredentialReuse: true,
      });
    } else {
      console.log(`\nAssigning valid push key: ${targetKey.keyIdentifier}`);
    }
  }

  await new AssignPushKey(appLookupParams).runAsync(ctx, targetKey);
  console.log('\nDone. Re-test push with:');
  console.log(
    '  npx tsx scripts/audit-push-tokens.ts --send-test --clerk-user-id user_3EoCgDb6yn1SDqLWqDexQWMIvKM',
  );
  console.log(
    '\nIf receipt still fails, run a new iOS production build so provisioning profile picks up the key.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
