-- CreateEnum
CREATE TYPE "CardPurchaseStatus" AS ENUM ('FORECAST', 'CONFIRMED');

-- AlterTable
ALTER TABLE "financial_transaction" ADD COLUMN     "invoiceId" TEXT;

-- AlterTable
ALTER TABLE "recurring_rule" ALTER COLUMN "accountId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "recurring_series" ADD COLUMN     "cardId" TEXT;

-- CreateTable
CREATE TABLE "credit_card" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "lastFour" CHAR(4),
    "color" TEXT NOT NULL,
    "limitCents" INTEGER NOT NULL,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "holderMemberId" TEXT NOT NULL,
    "paymentAccountId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_invoice" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "closingDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_purchase" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "status" "CardPurchaseStatus" NOT NULL,
    "description" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "categoryId" TEXT NOT NULL,
    "responsibleMemberId" TEXT,
    "notes" TEXT,
    "installmentCount" INTEGER NOT NULL DEFAULT 1,
    "invoiceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "seriesId" TEXT,
    "occurrenceIndex" INTEGER,
    "seriesOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_installment" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_card_householdId_idx" ON "credit_card"("householdId");

-- CreateIndex
CREATE INDEX "card_invoice_householdId_dueDate_idx" ON "card_invoice"("householdId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "card_invoice_cardId_closingDate_key" ON "card_invoice"("cardId", "closingDate");

-- CreateIndex
CREATE INDEX "card_purchase_householdId_cardId_idx" ON "card_purchase"("householdId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "card_purchase_householdId_idempotencyKey_key" ON "card_purchase"("householdId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "card_purchase_seriesId_occurrenceIndex_key" ON "card_purchase"("seriesId", "occurrenceIndex");

-- CreateIndex
CREATE INDEX "card_installment_invoiceId_idx" ON "card_installment"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "card_installment_purchaseId_index_key" ON "card_installment"("purchaseId", "index");

-- CreateIndex
CREATE INDEX "financial_transaction_invoiceId_idx" ON "financial_transaction"("invoiceId");

-- AddForeignKey
ALTER TABLE "financial_transaction" ADD CONSTRAINT "financial_transaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "card_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_series" ADD CONSTRAINT "recurring_series_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "credit_card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card" ADD CONSTRAINT "credit_card_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card" ADD CONSTRAINT "credit_card_holderMemberId_fkey" FOREIGN KEY ("holderMemberId") REFERENCES "household_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card" ADD CONSTRAINT "credit_card_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "financial_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_invoice" ADD CONSTRAINT "card_invoice_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_invoice" ADD CONSTRAINT "card_invoice_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "credit_card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchase" ADD CONSTRAINT "card_purchase_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchase" ADD CONSTRAINT "card_purchase_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "credit_card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchase" ADD CONSTRAINT "card_purchase_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchase" ADD CONSTRAINT "card_purchase_responsibleMemberId_fkey" FOREIGN KEY ("responsibleMemberId") REFERENCES "household_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchase" ADD CONSTRAINT "card_purchase_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "card_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchase" ADD CONSTRAINT "card_purchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_purchase" ADD CONSTRAINT "card_purchase_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "recurring_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_installment" ADD CONSTRAINT "card_installment_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_installment" ADD CONSTRAINT "card_installment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "card_purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_installment" ADD CONSTRAINT "card_installment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "card_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Invariantes de cartões (não representáveis no schema Prisma)
-- ---------------------------------------------------------------------------

ALTER TABLE "credit_card"
  ADD CONSTRAINT "card_name_not_blank" CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "card_limit_range" CHECK ("limitCents" > 0 AND "limitCents" <= 1000000000),
  ADD CONSTRAINT "card_closing_day" CHECK ("closingDay" BETWEEN 1 AND 31),
  ADD CONSTRAINT "card_due_day" CHECK ("dueDay" BETWEEN 1 AND 31),
  ADD CONSTRAINT "card_last_four" CHECK ("lastFour" IS NULL OR "lastFour" ~ '^[0-9]{4}$');

ALTER TABLE "card_invoice"
  ADD CONSTRAINT "invoice_dates" CHECK ("periodStart" <= "closingDate" AND "closingDate" < "dueDate");

ALTER TABLE "card_purchase"
  ADD CONSTRAINT "purchase_total_range" CHECK ("totalCents" > 0 AND "totalCents" <= 1000000000),
  ADD CONSTRAINT "purchase_installment_count" CHECK ("installmentCount" BETWEEN 1 AND 48),
  ADD CONSTRAINT "purchase_forecast_single" CHECK ("status" <> 'FORECAST' OR "installmentCount" = 1),
  ADD CONSTRAINT "purchase_description_not_blank" CHECK (length(btrim("description")) > 0),
  ADD CONSTRAINT "purchase_series_position" CHECK (("seriesId" IS NULL) = ("occurrenceIndex" IS NULL)),
  ADD CONSTRAINT "purchase_occurrence_index_nonnegative" CHECK ("occurrenceIndex" IS NULL OR "occurrenceIndex" >= 0);

ALTER TABLE "card_installment"
  ADD CONSTRAINT "installment_amount_range" CHECK ("amountCents" > 0 AND "amountCents" <= 1000000000),
  ADD CONSTRAINT "installment_index_range" CHECK ("index" BETWEEN 1 AND 48);

-- Pagamento de fatura: sem categoria nem destino, sempre efetivado e com fatura; os demais tipos não têm fatura.
ALTER TABLE "financial_transaction" DROP CONSTRAINT "transaction_kind_shape";
ALTER TABLE "financial_transaction"
  ADD CONSTRAINT "transaction_kind_shape" CHECK (
    ("kind" = 'TRANSFER' AND "toAccountId" IS NOT NULL AND "categoryId" IS NULL AND "toAccountId" <> "accountId" AND "invoiceId" IS NULL)
    OR ("kind" = 'CARD_PAYMENT' AND "toAccountId" IS NULL AND "categoryId" IS NULL AND "invoiceId" IS NOT NULL AND "status" = 'EFFECTIVE')
    OR ("kind" IN ('INCOME', 'EXPENSE') AND "toAccountId" IS NULL AND "categoryId" IS NOT NULL AND "invoiceId" IS NULL)
  );

ALTER TABLE "recurring_series"
  ADD CONSTRAINT "series_card_expense_only" CHECK ("cardId" IS NULL OR "kind" = 'EXPENSE');

-- Isolamento entre casais.
CREATE OR REPLACE FUNCTION "afinia_transaction_tenant_guard"() RETURNS trigger AS $$
BEGIN
  PERFORM "afinia_assert_same_household"('"financial_account"', NEW."accountId", NEW."householdId", 'account');
  PERFORM "afinia_assert_same_household"('"financial_account"', NEW."toAccountId", NEW."householdId", 'toAccount');
  PERFORM "afinia_assert_same_household"('"category"', NEW."categoryId", NEW."householdId", 'category');
  PERFORM "afinia_assert_same_household"('"household_member"', NEW."responsibleMemberId", NEW."householdId", 'responsibleMember');
  PERFORM "afinia_assert_same_household"('"recurring_series"', NEW."seriesId", NEW."householdId", 'series');
  PERFORM "afinia_assert_same_household"('"card_invoice"', NEW."invoiceId", NEW."householdId", 'invoice');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "afinia_card_tenant_guard"() RETURNS trigger AS $$
BEGIN
  PERFORM "afinia_assert_same_household"('"household_member"', NEW."holderMemberId", NEW."householdId", 'holder');
  PERFORM "afinia_assert_same_household"('"financial_account"', NEW."paymentAccountId", NEW."householdId", 'paymentAccount');
  PERFORM "afinia_assert_not_benefit"(NEW."paymentAccountId");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "credit_card_tenant_guard"
  BEFORE INSERT OR UPDATE ON "credit_card"
  FOR EACH ROW EXECUTE FUNCTION "afinia_card_tenant_guard"();

-- Fatura: datas e cartão gravados na criação, nunca recalculados.
CREATE FUNCTION "afinia_invoice_guard"() RETURNS trigger AS $$
BEGIN
  PERFORM "afinia_assert_same_household"('"credit_card"', NEW."cardId", NEW."householdId", 'card');
  IF TG_OP = 'UPDATE' AND (
    NEW."cardId" <> OLD."cardId" OR NEW."periodStart" <> OLD."periodStart"
    OR NEW."closingDate" <> OLD."closingDate" OR NEW."dueDate" <> OLD."dueDate"
  ) THEN
    RAISE EXCEPTION 'afinia_invoice_immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "card_invoice_guard"
  BEFORE INSERT OR UPDATE ON "card_invoice"
  FOR EACH ROW EXECUTE FUNCTION "afinia_invoice_guard"();

-- Compra: tudo do mesmo casal; fatura e série do mesmo cartão da compra.
CREATE FUNCTION "afinia_purchase_guard"() RETURNS trigger AS $$
BEGIN
  PERFORM "afinia_assert_same_household"('"credit_card"', NEW."cardId", NEW."householdId", 'card');
  PERFORM "afinia_assert_same_household"('"card_invoice"', NEW."invoiceId", NEW."householdId", 'invoice');
  PERFORM "afinia_assert_same_household"('"category"', NEW."categoryId", NEW."householdId", 'category');
  PERFORM "afinia_assert_same_household"('"household_member"', NEW."responsibleMemberId", NEW."householdId", 'responsibleMember');
  PERFORM "afinia_assert_same_household"('"recurring_series"', NEW."seriesId", NEW."householdId", 'series');
  IF NOT EXISTS (SELECT 1 FROM "card_invoice" WHERE "id" = NEW."invoiceId" AND "cardId" = NEW."cardId") THEN
    RAISE EXCEPTION 'afinia_card_mismatch: invoice' USING ERRCODE = '23514';
  END IF;
  IF NEW."seriesId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "recurring_series" WHERE "id" = NEW."seriesId" AND "cardId" = NEW."cardId"
  ) THEN
    RAISE EXCEPTION 'afinia_card_mismatch: series' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."cardId" <> OLD."cardId" THEN
    RAISE EXCEPTION 'afinia_card_mismatch: immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "card_purchase_guard"
  BEFORE INSERT OR UPDATE ON "card_purchase"
  FOR EACH ROW EXECUTE FUNCTION "afinia_purchase_guard"();

-- Parcela: a fatura precisa ser do mesmo cartão da compra.
CREATE FUNCTION "afinia_installment_guard"() RETURNS trigger AS $$
BEGIN
  PERFORM "afinia_assert_same_household"('"card_purchase"', NEW."purchaseId", NEW."householdId", 'purchase');
  PERFORM "afinia_assert_same_household"('"card_invoice"', NEW."invoiceId", NEW."householdId", 'invoice');
  IF NOT EXISTS (
    SELECT 1 FROM "card_purchase" p JOIN "card_invoice" i ON i."cardId" = p."cardId"
    WHERE p."id" = NEW."purchaseId" AND i."id" = NEW."invoiceId"
  ) THEN
    RAISE EXCEPTION 'afinia_card_mismatch: installment invoice' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "card_installment_guard"
  BEFORE INSERT OR UPDATE ON "card_installment"
  FOR EACH ROW EXECUTE FUNCTION "afinia_installment_guard"();

CREATE TRIGGER "credit_card_household_immutable" BEFORE UPDATE ON "credit_card"
  FOR EACH ROW EXECUTE FUNCTION "afinia_household_immutable"();
CREATE TRIGGER "card_invoice_household_immutable" BEFORE UPDATE ON "card_invoice"
  FOR EACH ROW EXECUTE FUNCTION "afinia_household_immutable"();
CREATE TRIGGER "card_purchase_household_immutable" BEFORE UPDATE ON "card_purchase"
  FOR EACH ROW EXECUTE FUNCTION "afinia_household_immutable"();
CREATE TRIGGER "card_installment_household_immutable" BEFORE UPDATE ON "card_installment"
  FOR EACH ROW EXECUTE FUNCTION "afinia_household_immutable"();

-- Benefício nunca paga fatura.
CREATE OR REPLACE FUNCTION "afinia_transaction_benefit_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."kind" = 'TRANSFER' THEN
    PERFORM "afinia_assert_not_benefit"(NEW."accountId");
    PERFORM "afinia_assert_not_benefit"(NEW."toAccountId");
  ELSIF NEW."kind" = 'CARD_PAYMENT' THEN
    PERFORM "afinia_assert_not_benefit"(NEW."accountId");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Conta que já paga fatura ou é conta sugerida de cartão não pode virar benefício.
CREATE OR REPLACE FUNCTION "afinia_account_benefit_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."kind" = 'BENEFIT' AND OLD."kind" <> 'BENEFIT' AND (
    EXISTS (SELECT 1 FROM "financial_transaction" WHERE "kind" IN ('TRANSFER', 'CARD_PAYMENT') AND ("accountId" = NEW."id" OR "toAccountId" = NEW."id"))
    OR EXISTS (SELECT 1 FROM "recurring_rule" WHERE "toAccountId" IS NOT NULL AND ("accountId" = NEW."id" OR "toAccountId" = NEW."id"))
    OR EXISTS (SELECT 1 FROM "credit_card" WHERE "paymentAccountId" = NEW."id")
  ) THEN
    RAISE EXCEPTION 'afinia_benefit_transfer' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Série com cartão: regras sem conta; série sem cartão: regras com conta.
