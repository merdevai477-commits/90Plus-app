/**
 * Prune stale / test Mux assets to free slots on the free-tier 10-asset cap.
 *
 * Usage: npx tsx scripts/prune-mux-assets.ts [count]
 */
import 'dotenv/config';
import { listMuxAssets } from '../src/services/mux.service';
import { freeMuxAssetSlots } from '../src/services/mux-cleanup.service';

async function main() {
  const need = Math.max(1, Number.parseInt(process.argv[2] ?? '1', 10) || 1);
  const before = await listMuxAssets(100);
  console.log(`Mux assets before: ${before.length}`);
  const freed = await freeMuxAssetSlots(need);
  const after = await listMuxAssets(100);
  console.log(`Deleted: ${freed}`);
  console.log(`Mux assets after: ${after.length}`);
  process.exit(freed > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
