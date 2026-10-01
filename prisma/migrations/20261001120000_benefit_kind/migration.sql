-- Valor novo do enum em migration própria: o PostgreSQL não permite usá-lo na mesma transação.
ALTER TYPE "AccountKind" ADD VALUE 'BENEFIT';