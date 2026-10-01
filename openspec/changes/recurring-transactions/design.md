# Design

## Context

Lançamentos ficam em `financial_transaction` (um registro por lançamento; transferência é um registro único e atômico). `src/server/finance/transactions.ts` valida referências do casal (`validateReferences`) e a idempotência (`idempotencyKey`). Gatilhos no banco (migration `finance_core`) recusam referências entre casais. Saldos, orçamento e relatórios são regras puras sobre lançamentos e não conhecem recorrência. Não há agendador (Vercel serverless). Motivação: `proposal.md`; requisitos: `specs/`.

## Goals / Non-Goals

**Goals:** ocorrências materializadas como lançamentos comuns (sem mudar regras de saldo, orçamento e relatórios); identidade estável por posição, garantida no banco; geração idempotente sob concorrência e após longos períodos sem uso; regra de série versionada por posição; isolamento também no banco.

**Non-Goals:** parcelamento e cartões; frequências personalizadas; término "por N meses"; mudança de tipo, frequência ou data inicial.

## Decisions

### Modelo (definição separada dos lançamentos)

- `recurring_series(id, householdId, kind, frequency WEEKLY|MONTHLY|YEARLY, startDate date, endMode COUNT|UNTIL|NONE, occurrenceCount?, untilDate?, stopBeforeIndex?, stoppedOn date?, generatedThroughIndex int default -1, createdById, idempotencyKey, timestamps)`.
  - `kind`, `frequency`, `startDate` imutáveis (sem caminho de atualização no serviço).
  - `stopBeforeIndex`: definido por "Excluir este e os próximos" (posição marco). `stoppedOn`: data de "Encerrar recorrência". A programação está encerrada quando qualquer um estiver definido ou quando o término configurado foi alcançado pela janela.
  - `generatedThroughIndex`: maior posição já avaliada pela geração (otimização; a correção vem das restrições abaixo).
- `recurring_rule(id, seriesId, fromIndex, description, amountCents, categoryId?, accountId, toAccountId?, responsibleMemberId?, notes?)`, `UNIQUE(seriesId, fromIndex)`. A regra vigente de uma posição `i` é a de maior `fromIndex ≤ i`. A criação grava `fromIndex = 0`; "Este e os próximos" grava `fromIndex = i`. Alternativa descartada — sobrescrever o modelo único da série: ocorrências intermediárias geradas após um período sem uso receberiam a regra nova retroativamente.
- `recurring_exception(seriesId, occurrenceIndex, createdAt)`, PK `(seriesId, occurrenceIndex)`: posições excluídas individualmente; nunca recriadas.
- `financial_transaction` + `seriesId?`, `occurrenceIndex?`, `seriesOverride boolean default false`; `UNIQUE(seriesId, occurrenceIndex)` garante no máximo um lançamento por posição, independente da data prevista (editável). FK `seriesId → recurring_series ON DELETE RESTRICT` (séries não são apagadas, só encerradas).
- CHECKs: forma/valor do lançamento repetidos em `recurring_rule` (transferência sem categoria e com destino ≠ origem; valor 1..R$ 10 mi); `occurrenceCount` 2..600 quando `COUNT`; `untilDate > startDate` e ≤ 30 anos quando `UNTIL`; `(seriesId IS NULL) = (occurrenceIndex IS NULL)`.
- Gatilhos: isolamento para `recurring_series`/`recurring_rule` (contas, categoria, membro, série do mesmo casal) e `financial_transaction_tenant_guard` passa a validar `seriesId`; `afinia_household_immutable` em `recurring_series`.

### Regras puras (`src/lib/finance/recurrence.ts`, sem acesso a banco ou UI)

- `scheduledDate(startDate, frequency, index)`: semanal `start + 7·index`; mensal/anual pelo dia de `start` limitado ao último dia do mês alvo.
- `horizon(today) = addCalendarMonths(today, 12)` (mesmo dia, limitado ao fim do mês), inclusive; `today` = `todayISO()` em São Paulo.
- `lastLogicalIndex(series)`: `COUNT → occurrenceCount − 1`; `UNTIL →` maior índice com data ≤ `untilDate`; `NONE → ∞`; combinado com `stopBeforeIndex − 1` e com o maior índice de data `< stoppedOn`.
- `positionsToGenerate(series, horizon, fromIndex)`: posições de `fromIndex` até o menor entre o fim lógico e a última data ≤ horizonte.
- `ruleFor(rules, index)`, `positionLabel(index, occurrenceCount)`, e `summarize(series, occurrences, exceptions, horizon)` para a consulta (programação, pendentes geradas, previstas para geração = posições do fim lógico ainda não avaliadas, menos exceções).

