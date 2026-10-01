-- Valor novo do enum em migration própria: o PostgreSQL não permite usá-lo na mesma transação.
ALTER TYPE "TransactionKind" ADD VALUE 'CARD_PAYMENT';
