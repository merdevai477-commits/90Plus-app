-- AlterTable
ALTER TABLE "users" ADD COLUMN     "age" INTEGER DEFAULT 22,
ADD COLUMN     "countryFlag" TEXT DEFAULT '🇪🇬',
ADD COLUMN     "height" INTEGER DEFAULT 180,
ADD COLUMN     "position" TEXT DEFAULT 'RW',
ADD COLUMN     "preferredFoot" TEXT DEFAULT 'R',
ADD COLUMN     "weight" INTEGER DEFAULT 70;
