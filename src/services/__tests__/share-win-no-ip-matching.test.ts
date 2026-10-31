import fs from 'fs';
import path from 'path';

/**
 * Guardrail: IP-based referral matching must stay deleted.
 */
describe('Share & Win — no IP matching', () => {
  const root = path.join(__dirname, '..', '..');

  const forbidden = [
    'rememberInviteClick',
    'scheduleInstallClickAttribution',
    'drainPendingInstallAttributions',
    'INSTALL_CLICK_CONFLICT',
    'sw:install-click:',
    'sw:pending-attr:',
  ];

  test('source tree has no IP-matching referral symbols', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === 'dist' || name === '__tests__') continue;
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|js|md)$/.test(name)) continue;
        if (name.includes('share-win-no-ip-matching')) continue;
        const text = fs.readFileSync(full, 'utf8');
        for (const needle of forbidden) {
          if (text.includes(needle)) hits.push(`${full}: ${needle}`);
        }
      }
    };
    walk(path.join(root, 'services'));
    walk(path.join(root, 'routes'));
    // Dead install-click file must not exist.
    expect(
      fs.existsSync(path.join(root, 'services', 'share-win-install-click.service.ts')),
    ).toBe(false);
    expect(hits).toEqual([]);
  });
});
