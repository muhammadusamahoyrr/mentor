-- AlterTable
ALTER TABLE "Note" ADD COLUMN "appointmentId" TEXT;
ALTER TABLE "Note" ADD COLUMN "authorId" TEXT;
ALTER TABLE "Note" ADD COLUMN "authorName" TEXT;
ALTER TABLE "Note" ADD COLUMN "authorRole" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Doctor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "specialization" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Doctor" ("createdAt", "email", "id", "name", "specialization") SELECT "createdAt", "email", "id", "name", "specialization" FROM "Doctor";
DROP TABLE "Doctor";
ALTER TABLE "new_Doctor" RENAME TO "Doctor";
CREATE UNIQUE INDEX "Doctor_externalId_key" ON "Doctor"("externalId");
CREATE UNIQUE INDEX "Doctor_email_key" ON "Doctor"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Note_appointmentId_idx" ON "Note"("appointmentId");
