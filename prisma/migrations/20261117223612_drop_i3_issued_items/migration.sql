-- I3IssuedItem was an early attempt to store issued equipment in AVUT, abandoned in favour
-- of D4H (the I3 forms write there through the D4H task queue). Nothing creates these rows.

-- DropForeignKey
ALTER TABLE "i3_issued_items" DROP CONSTRAINT "i3_issued_items_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "i3_issued_items" DROP CONSTRAINT "i3_issued_items_personId_fkey";

-- DropTable
DROP TABLE "i3_issued_items";
