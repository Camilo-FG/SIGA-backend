ALTER TABLE "student_groups" ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "student_groups" ADD COLUMN "endedAt" TIMESTAMP(3);

-- Existing memberships have no recorded start. Keep them valid for attendance already taken.
UPDATE "student_groups" SET "startedAt" = TIMESTAMP '2000-01-01 00:00:00';
