/**
 * Boot-time schema guard (U1).
 *
 * Compares the migrations shipped in the image with `_prisma_migrations` and
 * probes the columns King settlement writes. On mismatch the settlement
 * pipeline stays off and /health reports DEGRADED instead of crashing.
 */

import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export const REQUIRED_COLUMNS: Record<string, string[]> = {
  predictions: [
    'settledHomeScore',
    'settledAwayScore',
    'settledStatus',
    'settledWinner',
    'settledAt',
  ],
};

export type AppliedMigrationRow = {
  migration_name: string;
  finished_at: Date | string | null;
  rolled_back_at: Date | string | null;
};

export type SchemaStatus = {
  checked: boolean;
  ok: boolean;
  pendingMigrations: string[];
  missingColumns: string[];
  checkedAt: string | null;
  error?: string;
};

let status: SchemaStatus = {
  checked: false,
  ok: true,
  pendingMigrations: [],
  missingColumns: [],
  checkedAt: null,
};

/**
 * A migration counts as applied when at least one row finished without being
 * rolled back — Prisma keeps the failed attempt row next to the later success.
 */
export function computeSchemaStatus(
  repoMigrations: string[],
  appliedRows: AppliedMigrationRow[],
  presentColumns: Array<{ table_name: string; column_name: string }>,
  required: Record<string, string[]> = REQUIRED_COLUMNS,
): Pick<SchemaStatus, 'ok' | 'pendingMigrations' | 'missingColumns'> {
  const applied = new Set(
    appliedRows
      .filter((r) => r.finished_at != null && r.rolled_back_at == null)
      .map((r) => r.migration_name),
  );
  const pendingMigrations = repoMigrations.filter((m) => !applied.has(m)).sort();

  const present = new Set(presentColumns.map((c) => `${c.table_name}.${c.column_name}`));
  const missingColumns: string[] = [];
  for (const [table, cols] of Object.entries(required)) {
    for (const col of cols) {
      if (!present.has(`${table}.${col}`)) missingColumns.push(`${table}.${col}`);
    }
  }

  return {
    ok: pendingMigrations.length === 0 && missingColumns.length === 0,
    pendingMigrations,
    missingColumns,
  };
}

export function listRepoMigrations(dir = path.resolve(process.cwd(), 'prisma', 'migrations')): string[] | null {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d/.test(d.name))
      .map((d) => d.name);
  } catch {
    return null;
  }
}

export async function checkSchemaAtBoot(): Promise<SchemaStatus> {
  try {
    const repo = listRepoMigrations();
    const appliedRows = repo
      ? await prisma.$queryRawUnsafe<AppliedMigrationRow[]>(
          'SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations',
        )
      : [];
    const tables = Object.keys(REQUIRED_COLUMNS);
    const presentColumns = await prisma.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`,
      tables,
    );

    const computed = computeSchemaStatus(repo ?? [], appliedRows, presentColumns);
    status = { checked: true, ...computed, checkedAt: new Date().toISOString() };
    if (!repo) status.error = 'MIGRATIONS_DIR_MISSING';

    if (!status.ok) {
      logger.error(
        JSON.stringify({
          event: 'SCHEMA_MISMATCH',
          pending: status.pendingMigrations,
          missingColumns: status.missingColumns,
        }),
      );
    } else {
      logger.info(JSON.stringify({ event: 'SCHEMA_OK', migrationsChecked: repo?.length ?? 0 }));
    }
  } catch (err: any) {
    // Cannot tell — keep running; settlement re-reads rows and fails loudly on its own.
    status = {
      checked: false,
      ok: true,
      pendingMigrations: [],
      missingColumns: [],
      checkedAt: new Date().toISOString(),
      error: err?.message ?? String(err),
    };
    logger.warn(JSON.stringify({ event: 'SCHEMA_CHECK_FAILED', error: status.error }));
  }
  return status;
}

export function getSchemaStatus(): SchemaStatus {
  return status;
}

export function isSchemaOk(): boolean {
  return status.ok;
}

/** Test hook. */
export function __setSchemaStatusForTests(next: Partial<SchemaStatus>): void {
  status = { ...status, ...next };
}
