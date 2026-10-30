/**
 * U1 — boot-time schema guard.
 */

const mockQueryRaw = jest.fn();

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: { $queryRawUnsafe: (...a: unknown[]) => mockQueryRaw(...a) },
}));

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  checkSchemaAtBoot,
  computeSchemaStatus,
  getSchemaStatus,
  listRepoMigrations,
  REQUIRED_COLUMNS,
} from '../schema-guard.service';

const allColumns = Object.entries(REQUIRED_COLUMNS).flatMap(([table_name, cols]) =>
  cols.map((column_name) => ({ table_name, column_name })),
);
const done = (name: string) => ({ migration_name: name, finished_at: new Date(), rolled_back_at: null });

describe('computeSchemaStatus', () => {
  it('reports SCHEMA_MISMATCH when repo migration unrecorded (U1)', () => {
    const r = computeSchemaStatus(['001_a', '002_b'], [done('001_a')], allColumns);
    expect(r.ok).toBe(false);
    expect(r.pendingMigrations).toEqual(['002_b']);
  });

  it('treats rolled-back row with later success as applied (U1, prod shape)', () => {
    const r = computeSchemaStatus(
      ['001_a'],
      [
        { migration_name: '001_a', finished_at: null, rolled_back_at: new Date() },
        done('001_a'),
      ],
      allColumns,
    );
    expect(r.ok).toBe(true);
  });

  it('rolled-back-only row counts as pending', () => {
    const r = computeSchemaStatus(
      ['001_a'],
      [{ migration_name: '001_a', finished_at: null, rolled_back_at: new Date() }],
      allColumns,
    );
    expect(r.pendingMigrations).toEqual(['001_a']);
  });

  it('flags missing settled columns (U1)', () => {
    const r = computeSchemaStatus(
      [],
      [],
      allColumns.filter((c) => c.column_name !== 'settledHomeScore'),
    );
    expect(r.ok).toBe(false);
    expect(r.missingColumns).toEqual(['predictions.settledHomeScore']);
  });

  it('ok when everything is recorded and present', () => {
    expect(computeSchemaStatus(['001_a'], [done('001_a')], allColumns).ok).toBe(true);
  });
});

describe('listRepoMigrations', () => {
  it('lists only numbered migration directories', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
    fs.mkdirSync(path.join(dir, '20260101000000_a'));
    fs.writeFileSync(path.join(dir, 'migration_lock.toml'), '');
    expect(listRepoMigrations(dir)).toEqual(['20260101000000_a']);
  });

  it('returns null when directory is missing', () => {
    expect(listRepoMigrations(path.join(os.tmpdir(), 'does-not-exist-xyz'))).toBeNull();
  });
});

describe('checkSchemaAtBoot', () => {
  beforeEach(() => mockQueryRaw.mockReset());

  it('marks mismatch when a column is missing in the live DB', async () => {
    mockQueryRaw.mockImplementation(async (sql: string) => {
      if (sql.includes('_prisma_migrations')) {
        return (listRepoMigrations() ?? []).map(done);
      }
      return [];
    });
    const s = await checkSchemaAtBoot();
    expect(s.checked).toBe(true);
    expect(s.ok).toBe(false);
    expect(s.missingColumns.length).toBe(Object.values(REQUIRED_COLUMNS).flat().length);
    expect(getSchemaStatus().ok).toBe(false);
  });

  it('stays permissive when the check itself throws', async () => {
    mockQueryRaw.mockRejectedValue(new Error('db down'));
    const s = await checkSchemaAtBoot();
    expect(s.ok).toBe(true);
    expect(s.checked).toBe(false);
    expect(s.error).toBe('db down');
  });
});
