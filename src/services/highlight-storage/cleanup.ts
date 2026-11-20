import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';

/**
 * Reports stored assets with no ingestion rows. Does not delete objects or rows.
 */
export async function dryRunHighlightStorageOrphans(): Promise<{ unreferenced: number }> {
  const assets = await prisma.highlightStoredAsset.findMany({
    select: { id: true, _count: { select: { ingestions: true } } },
  });
  const unreferenced = assets.filter((asset) => asset._count.ingestions === 0).length;
  logger.info('[HighlightStorage] dry-run orphan report', { unreferenced });
  return { unreferenced };
}
