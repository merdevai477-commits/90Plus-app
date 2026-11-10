/**
 * After a socket reconnect, each visible fixture stays untrusted until its
 * own snapshot fetch settles. A second reconnect must not start a duplicate
 * fetch for an id that is already in flight.
 */
export async function resyncFixtureSnapshots(
  ids: number[],
  fetchOne: (id: number) => Promise<void>,
  inFlight: Set<number>,
): Promise<Set<number>> {
  const synced = new Set<number>();
  await Promise.all(
    ids.map(async (id) => {
      if (inFlight.has(id)) return;
      inFlight.add(id);
      try {
        await fetchOne(id);
        synced.add(id);
      } catch {
        /* leave unsynced so polling continues for this fixture */
      } finally {
        inFlight.delete(id);
      }
    }),
  );
  return synced;
}

export function allTargetsSynced(targets: number[], synced: Set<number>): boolean {
  return targets.every((id) => synced.has(id));
}
