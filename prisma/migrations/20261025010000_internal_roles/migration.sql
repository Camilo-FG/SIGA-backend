-- Migrate legacy roles to the internal SIGA role set without editing the
-- already-versioned initial migration.
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

ALTER TYPE "Role" RENAME TO "Role_legacy";

CREATE TYPE "Role" AS ENUM (
    'DIRECTOR_GENERAL',
    'DIRECTOR_ADMINISTRATIVO',
    'ASISTENTE_DIRECCION',
    'COREOGRAFO',
    'PROFESOR'
);

ALTER TABLE "users"
    ALTER COLUMN "role" TYPE "Role"
    USING (
        CASE "role"::text
            WHEN 'ADMIN' THEN 'DIRECTOR_ADMINISTRATIVO'::"Role"
            ELSE 'PROFESOR'::"Role"
        END
    );

DROP TYPE "Role_legacy";

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'PROFESOR';
