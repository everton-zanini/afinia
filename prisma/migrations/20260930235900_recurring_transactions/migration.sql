-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RecurrenceEndMode" AS ENUM ('COUNT', 'UNTIL', 'NONE');

-- AlterTable
ALTER TABLE "financial_transaction" ADD COLUMN     "occurrenceIndex" INTEGER,
ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "seriesOverride" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "recurring_series" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "startDate" DATE NOT NULL,
    "endMode" "RecurrenceEndMode" NOT NULL,
    "occurrenceCount" INTEGER,
    "untilDate" DATE,
    "stopBeforeIndex" INTEGER,
    "stoppedOn" DATE,
    "generatedThroughIndex" INTEGER NOT NULL DEFAULT -1,
    "createdById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_rule" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "fromIndex" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "categoryId" TEXT,
    "accountId" TEXT NOT NULL,
    "toAccountId" TEXT,
    "responsibleMemberId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_exception" (
    "seriesId" TEXT NOT NULL,
    "occurrenceIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_exception_pkey" PRIMARY KEY ("seriesId","occurrenceIndex")
);

-- CreateIndex
CREATE INDEX "recurring_series_householdId_idx" ON "recurring_series"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_series_householdId_idempotencyKey_key" ON "recurring_series"("householdId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_rule_seriesId_fromIndex_key" ON "recurring_rule"("seriesId", "fromIndex");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transaction_seriesId_occurrenceIndex_key" ON "financial_transaction"("seriesId", "occurrenceIndex");

-- AddForeignKey
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "recurring_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_series" ADD CONSTRAINT "recurring_series_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_series" ADD CONSTRAINT "recurring_series_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rule" ADD CONSTRAINT "recurring_rule_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "recurring_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rule" ADD CONSTRAINT "recurring_rule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rule" ADD CONSTRAINT "recurring_rule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rule" ADD CONSTRAINT "recurring_rule_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "financial_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rule" ADD CONSTRAINT "recurring_rule_responsibleMemberId_fkey" FOREIGN KEY ("responsibleMemberId") REFERENCES "household_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_exception" ADD CONSTRAINT "recurring_exception_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "recurring_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Invariantes de recorrência (não representáveis no schema Prisma)
-- ---------------------------------------------------------------------------

ALTER TABLE "financial_transaction"
  ADD CONSTRAINT "transaction_series_position" CHECK (("seriesId" IS NULL) = ("occurrenceIndex" IS NULL)),
  ADD CONSTRAINT "transaction_occurrence_index_nonnegative" CHECK ("occurrenceIndex" IS NULL OR "occurrenceIndex" >= 0);

ALTER TABLE "recurring_series"
  ADD CONSTRAINT "series_end_count" CHECK (("endMode" = 'COUNT') = ("occurrenceCount" IS NOT NULL)),
  ADD CONSTRAINT "series_count_range" CHECK ("occurrenceCount" IS NULL OR "occurrenceCount" BETWEEN 2 AND 600),
  ADD CONSTRAINT "series_end_until" CHECK (("endMode" = 'UNTIL') = ("untilDate" IS NOT NULL)),
  ADD CONSTRAINT "series_until_range" CHECK ("untilDate" IS NULL OR ("untilDate" > "startDate" AND "untilDate" <= "startDate" + INTERVAL '30 years')),
  ADD CONSTRAINT "series_stop_index" CHECK ("stopBeforeIndex" IS NULL OR "stopBeforeIndex" >= 0),
  ADD CONSTRAINT "series_generated_index" CHECK ("generatedThroughIndex" >= -1);

ALTER TABLE "recurring_rule"
  ADD CONSTRAINT "rule_amount_range" CHECK ("amountCents" > 0 AND "amountCents" <= 1000000000),
  ADD CONSTRAINT "rule_from_index" CHECK ("fromIndex" >= 0),
  ADD CONSTRAINT "rule_description_not_blank" CHECK (length(btrim("description")) > 0),
  ADD CONSTRAINT "rule_shape" CHECK (
    ("toAccountId" IS NOT NULL AND "categoryId" IS NULL AND "toAccountId" <> "accountId")
    OR ("toAccountId" IS NULL AND "categoryId" IS NOT NULL)
  );

ALTER TABLE "recurring_exception"
  ADD CONSTRAINT "exception_index_nonnegative" CHECK ("occurrenceIndex" >= 0);

-- Isolamento: a ocorrência também precisa pertencer a uma série do mesmo casal.
CREATE OR REPLACE FUNCTION "afinia_transaction_tenant_guard"() RETURNS trigger AS $$
BEGIN
  PERFORM "afinia_assert_same_household"('"financial_account"', NEW."accountId", NEW."householdId", 'account');
  PERFORM "afinia_assert_same_household"('"financial_account"', NEW."toAccountId", NEW."householdId", 'toAccount');
  PERFORM "afinia_assert_same_household"('"category"', NEW."categoryId", NEW."householdId", 'category');
  PERFORM "afinia_assert_same_household"('"household_member"', NEW."responsibleMemberId", NEW."householdId", 'responsibleMember');
  PERFORM "afinia_assert_same_household"('"recurring_series"', NEW."seriesId", NEW."householdId", 'series');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "afinia_rule_tenant_guard"() RETURNS trigger AS $$
DECLARE
  household text;
  series_kind text;
BEGIN
  SELECT "householdId", "kind"::text INTO household, series_kind FROM "recurring_series" WHERE "id" = NEW."seriesId";
  PERFORM "afinia_assert_same_household"('"financial_account"', NEW."accountId", household, 'account');
  PERFORM "afinia_assert_same_household"('"financial_account"', NEW."toAccountId", household, 'toAccount');
  PERFORM "afinia_assert_same_household"('"category"', NEW."categoryId", household, 'category');
  PERFORM "afinia_assert_same_household"('"household_member"', NEW."responsibleMemberId", household, 'responsibleMember');
  IF (series_kind = 'TRANSFER') <> (NEW."toAccountId" IS NOT NULL) THEN
    RAISE EXCEPTION 'afinia_rule_kind_mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "recurring_rule_tenant_guard"
  BEFORE INSERT OR UPDATE ON "recurring_rule"
  FOR EACH ROW EXECUTE FUNCTION "afinia_rule_tenant_guard"();

CREATE TRIGGER "recurring_series_household_immutable" BEFORE UPDATE ON "recurring_series"
  FOR EACH ROW EXECUTE FUNCTION "afinia_household_immutable"();

-- Tipo, frequência e data inicial da série são imutáveis.
CREATE FUNCTION "afinia_series_immutable"() RETURNS trigger AS $$
BEGIN
  IF NEW."kind" <> OLD."kind" OR NEW."frequency" <> OLD."frequency" OR NEW."startDate" <> OLD."startDate" THEN
    RAISE EXCEPTION 'afinia_series_immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "recurring_series_immutable" BEFORE UPDATE ON "recurring_series"
  FOR EACH ROW EXECUTE FUNCTION "afinia_series_immutable"();