CREATE OR REPLACE FUNCTION "afinia_rule_tenant_guard"() RETURNS trigger AS $$
DECLARE
  household text;
  series_kind text;
  series_card text;
BEGIN
  SELECT "householdId", "kind"::text, "cardId" INTO household, series_kind, series_card FROM "recurring_series" WHERE "id" = NEW."seriesId";
  PERFORM "afinia_assert_same_household"('"financial_account"', NEW."accountId", household, 'account');
  PERFORM "afinia_assert_same_household"('"financial_account"', NEW."toAccountId", household, 'toAccount');
  PERFORM "afinia_assert_same_household"('"category"', NEW."categoryId", household, 'category');
  PERFORM "afinia_assert_same_household"('"household_member"', NEW."responsibleMemberId", household, 'responsibleMember');
  IF (series_kind = 'TRANSFER') <> (NEW."toAccountId" IS NOT NULL) THEN
    RAISE EXCEPTION 'afinia_rule_kind_mismatch' USING ERRCODE = '23514';
  END IF;
  IF (series_card IS NOT NULL) <> (NEW."accountId" IS NULL) THEN
    RAISE EXCEPTION 'afinia_rule_card_mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "afinia_series_card_guard"() RETURNS trigger AS $$
BEGIN
  PERFORM "afinia_assert_same_household"('"credit_card"', NEW."cardId", NEW."householdId", 'card');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "recurring_series_card_guard"
  BEFORE INSERT OR UPDATE ON "recurring_series"
  FOR EACH ROW EXECUTE FUNCTION "afinia_series_card_guard"();

CREATE OR REPLACE FUNCTION "afinia_series_immutable"() RETURNS trigger AS $$
BEGIN
  IF NEW."kind" <> OLD."kind" OR NEW."frequency" <> OLD."frequency" OR NEW."startDate" <> OLD."startDate"
     OR NEW."cardId" IS DISTINCT FROM OLD."cardId" THEN
    RAISE EXCEPTION 'afinia_series_immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
