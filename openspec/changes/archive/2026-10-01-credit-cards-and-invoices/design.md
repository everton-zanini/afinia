# Design

## Context

O que já existe (verificado no código e nos testes): lançamentos em `financial_transaction` (`INCOME`, `EXPENSE`, `TRANSFER`), saldos por regras puras (`accountBalances`/`effectOnAccount`), totais (`monthTotals`), orçamento (`budgetProgress` sobre despesas), relatórios (`expensesByCategory`, `monthlySeries`, `balanceEvolution`), recorrências com regra por posição, exceções e geração idempotente (`ensureGenerated` em `requireHousehold`), contas de benefício (sem transferências), gatilhos de isolamento entre casais e `householdId` imutável. Produção: 1 conta bancária e nenhum lançamento, sem faturas manuais a migrar. Motivação: `proposal.md`; requisitos: `specs/`.

## Goals / Non-Goals

**Goals:** modelo explícito de cartão, fatura, compra e parcela; três visões contábeis sem dupla contagem; cálculos no servidor e em regras puras testadas; segurança equivalente ao resto do app (sessão, casal, gatilhos, idempotência, transações).

**Non-Goals:** integração bancária, estornos, créditos em fatura, encargos, parcelamento de fatura, dicas educativas.

## Decisions

### Modelo

- `credit_card(id, householdId, name, issuer?, lastFour? CHECK '^[0-9]{4}$', color, limitCents > 0, closingDay 1..31, dueDay 1..31, holderMemberId, paymentAccountId?, archivedAt?)`.
- `card_invoice(id, householdId, cardId, periodStart, closingDate, dueDate)` com `UNIQUE(cardId, closingDate)` e CHECKs `periodStart ≤ closingDate < dueDate`. Datas gravadas na criação, nunca recalculadas.
- `card_purchase(id, householdId, cardId, status FORECAST|CONFIRMED, description, totalCents > 0, purchaseDate, categoryId, responsibleMemberId?, notes?, installmentCount 1..48, invoiceId (fatura inicial/sugerida), createdById, idempotencyKey, seriesId?, occurrenceIndex?, seriesOverride)`. `UNIQUE(householdId, idempotencyKey)` e `UNIQUE(seriesId, occurrenceIndex)`.
- `card_installment(id, householdId, purchaseId, invoiceId, index, amountCents > 0)` com `UNIQUE(purchaseId, index)`. Previsões não têm parcelas; uma compra confirmada tem `installmentCount` parcelas.
- `financial_transaction`: novo `kind CARD_PAYMENT` e coluna `invoiceId?`. A CHECK de forma passa a aceitar `CARD_PAYMENT` com `invoiceId` preenchido, sem categoria nem destino e sempre `EFFECTIVE`; os demais tipos exigem `invoiceId` nulo.
- `recurring_series.cardId?` (imutável, só com `kind = EXPENSE`); `recurring_rule.accountId` passa a anulável. Gatilho garante: série com cartão ⇒ regra sem conta; série sem cartão ⇒ regra com conta.
- Gatilhos: isolamento de casal para todas as novas referências (cartão, fatura, compra, parcela, conta de pagamento, titular, categoria, responsável, série); `afinia_household_immutable` nas novas tabelas; benefício proibido em `paymentAccountId` e em `CARD_PAYMENT`; a fatura da parcela e a do pagamento precisam ser do mesmo cartão da compra.
- Migrations: (1) só o valor de enum `CARD_PAYMENT` (o PostgreSQL não usa um valor novo na mesma transação); (2) tabelas, colunas, CHECKs e gatilhos.

### Regra de ciclo (pura, `src/lib/finance/cards.ts`)

