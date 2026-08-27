/** Bundled Predict & Win prize categories — upserted on first catalogue read. */
export const DEFAULT_PRIZE_CATEGORIES = [
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
] as const;
