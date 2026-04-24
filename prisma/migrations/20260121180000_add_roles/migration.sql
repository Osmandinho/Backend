DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'OWNER'
  ) THEN
    EXECUTE 'ALTER TYPE "Role" RENAME VALUE ''OWNER'' TO ''ADMIN''';
  END IF;
END $$;

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EMPLOYEE';

ALTER TABLE "Membership" ALTER COLUMN "role" SET DEFAULT 'ADMIN';