- `clampDay(year, month, day)` = `min(day, último dia do mês)`.
- Primeira fatura para a data `d`: `c = clamp(mês de d)`; se `d > c`, `c = clamp(mês seguinte)`. `periodStart = clamp(mês anterior a c) + 1 dia`.
- Fatura seguinte à última gravada `L`: `periodStart = L.closingDate + 1`, `closingDate = clamp(mês seguinte ao de L.closingDate)`.
- Fatura anterior à primeira gravada `F`: `closingDate = F.periodStart − 1`, `periodStart = clamp(mês anterior ao de closingDate) + 1`, limitado para não ultrapassar `closingDate`.
- `dueDate(closing, dueDay)`: `clamp(mês do fechamento)`; se `≤ closing`, `clamp(mês seguinte)`.
- Mudança de dias afeta apenas faturas criadas depois (as gravadas não mudam).

### Fatura para uma data (servidor)

`ensureInvoiceFor(tx, card, date)`: com lock `FOR UPDATE` na linha do cartão, procura a fatura com `periodStart ≤ date ≤ closingDate`; se não houver, cria a sequência para frente ou para trás a partir das gravadas (ou a primeira pela regra) até cobrir a data, usando `createMany`/`skipDuplicates` na unicidade `(cardId, closingDate)`. `ensureInvoicesAfter(tx, card, invoice, n)` cria/obtém as `n` faturas seguintes para as parcelas. Datas de compra limitadas a até 5 anos no passado e nunca futuras.

### Situação da fatura (pura, calculada na consulta)

`invoiceStatus(invoice, totalCents, paidCents, today)` → `{ cycle: open|closed, payment: empty|open|partial|paid, overdue, remainingCents }`: `empty` quando total = 0 (nunca vencida nem devida); `paid` quando pago = total > 0; `overdue` = `dueDate < hoje ∧ remaining > 0`. Sem cron.

### Parcelas (pura)

`splitInstallments(total, n)`: `q = ⌊total/n⌋`, `r = total − q·n`; parcelas `q + 1` para as `r` primeiras e `q` para as demais. Recusa `q = 0`. Soma sempre igual ao total.

### As três visões (fontes e fórmulas)

| Visão | Fonte | Fórmula |
| --- | --- | --- |
| **Caixa** (saldo das contas, fluxo de caixa, evolução do saldo) | `financial_transaction` efetivados | saldo = abertura + receitas − despesas comuns − **pagamentos de fatura** ± transferências. Compras no cartão não entram. Fluxo do mês: entradas = receitas; saídas = despesas comuns + pagamentos de fatura (identificados). |
| **Gastos / orçamento** (categorias, orçamento, receitas × despesas) | despesas comuns + `card_installment` confirmadas + previsões | realizado = despesas comuns efetivadas (data de efetivação) + parcelas confirmadas (mês do **vencimento** da fatura). Previsto = despesas comuns pendentes (data prevista) + previsões no cartão (vencimento da fatura sugerida). Pagamentos de fatura **excluídos**. |
| **Limite** (por cartão, estimativa manual) | `card_installment` e pagamentos do cartão | comprometido = Σ parcelas confirmadas do cartão − Σ pagamentos das faturas do cartão; disponível = limite − comprometido. Previsões e saldos de contas excluídos. |

Dívidas de cartão no Início = Σ saldos devedores das faturas (= comprometido somado de todos os cartões). Implementação: as parcelas viram `Movement { kind: EXPENSE, status: EFFECTIVE, effectiveDate: dueDate, accountId: "card:<id>" }` e as previsões `Movement { status: PENDING, dueDate: vencimento sugerido }`. Como os ids `card:*` não são contas, `accountBalances` os ignora; `monthTotals` ganha `expenseCard` e `cardPayments`, e `CARD_PAYMENT` é tratado como saída de caixa, nunca despesa. Todas as fórmulas ficam em `rules.ts`/`cards.ts` e são testadas com a fixture de cartão.

### Pagamentos

