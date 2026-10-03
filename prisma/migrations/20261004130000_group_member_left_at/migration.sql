-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN "leftAt" TIMESTAMP(3);

-- Rows unlinked by the earlier leave flow are members who left.
UPDATE "GroupMember" SET "leftAt" = NOW() WHERE "userId" IS NULL AND "inviteTokenHash" IS NULL;
