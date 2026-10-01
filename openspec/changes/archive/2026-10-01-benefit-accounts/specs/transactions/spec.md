# Spec Delta

## ADDED Requirements

### Requirement: Benefícios não participam de transferências
Transferências MUST NOT ter conta de benefício como origem ou destino, inclusive quando editadas. O formulário de transferência MUST NOT oferecer contas de benefício. Receitas e despesas PODEM usar contas de benefício normalmente.

#### Scenario: Transferir a partir do benefício
- **GIVEN** o vale-alimentação do casal
- **WHEN** alguém tenta registrar uma transferência do vale-alimentação para a conta corrente
- **THEN** a operação é recusada com "Contas de benefício não permitem transferência ou saque"

#### Scenario: Opções do formulário
- **WHEN** o membro escolhe "Transferir" no novo lançamento
- **THEN** as contas de benefício não aparecem como origem nem como destino

### Requirement: Créditos de benefício
Receitas efetivadas em contas de benefício SHALL ser identificadas como créditos de benefício e apresentadas separadamente das receitas em dinheiro (contas bancárias, dinheiro e reservas). O total de receitas e o resultado do mês continuam incluindo os dois.

#### Scenario: Crédito do empregador
- **GIVEN** salário efetivado de R$ 5.000,00 na conta corrente e crédito efetivado de R$ 800,00 no vale-alimentação no mesmo mês
- **WHEN** os totais do mês são calculados
- **THEN** receitas em dinheiro são R$ 5.000,00, créditos de benefício R$ 800,00 e receitas totais R$ 5.800,00
