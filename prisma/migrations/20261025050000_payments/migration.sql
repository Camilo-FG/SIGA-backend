CREATE TYPE "ChargeStatus" AS ENUM ('PENDIENTE', 'PAGADO', 'VENCIDO', 'CANCELADO');
CREATE TYPE "ReceiptStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

CREATE TABLE "charges" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "period" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "ChargeStatus" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "receiptUrl" TEXT,
    "receiptStatus" "ReceiptStatus" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "charges_studentId_concept_period_key" ON "charges"("studentId", "concept", "period");
CREATE INDEX "charges_studentId_status_idx" ON "charges"("studentId", "status");
CREATE INDEX "charges_period_idx" ON "charges"("period");
CREATE INDEX "payments_chargeId_idx" ON "payments"("chargeId");
ALTER TABLE "charges" ADD CONSTRAINT "charges_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
