# Design

## Context

`financial_account.kind` é o enum `AccountKind (CHECKING, CASH, RESERVE)`. Saldos são calculados por regras puras (`accountBalances`, `monthTotals`, `monthlySeries`) sobre lançamentos; o Início usa `dashboard()` e o relatório usa `reports()`. Transferências são um registro único com `accountId`/`toAccountId`; recorrências guardam as contas em `recurring_rule`. Gatilhos no banco validam isolamento entre casais. Motivação: `proposal.md`; requisitos: `specs/`.

## Goals / Non-Goals

**Goals:** benefício como tipo estruturado, compatível com contas existentes; separação explícita entre uso geral e benefícios nos indicadores; bloqueio de transferências com benefícios garantido também no banco.

**Non-Goals:** regras por finalidade, tipos personalizados, cartão de crédito.

## Decisions

- **Modelo**
  - `AccountKind` ganha `BENEFIT`. Nova enum `BenefitPurpose (FOOD, MEAL, MOBILITY, FLEXIBLE, OTHER)` e coluna anulável `financial_account.benefitPurpose`.
  - CHECKs: `(kind = 'BENEFIT') = (benefitPurpose IS NOT NULL)` e `kind <> 'BENEFIT' OR openingBalanceCents >= 0`.
  - Duas migrations: a primeira só adiciona o valor ao enum (o PostgreSQL não permite usar um valor de enum na mesma transação em que foi criado); a segunda cria coluna, CHECKs e gatilhos. Linhas existentes ficam com `benefitPurpose = NULL` e passam nos CHECKs.
- **Transferências sem benefício**
  - Serviço: `validateReferences` recusa `TRANSFER` com qualquer conta `BENEFIT` (vale para lançamentos, criação de série e edição em escopo, que já o reutilizam). `updateAccount` recusa mudar para `BENEFIT` uma conta com transferências.
  - Banco: função `afinia_assert_not_benefit(account)` chamada pelos gatilhos de `financial_transaction` (quando `kind = 'TRANSFER'`) e de `recurring_rule` (quando há `toAccountId`), e pelo gatilho de `financial_account` ao virar `BENEFIT` com transferências existentes.
  - Formulário: lista de contas para transferência filtra `BENEFIT`; com menos de duas contas elegíveis, mostra orientação.
- **Regras puras**
  - `AccountOpening` ganha `kind`. `splitBalances(accounts, balances)` → `{ generalCents, benefitCents, totalCents, benefits: [{id, cents}] }`, considerando só contas ativas.
  - `monthTotals(movements, month, benefitIds?)` mantém os campos atuais e acrescenta `incomeCash`/`incomeBenefit` (e o mesmo para pendentes); `incomeRealized = incomeCash + incomeBenefit`. Sem `benefitIds`, tudo é dinheiro (compatível com os testes e a fixture atuais).
  - `monthlySeries` acrescenta `incomeBenefitCents`, mantendo `incomeCents` como total.
- **Interface**
  - Contas: tipo "Benefício" no seletor; ao escolhê-lo, aparece "Finalidade" (obrigatória) e o saldo inicial não aceita negativo; placeholder de nome com exemplos. Lista com ícone `Ticket`, "Benefício · Refeição", e totais separados (uso geral, benefícios, consolidado).
  - Início: o cartão principal vira "Disponível para uso geral"; abaixo, "Em benefícios" (por conta) e a linha "Total consolidado = uso geral + benefícios". "Entrou" mostra a composição dinheiro/benefícios quando houver crédito de benefício.
  - Relatórios: barras "Receitas (dinheiro)", "Créditos de benefício" e "Despesas"; tabela com colunas correspondentes.
- **Recorrências**: nenhuma regra nova; as validações compartilhadas cobrem criação e edição.

## Risks / Trade-offs

- [Somar créditos de benefício às receitas totais pode parecer inflar a renda] → composição sempre visível e indicador de uso geral sem benefícios.
- [Evolução do saldo nos relatórios inclui benefícios no consolidado] → rótulo explícito "todas as contas, incluindo benefícios"; o filtro por conta permite isolar.

## Migration Plan

- `benefit_kind` (enum) e `benefit_accounts` (coluna, CHECKs, gatilhos), ambas aditivas. Produção: `npm run prod:migrate` antes do deploy.
