-- AlterTable
ALTER TABLE "KhataEntry" ADD COLUMN "dueDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "KhataEntry_userId_dueDate_idx" ON "KhataEntry"("userId", "dueDate");
