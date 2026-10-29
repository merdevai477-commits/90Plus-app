import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { CK_WEEKLY_BUDGET_MILLI } from '../src/services/coach-king-scoring';

async function main() {
  const result = await prisma.coachKingWallet.updateMany({
    data: { balanceMilli: CK_WEEKLY_BUDGET_MILLI },
  });
  console.log(JSON.stringify({ renewed: result.count, budget: `${CK_WEEKLY_BUDGET_MILLI / 10}M` }));
}

main()
  .then(async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
