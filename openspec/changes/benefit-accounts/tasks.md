# Tasks

## 1. Modelo

- [x] 1.1 Adicionar `BENEFIT` a `AccountKind` (migration própria) e `benefitPurpose` com CHECKs e gatilhos de transferência; aplicar em dev/teste e verificar que contas existentes continuam válidas e que o banco recusa transferência com benefício e benefício com saldo inicial negativo (teste de integração)

## 2. Regras e serviços

- [x] 2.1 Regras puras: `splitBalances`, separação de créditos de benefício em `monthTotals` e `monthlySeries`; verificar com testes unitários (composição dos saldos, saldo do benefício, crédito do empregador, compatibilidade sem benefícios com a fixture)
- [x] 2.2 Serviços: validação de conta (finalidade obrigatória só para benefício, saldo não negativo, mudança de tipo com transferências), bloqueio de transferências com benefício em lançamentos e recorrências; verificar por testes de integração
- [x] 2.3 Dashboard/relatórios/contas expõem uso geral, benefícios e consolidado; verificar por teste de integração de reconciliação

## 3. Interface

- [x] 3.1 Formulário e lista de contas (tipo Benefício, finalidade, exemplos de nome, totais separados); verificar por E2E
- [x] 3.2 Formulário de lançamento sem benefícios em transferências; benefício disponível em receitas/despesas e recorrências; verificar por E2E
- [x] 3.3 Início (disponível para uso geral, em benefícios, consolidado com composição, composição de "Entrou") e Relatórios (créditos de benefício separados); verificar por E2E e ausência de rolagem horizontal

## 4. Validação

- [x] 4.1 Executar `openspec validate benefit-accounts --strict`, typecheck, lint, testes, build e E2E