`payInvoice(ctx, invoiceId, {accountId, date, amount, idempotencyKey})`: valida a conta (do casal, não benefício, não arquivada, abertura ≤ data) e a data (≤ hoje). Em transação: se a chave já existe, devolve o pagamento existente; senão `SELECT … FOR UPDATE` na fatura, soma parcelas e pagamentos, recusa se o valor excede o saldo devedor e cria o `CARD_PAYMENT`. Desfazer apaga o lançamento (com confirmação) na mesma transação com lock; saldos e saldo devedor são derivados, então voltam ao estado anterior. Operações comuns (`updateTransaction`, `deleteTransaction`, `markPending`, `markEffective`, `duplicateDraft`) recusam `CARD_PAYMENT`.

### Compras e correções

- Criar: valida cartão ativo, categoria de despesa do casal, responsável, data; obtém a fatura inicial (sugerida ou escolhida, que precisa ser não quitada e do mesmo cartão); cria compra + parcelas nas faturas consecutivas na mesma transação. Idempotente pela chave.
- "Bloqueada" = alguma parcela em fatura com pagamento. Bloqueada: só descrição, categoria, responsável e observação. Livre: editar recalcula (apaga e recria as parcelas) e excluir apaga compra e parcelas. Mover parcela exige origem e destino sem pagamentos, destino não quitado, mesmo cartão.

### Recorrências no cartão

- Criar com cartão (formulário "Repetir" com destino cartão): `createSeries` com `cardId`; a regra não tem conta.
- `ensureGenerated` para séries com cartão (ativo) cria previsões em `card_purchase` (`FORECAST`, fatura sugerida pela data, chave `series:<id>:<pos>`, `skipDuplicates`) com a mesma janela, exceções e regra por posição.
- Confirmar: `UPDATE … WHERE status = 'FORECAST'` dentro de uma transação com lock no cartão; se nenhuma linha muda, devolve a compra já confirmada (idempotente). Cria uma parcela na fatura escolhida.
- Pular: "Só este" apaga a previsão e grava exceção; "Este e os próximos" grava `stopBeforeIndex` e apaga previsões a partir da posição; encerrar apaga previsões com data ≥ encerramento. Confirmadas preservadas.
- Destino fixo: o serviço e o gatilho de imutabilidade da série incluem `cardId`; a interface orienta a encerrar e criar outra série.

### Interface

- Entrada "Cartões" em Mais (Finanças do casal) e bloco "Cartões de crédito" no Início com dívidas e próximos vencimentos; a barra inferior não muda.
- `/cartoes`, `/cartoes/novo`, `/cartoes/[id]` (fatura via `?fatura=`), `/cartoes/[id]/editar`, `/cartoes/[id]/compra` (nova compra; `?previsao=` para confirmar cobrança), `/cartoes/compras/[id]` (detalhe, edição, exclusão, remanejamento).
- Prévia de parcelas calculada no cliente pela mesma função pura (`splitInstallments`), validada de novo no servidor.

### Transição de registros manuais

Não há conversão automática. Quem registrava "Fatura do cartão" como despesa deve escolher uma data de corte: manter as despesas manuais de faturas anteriores ao corte, cadastrar no cartão apenas as compras de ciclos a partir do corte e **não** registrar pagamento das faturas que já tinham virado despesa manual. Assim, nenhum gasto é contado duas vezes. O README documenta isso. Em produção não havia nenhum registro desse tipo na data da implementação.

## Risks / Trade-offs

- [Faturas futuras criadas por parcelas fixam datas antes de uma mudança de configuração] → por especificação, não mudam; a interface explica e permite remanejar parcelas.
- [Agregações em memória] → volume de um casal; as mesmas fórmulas podem ir para SQL depois.
- [Novo tipo de lançamento toca vários pontos] → tratado em `effectOnAccount`, `monthTotals`, séries, CSV e DTOs, com testes de não duplicação.

## Migration Plan

`card_payment_kind` (enum) e `credit_cards` (tabelas, colunas, CHECKs, gatilhos), aditivas. Os dados existentes permanecem; `recurring_rule.accountId` só deixa de ser obrigatório. Produção: não publicar nesta change.
