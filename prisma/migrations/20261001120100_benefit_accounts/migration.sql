-- CreateEnum
CREATE TYPE "BenefitPurpose" AS ENUM ('FOOD', 'MEAL', 'MOBILITY', 'FLEXIBLE', 'OTHER');

-- AlterTable (aditiva: contas existentes ficam sem finalidade)
ALTER TABLE "financial_account" ADD COLUMN "benefitPurpose" "BenefitPurpose";

ALTER TABLE "financial_account"
  ADD CONSTRAINT "account_benefit_purpose" CHECK (("kind" = 'BENEFIT') = ("benefitPurpose" IS NOT NULL)),
  ADD CONSTRAINT "account_benefit_opening_nonnegative" CHECK ("kind" <> 'BENEFIT' OR "openingBalanceCents" >= 0);

-- Contas de benefício não participam de transferências (nem saque).
CREATE FUNCTION "afinia_assert_not_benefit"(account_id text) RETURNS void AS $$
BEGIN
  IF account_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM "financial_account" WHERE "id" = account_id AND "kind" = 'BENEFIT'
  ) THEN
    RAISE EXCEPTION 'afinia_benefit_transfer' USING ERRCODE = '23514';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "afinia_transaction_benefit_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."kind" = 'TRANSFER' THEN
    PERFORM "afinia_assert_not_benefit"(NEW."accountId");
    PERFORM "afinia_assert_not_benefit"(NEW."toAccountId");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "financial_transaction_benefit_guard"
  BEFORE INSERT OR UPDATE ON "financial_transaction"
  FOR EACH ROW EXECUTE FUNCTION "afinia_transaction_benefit_guard"();

CREATE FUNCTION "afinia_rule_benefit_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."toAccountId" IS NOT NULL THEN
    PERFORM "afinia_assert_not_benefit"(NEW."accountId");
    PERFORM "afinia_assert_not_benefit"(NEW."toAccountId");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "recurring_rule_benefit_guard"
  BEFORE INSERT OR UPDATE ON "recurring_rule"
  FOR EACH ROW EXECUTE FUNCTION "afinia_rule_benefit_guard"();

-- Uma conta com transferências não pode virar benefício.
CREATE FUNCTION "afinia_account_benefit_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."kind" = 'BENEFIT' AND OLD."kind" <> 'BENEFIT' AND (
    EXISTS (SELECT 1 FROM "financial_transaction" WHERE "kind" = 'TRANSFER' AND ("accountId" = NEW."id" OR "toAccountId" = NEW."id"))
    OR EXISTS (SELECT 1 FROM "recurring_rule" WHERE "toAccountId" IS NOT NULL AND ("accountId" = NEW."id" OR "toAccountId" = NEW."id"))
  ) THEN
    RAISE EXCEPTION 'afinia_benefit_transfer' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "financial_account_benefit_guard"
  BEFORE UPDATE ON "financial_account"
  FOR EACH ROW EXECUTE FUNCTION "afinia_account_benefit_guard"();