### Geração

- `ensureGenerated(ctx, today)` em `src/server/finance/recurrences.ts`: seleciona séries do casal com programação não encerrada e próxima posição (`generatedThroughIndex + 1`) com data ≤ horizonte. Para cada uma, em transação: `SELECT … FOR UPDATE` da série; calcula posições; remove as que têm exceção; insere em lotes de até 200 com `createMany({ skipDuplicates: true })` (`ON CONFLICT DO NOTHING` na unicidade `(seriesId, occurrenceIndex)`), sempre `PENDING`, com a regra vigente da posição e `dueDate = scheduledDate`; atualiza `generatedThroughIndex`. Lotes repetem até alcançar o horizonte (retorno após meses sem uso, inclusive posições já vencidas).
- Nunca faz `UPDATE` em lançamentos existentes. O lock evita trabalho duplicado; a unicidade garante a correção mesmo sem o lock.
- Gatilho: `requireHousehold()` chama `ensureGenerated` uma vez por requisição (memoizado com `cache`); também após criar a série. Sem cron.

### Criação

- Formulário de lançamento com seção "Repetir" (frequência; término: após N ocorrências / até data / sem término). A Server Action chama `createSeries`, que reaproveita `transactionSchema` + `recurrenceSchema` e `validateReferences`, grava série + regra `fromIndex 0` e gera a janela.
- "Já foi paga/recebida/realizada": exige `effectiveDate` separada da data prevista, `≤ hoje` e `≥` abertura das contas; a posição 0 nasce `EFFECTIVE`. Transferência continua um único lançamento.

### Edição e exclusão em escopo

- **Só este** (pendente ou efetivada): atualiza o lançamento (inclusive `dueDate`), `seriesOverride = true`; posição inalterada.
- **Este e os próximos** (somente se a ocorrência selecionada está pendente): grava `recurring_rule(fromIndex = i)` com os novos campos (sem data); atualiza a ocorrência `i` e as pendentes com `occurrenceIndex > i` e `seriesOverride = false`. Efetivadas, personalizadas e posições `< i` intocadas. Posições ainda não geradas herdam a nova regra pela resolução por `fromIndex`.
- **Excluir só este** (pendente): apaga o lançamento e insere `recurring_exception(i)`.
- **Excluir este e os próximos**: `stopBeforeIndex = i`; apaga pendentes com `occurrenceIndex ≥ i` (inclusive personalizadas); a confirmação mostra quantidade e soma calculadas antes (endpoint de pré-visualização).
- **Encerrar recorrência** em data `d` (padrão hoje): `stoppedOn = d`; apaga pendentes da série com `dueDate ≥ d`; preserva anteriores e efetivadas.
- `seriesId`/`occurrenceIndex`/`seriesOverride` nunca vêm do formulário; duplicar gera lançamento avulso.

### Interface

- Lista/detalhe: selo "Ocorrência 3 de 12" ou "Recorrente · mensal" (ícone `Repeat` + texto); detalhe com link para a recorrência; tipo e frequência só leitura na edição com a orientação de encerrar e criar outra.
- `/mais/recorrencias`: cards com programação ativa/encerrada, pendentes geradas (qtd/valor), previstas para geração (séries com N ocorrências), ação "Encerrar" e link `/lancamentos?serie=<id>` (filtro escopado ao casal).

### Preparação para cartões

- Definição (série + regras) separada dos lançamentos e geração separada da interface: o futuro módulo de cartões poderá adicionar outro destino de geração. Nesta versão os destinos são apenas contas financeiras; nenhum campo de cartão é criado.
- Uma recorrência futura cobrada no cartão deverá gerar uma **cobrança vinculada à fatura**, sem descontar diretamente uma conta bancária; o pagamento da fatura é que movimenta a conta, sem duplicar a despesa.

## Risks / Trade-offs

- [Escrita na primeira leitura após a janela avançar] → verificação barata (uma consulta indexada); escrita só quando há posições novas; lotes curtos.
- [Retorno após muito tempo em série semanal gera muitas linhas] → lotes de 200 por transação; limite natural de 600 ocorrências ou da janela.
- [Regra versionada aumenta a complexidade de leitura] → resolução pura e testada (`ruleFor`); poucas regras por série.
- [Conta/categoria arquivada usada por série ativa] → geração continua com a referência existente; a consulta sinaliza "usa conta/categoria arquivada".

## Migration Plan

- Migration aditiva `recurring_transactions` (tabelas novas, colunas anuláveis/com padrão, índices, CHECKs, gatilhos). Nenhum dado existente muda.
- Produção: `npm run prod:migrate` antes do deploy do código. Rollback: código anterior ignora as colunas novas.
