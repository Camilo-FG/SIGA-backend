-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'JUSTIFICADA';

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('SINPE', 'TRANSFERENCIA', 'EFECTIVO');

-- CreateEnum
CREATE TYPE "PaymentPeriodicity" AS ENUM ('MENSUAL', 'UNICO');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "students" ADD COLUMN "nationalId" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "photoPath" TEXT,
ADD COLUMN "enrolledAt" DATE NOT NULL DEFAULT CURRENT_DATE;

-- AlterTable
ALTER TABLE "guardians" ADD COLUMN "nationalId" TEXT;

-- AlterTable
ALTER TABLE "student_guardians" ADD COLUMN "isPaymentResponsible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "charges" ADD COLUMN "annulReason" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "method" "PaymentMethod" NOT NULL DEFAULT 'EFECTIVO',
ADD COLUMN "rejectionReason" TEXT,
ADD COLUMN "registeredById" TEXT,
ADD COLUMN "validatedById" TEXT,
ADD COLUMN "validatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "attendance_sessions" ADD COLUMN "cancelled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "note" TEXT;

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN "observation" TEXT;

-- CreateTable
CREATE TABLE "group_schedules" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT,
    CONSTRAINT "group_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_concepts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "periodicity" "PaymentPeriodicity" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "students_nationalId_key" ON "students"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "guardians_nationalId_key" ON "guardians"("nationalId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_concepts_name_key" ON "payment_concepts"("name");

-- CreateIndex
CREATE INDEX "group_schedules_groupId_dayOfWeek_idx" ON "group_schedules"("groupId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_schedules" ADD CONSTRAINT "group_schedules_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
