# Design

## Context

Tenant (`Household`) e contexto derivado da sessão (`requireHousehold` → `HouseholdContext`) já existem. Esta change cria o modelo financeiro e os fluxos de lançamento.

## Goals / Non-Goals

**Goals:** integridade (inclusive no banco), isolamento, regras monetárias exatas e lançamento rápido no celular.

**Non-Goals:** cartões/faturas, parcelamento, recorrência, conciliação, dashboard/gráficos (change seguinte), calendário mensal (change seguinte).

## Decisions

### Modelo e invariantes (PostgreSQL)

- `category(id, household_id, parent_id?, kind INCOME|EXPENSE, name, color, icon, archived_at?)`.
- `financial_account(id, household_id, name, kind CHECKING|CASH|RESERVE, opening_balance_cents int, opening_date date, archived_at?)`.
- `transaction(id, household_id, kind INCOME|EXPENSE|TRANSFER, status PENDING|EFFECTIVE, description, amount_cents int, category_id?, account_id, to_account_id?, due_date date, effective_date date?, responsible_member_id?, notes?, created_by_id, idempotency_key, created_at, updated_at)`.
- `budget(id, household_id, month char(7) 'YYYY-MM', category_id, limit_cents int)`.
- **Isolamento no banco**: toda tabela de tenant tem `UNIQUE(id, household_id)`; toda referência usa FK composta `(ref_id, household_id) → (id, household_id)`. Assim, mesmo um bug de serviço não consegue ligar um lançamento a uma conta/categoria/membro de outro casal. FKs com `ON DELETE RESTRICT`.
- **CHECKs** (SQL na migration): `amount_cents > 0 AND amount_cents <= 1000000000`; `(status = 'EFFECTIVE') = (effective_date IS NOT NULL)`; transferência ⇔ `to_account_id IS NOT NULL AND category_id IS NULL AND to_account_id <> account_id`; não transferência ⇔ `to_account_id IS NULL AND category_id IS NOT NULL`; `limit_cents > 0`; `month ~ '^\d{4}-(0[1-9]|1[0-2])$'`.
- Regras entre linhas (tipo da categoria = tipo do lançamento; subcategoria com o tipo do pai e um só nível; orçamento só em categoria principal de despesa; efetivação ≥ abertura da conta) ficam no serviço, com testes.
- Índices: `transaction(household_id, effective_date)`, `(household_id, due_date)`, `(household_id, account_id)`, `(household_id, to_account_id)`, `(household_id, category_id)`, `UNIQUE(household_id, idempotency_key)`; `category(household_id, kind)`; `budget UNIQUE(household_id, month, category_id)`.

### Dinheiro e datas

- Centavos `int` no banco e `number` inteiro no TypeScript (exato até 2^53; somas de um casal ficam muito abaixo). `lib/money.ts`: `parseBRL` (string → centavos, sem `parseFloat`), `formatBRL` (formatação por aritmética inteira) e `assertCents`.
- Datas como string `YYYY-MM-DD` na aplicação; no Prisma `@db.Date` convertido por `lib/dates.ts` (`toDbDate`/`fromDbDate` em UTC meia-noite, sem deslocamento). `todayISO()` usa `Intl.DateTimeFormat` com `America/Sao_Paulo`.

### Camadas

- `src/lib/finance/*`: funções puras (saldo, totais do mês, orçamento, período de referência) — testadas com fixture conhecida.
- `src/server/finance/*`: serviços que recebem `HouseholdContext` como primeiro argumento e sempre filtram por `ctx.householdId`; buscas por id usam `{ id, householdId }` e lançam `NotFoundError` uniforme.
- `src/server/actions/finance.ts`: Server Actions finas (sessão → contexto → Zod → serviço → `revalidatePath`). Nenhum `householdId` é lido do formulário.
- Exportação CSV em route handler `GET /lancamentos/exportar` com `Cache-Control: no-store`, separador `;`, BOM UTF-8 e prefixo `'` em células iniciadas por `= + - @ \t \r`.

### Saldos

- Saldo realizado por conta via `groupBy` em lançamentos efetivados (receitas/despesas por `account_id`; transferências por `account_id` e `to_account_id`) + saldo inicial. Pendências somadas à parte como previsão.

### Idempotência

- O formulário gera `idempotencyKey` (`crypto.randomUUID`) ao montar. O serviço faz `create`; em violação de `UNIQUE(household_id, idempotency_key)` retorna o lançamento existente. Duplicar gera nova chave.

### UX de lançamento

- `/lancamentos/novo` é uma tela no formato de bottom sheet: seletor de tipo, valor grande com `inputMode="decimal"`, descrição, chips das 6 categorias e 3 contas mais usadas nos últimos 90 dias (com "Ver todas"), data (hoje), interruptor "Já foi pago/recebido", seção "Mais detalhes" recolhida (data de pagamento diferente, responsável, observação).
- Lista com busca e filtros em `searchParams` (URL compartilhável sem expor dados de outros casais: o servidor sempre aplica o casal da sessão).

## Risks / Trade-offs

- FKs compostas exigem `@@unique([id, householdId])` redundante ao PK → custo pequeno de índice, ganho grande de integridade.
- Saldo calculado on-the-fly (sem tabela de saldos) → simples e sempre consistente; suficiente para o volume de um casal.
