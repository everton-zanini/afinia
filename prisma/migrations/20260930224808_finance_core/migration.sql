-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('CHECKING', 'CASH', 'RESERVE');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'EFFECTIVE');

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" "CategoryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_account" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "openingBalanceCents" INTEGER NOT NULL,
    "openingDate" DATE NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transaction" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "categoryId" TEXT,
    "accountId" TEXT NOT NULL,
    "toAccountId" TEXT,
    "dueDate" DATE NOT NULL,
    "effectiveDate" DATE,
    "responsibleMemberId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "month" CHAR(7) NOT NULL,
    "categoryId" TEXT NOT NULL,
    "limitCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_householdId_kind_idx" ON "category"("householdId", "kind");

-- CreateIndex
CREATE INDEX "category_parentId_idx" ON "category"("parentId");

-- CreateIndex
CREATE INDEX "financial_account_householdId_idx" ON "financial_account"("householdId");

-- CreateIndex
CREATE INDEX "financial_transaction_householdId_effectiveDate_idx" ON "financial_transaction"("householdId", "effectiveDate");

-- CreateIndex
CREATE INDEX "financial_transaction_householdId_dueDate_idx" ON "financial_transaction"("householdId", "dueDate");

-- CreateIndex
CREATE INDEX "financial_transaction_householdId_accountId_idx" ON "financial_transaction"("householdId", "accountId");

-- CreateIndex
CREATE INDEX "financial_transaction_householdId_toAccountId_idx" ON "financial_transaction"("householdId", "toAccountId");

-- CreateIndex
CREATE INDEX "financial_transaction_householdId_categoryId_idx" ON "financial_transaction"("householdId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transaction_householdId_idempotencyKey_key" ON "financial_transaction"("householdId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "budget_householdId_month_categoryId_key" ON "budget"("householdId", "month", "categoryId");

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_account" ADD CONSTRAINT "financial_account_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "financial_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_responsibleMemberId_fkey" FOREIGN KEY ("responsibleMemberId") REFERENCES "household_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Invariantes do Afinia (não representáveis no schema Prisma)
-- ---------------------------------------------------------------------------

ALTER TABLE "financial_transaction"
  ADD CONSTRAINT "transaction_amount_range" CHECK ("amountCents" > 0 AND "amountCents" <= 1000000000),
  ADD CONSTRAINT "transaction_status_effective_date" CHECK (("status" = 'EFFECTIVE') = ("effectiveDate" IS NOT NULL)),
  ADD CONSTRAINT "transaction_kind_shape" CHECK (
    ("kind" = 'TRANSFER' AND "toAccountId" IS NOT NULL AND "categoryId" IS NULL AND "toAccountId" <> "accountId")
    OR ("kind" <> 'TRANSFER' AND "toAccountId" IS NULL AND "categoryId" IS NOT NULL)
  ),
  ADD CONSTRAINT "transaction_description_not_blank" CHECK (length(btrim("description")) > 0);

ALTER TABLE "budget"
  ADD CONSTRAINT "budget_limit_positive" CHECK ("limitCents" > 0 AND "limitCents" <= 1000000000),
  ADD CONSTRAINT "budget_month_format" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "category"
  ADD CONSTRAINT "category_not_own_parent" CHECK ("parentId" IS NULL OR "parentId" <> "id"),
  ADD CONSTRAINT "category_name_not_blank" CHECK (length(btrim("name")) > 0);

-- Isolamento entre casais: toda referência precisa pertencer ao mesmo household.
CREATE FUNCTION "afinia_assert_same_household"(ref_table regclass, ref_id text, household text, label text)
RETURNS void AS $$
DECLARE
  found boolean;
BEGIN
  IF ref_id IS NULL THEN
    RETURN;
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE "id" = $1 AND "householdId" = $2)', ref_table)
    INTO found USING ref_id, household;
  IF NOT found THEN
    RAISE EXCEPTION 'afinia_tenant_mismatch: %', label USING ERRCODE = '23503';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "afinia_transaction_tenant_guard"() RETURNS trigger AS $$
BEGIN
  PERFORM "afinia_assert_same_household"('"financial_account"', NEW."accountId", NEW."householdId", 'account');
  PERFORM "afinia_assert_same_household"('"financial_account"', NEW."toAccountId", NEW."householdId", 'toAccount');
  PERFORM "afinia_assert_same_household"('"category"', NEW."categoryId", NEW."householdId", 'category');
  PERFORM "afinia_assert_same_household"('"household_member"', NEW."responsibleMemberId", NEW."householdId", 'responsibleMember');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "financial_transaction_tenant_guard"
  BEFORE INSERT OR UPDATE ON "financial_transaction"
  FOR EACH ROW EXECUTE FUNCTION "afinia_transaction_tenant_guard"();

CREATE FUNCTION "afinia_category_tenant_guard"() RETURNS trigger AS $$
BEGIN
  PERFORM "afinia_assert_same_household"('"category"', NEW."parentId", NEW."householdId", 'parent');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "category_tenant_guard"
  BEFORE INSERT OR UPDATE ON "category"
  FOR EACH ROW EXECUTE FUNCTION "afinia_category_tenant_guard"();

CREATE FUNCTION "afinia_budget_tenant_guard"() RETURNS trigger AS $$
BEGIN
  PERFORM "afinia_assert_same_household"('"category"', NEW."categoryId", NEW."householdId", 'category');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "budget_tenant_guard"
  BEFORE INSERT OR UPDATE ON "budget"
  FOR EACH ROW EXECUTE FUNCTION "afinia_budget_tenant_guard"();

-- O casal de um registro financeiro nunca muda.
CREATE FUNCTION "afinia_household_immutable"() RETURNS trigger AS $$
BEGIN
  IF NEW."householdId" <> OLD."householdId" THEN
    RAISE EXCEPTION 'afinia_household_immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "category_household_immutable" BEFORE UPDATE ON "category"
  FOR EACH ROW EXECUTE FUNCTION "afinia_household_immutable"();
CREATE TRIGGER "financial_account_household_immutable" BEFORE UPDATE ON "financial_account"
  FOR EACH ROW EXECUTE FUNCTION "afinia_household_immutable"();
CREATE TRIGGER "financial_transaction_household_immutable" BEFORE UPDATE ON "financial_transaction"
  FOR EACH ROW EXECUTE FUNCTION "afinia_household_immutable"();
CREATE TRIGGER "budget_household_immutable" BEFORE UPDATE ON "budget"
  FOR EACH ROW EXECUTE FUNCTION "afinia_household_immutable"();