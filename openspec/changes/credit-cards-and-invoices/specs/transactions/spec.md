# Spec Delta

## ADDED Requirements

### Requirement: Lançamento de pagamento de fatura
O sistema SHALL ter o tipo de lançamento "pagamento de fatura", criado somente pelo pagamento de uma fatura: efetivado, vinculado à fatura, com conta de origem e sem categoria. Ele reduz o saldo da conta de origem na data do pagamento, aparece nas listas e no fluxo de caixa como "Pagamento de fatura" e MUST NOT entrar em receitas, despesas por categoria ou orçamento. Esse lançamento MUST NOT ser editado, duplicado, marcado como pendente ou excluído pelas operações comuns; só pode ser desfeito pelo fluxo de desfazer pagamento da fatura.

#### Scenario: Pagamento na lista de lançamentos
- **GIVEN** pagamento de R$ 500,00 da fatura do "Cartão roxo" pela conta corrente em 15/03/2026
- **WHEN** a lista de lançamentos de março é exibida
- **THEN** aparece "Pagamento de fatura · Cartão roxo" de −R$ 500,00 na conta corrente, sem categoria, com acesso à fatura

#### Scenario: Operação comum sobre pagamento
- **WHEN** alguém tenta editar ou duplicar esse lançamento pelas telas de lançamento
- **THEN** a operação não é oferecida e, se chamada, é recusada
