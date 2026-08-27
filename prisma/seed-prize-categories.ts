/**
 * Idempotent seed for Predict & Win prize categories (upsert on `key`).
 * Safe to run in any environment — never deletes existing rows.
 *
 * Names, descriptions and ordering are taken from the Figma category grid
 * (file X50fmaHSieVpdANUHVi3zL, node 665:5767). `icon` stays null so the app
 * renders the bundled Figma illustration matched on `key`; set it to a URL to
 * override artwork without shipping a release.
 *
 * Usage: npx ts-node --project prisma/tsconfig.json prisma/seed-prize-categories.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  { key: 'sportswear', nameAr: 'ملابس وأحذية رياضية', nameEn: 'Sportswear & shoes', description: 'أحذية، قمصان، أطقم رياضية وغيرها', descriptionEn: 'Shoes, shirts, kits and more', sortOrder: 1 },
  { key: 'tickets', nameAr: 'تذاكر', nameEn: 'Tickets', description: 'تذاكر مباريات، فعاليات وحفلات', descriptionEn: 'Match, event and concert tickets', sortOrder: 2 },
  { key: 'cash', nameAr: 'كاش', nameEn: 'Cash', description: 'جوائز مالية ومبالغ نقدية من 100 جنيه إلى أكثر', descriptionEn: 'Cash prizes from 100 EGP upwards', sortOrder: 3 },
  { key: 'food', nameAr: 'مطاعم وكافيهات', nameEn: 'Restaurants & cafés', description: 'وجبات، مشروبات، حلويات، والعديد', descriptionEn: 'Meals, drinks, desserts and more', sortOrder: 4 },
  { key: 'vouchers', nameAr: 'قسائم شراء', nameEn: 'Gift vouchers', description: 'كوبونات وقسائم شراء من متاجر', descriptionEn: 'Store coupons and shopping vouchers', sortOrder: 5 },
  { key: 'electronics', nameAr: 'إلكترونيات', nameEn: 'Electronics', description: 'هواتف، سماعات، أجهزة، وإكسسوارات', descriptionEn: 'Phones, headphones, devices and accessories', sortOrder: 6 },
  { key: 'fitness', nameAr: 'لياقة وصحة', nameEn: 'Fitness & health', description: 'عضويات، مكملات، أدوات رياضية وصحية', descriptionEn: 'Memberships, supplements, training gear', sortOrder: 7 },
  { key: 'football-gear', nameAr: 'مستلزمات كرة القدم', nameEn: 'Football gear', description: 'كرات، شوزات، قفازات، وإكسسوارات', descriptionEn: 'Balls, boots, gloves and accessories', sortOrder: 8 },
  { key: 'gaming', nameAr: 'ألعاب وترفيه', nameEn: 'Gaming & fun', description: 'ألعاب فيديو، بلايستيشن، اكسسوارات وألعاب', descriptionEn: 'Video games, consoles, accessories and toys', sortOrder: 9 },
  { key: 'other', nameAr: 'أخرى', nameEn: 'Other', description: 'أي نوع اخر من الجوائز', descriptionEn: 'Any other kind of prize', sortOrder: 10 },
];

async function main() {
  console.log('🌱 Seeding prize categories...');
  for (const category of CATEGORIES) {
    await prisma.prizeCategory.upsert({
      where: { key: category.key },
      create: category,
      update: {
        nameAr: category.nameAr,
        nameEn: category.nameEn,
        description: category.description,
        descriptionEn: category.descriptionEn,
        sortOrder: category.sortOrder,
      },
    });
  }
  console.log(`✅ Seeded ${CATEGORIES.length} prize categories`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding prize categories:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
