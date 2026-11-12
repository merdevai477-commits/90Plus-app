import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Railway applied this file at checksum da6b94cd... Editing it makes
 * `prisma migrate deploy` refuse to start. The hash is of the file bytes.
 */
const APPLIED_CHECKSUM = 'da6b94cdd67c35f0539025172c6e04ec6f86dc316d93af36231be665762f1df1';

describe('squad lock migration checksum', () => {
  it('matches the checksum Railway already applied', () => {
    const file = readFileSync(
      path.join(process.cwd(), 'prisma/migrations/20261112190000_squad_lock_7_days/migration.sql'),
    );
    expect(createHash('sha256').update(file).digest('hex')).toBe(APPLIED_CHECKSUM);
  });
});
