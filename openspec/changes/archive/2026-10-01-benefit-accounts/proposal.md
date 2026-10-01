# Proposal

## Why

O casal recebe parte da renda em cartões de benefício pré-pagos (vale-alimentação, vale-refeição, combustível). Hoje não há como registrá-los sem misturá-los ao dinheiro de uso livre: o saldo do Início soma tudo e os créditos do empregador aparecem como receita comum, superestimando quanto o casal pode gastar em qualquer coisa.

## What Changes

- Novo tipo estruturado de conta **Benefício**, com **finalidade** informativa: alimentação, refeição, mobilidade/combustível, flexível ou outros. Nome livre em todas as contas (ex.: "Meu vale-alimentação", "Vale-refeição da esposa", "Cartão combustível").
- Benefício tem saldo inicial (não negativo), créditos (receitas) e despesas. Não tem fatura, fechamento, vencimento ou limite.
- Contas de benefício **não participam de transferências** (nem como origem nem como destino), inclusive em recorrências; o formulário não as oferece para transferir.
- Receitas efetivadas em contas de benefício são **créditos de benefício**, apresentados separadamente das receitas em dinheiro. A categoria continua independente da conta: uma despesa de Alimentação pode ser paga por banco, dinheiro ou benefício.
- **Início**: "Disponível para uso geral" exclui benefícios; o saldo de benefícios aparece à parte, por conta; o total consolidado explica sua composição. Contas mostra a mesma separação.
- Relatório Entradas × saídas distingue receitas em dinheiro e créditos de benefício.
- Contas existentes permanecem como estão (migration aditiva).

## Não faz parte desta change

- Bloqueio de compras pela finalidade; tipos de conta personalizados com regras próprias; saque ou transferência a partir de benefícios; cartões de crédito e faturas.

## Capabilities

### New Capabilities
- (nenhuma)

### Modified Capabilities
- `financial-accounts`: tipo Benefício com finalidade; saldo inicial não negativo para benefícios; separação entre saldo de uso geral e de benefícios.
- `transactions`: transferências não podem envolver contas de benefício.
- `dashboard`: resumo com disponível para uso geral, saldo de benefícios e créditos de benefício separados.
- `reports`: receitas em dinheiro e créditos de benefício separados em Entradas × saídas.
- `recurring-transactions`: recorrências podem usar contas de benefício em receitas e despesas, nunca em transferências.

## Impact

- Migrations aditivas: valor `BENEFIT` em `AccountKind`; enum e coluna `benefitPurpose`; CHECK de coerência; gatilho que recusa transferências envolvendo benefício (lançamentos e regras de recorrência).
- Regras puras (`rules.ts`, `reports.ts`) ganham a separação por tipo de conta; serviços, formulário de conta, formulário de lançamento, Início, Contas e Relatórios.
