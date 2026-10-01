# Spec Delta

## ADDED Requirements

### Requirement: Recorrências com contas de benefício
Recorrências de receita e despesa SHALL aceitar contas de benefício, com as mesmas regras de geração, edição e exclusão. Recorrências de transferência MUST NOT usar contas de benefício, nem na criação nem em edições "Este e os próximos".

#### Scenario: Crédito mensal do vale-alimentação
- **WHEN** um membro cria uma receita mensal sem término de R$ 800,00 no vale-alimentação, categoria Outras receitas
- **THEN** as ocorrências são geradas como pendentes nessa conta e, quando efetivadas, contam como créditos de benefício

#### Scenario: Transferência recorrente com benefício
- **WHEN** alguém cria uma transferência recorrente com destino no vale-alimentação
- **THEN** a criação é recusada com "Contas de benefício não permitem transferência ou saque"
