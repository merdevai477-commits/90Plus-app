/**
 * 365Scores transfer completion. Club/league feeds mix rumours with done deals;
 * `statusId` is stable across languages (`statusName` is not).
 *
 * Observed: 2 = completed ("Confirmed" / "انتقالات تمت"), 5 = rumour ("Rumor" / "تقارير").
 */

export const SCORES365_TRANSFER_STATUS_CONFIRMED = 2;
export const SCORES365_TRANSFER_STATUS_RUMOR = 5;

const RUMOR_STATUS_NAME =
  /rumour|rumor|شائع|تقارير|שמועה/i;
const CONFIRMED_STATUS_NAME =
  /confirmed|completed|تمت|مؤكد|אושרה/i;

export interface Scores365TransferStatusFields {
  statusId?: number | null;
  statusName?: string | null;
}

export function isCompleted365Transfer(row: Scores365TransferStatusFields): boolean {
  if (row.statusId === SCORES365_TRANSFER_STATUS_CONFIRMED) return true;
  if (typeof row.statusId === 'number' && Number.isFinite(row.statusId)) return false;

  const name = (row.statusName ?? '').trim();
  if (!name) return false;
  if (RUMOR_STATUS_NAME.test(name)) return false;
  return CONFIRMED_STATUS_NAME.test(name);
}

export function filterCompleted365Transfers<T extends Scores365TransferStatusFields>(
  rows: T[] | null | undefined,
): T[] {
  if (!rows?.length) return [];
  return rows.filter(isCompleted365Transfer);
}
