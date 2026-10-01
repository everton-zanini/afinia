# Spec Delta

## MODIFIED Requirements

### Requirement: Resumo do mês
O Início SHALL exibir o disponível para uso geral (saldo realizado de contas bancárias, dinheiro e reservas ativas, sem benefícios), o saldo em benefícios separado e, quando exibido, o total consolidado com sua composição. SHALL exibir também as receitas realizadas (com receitas em dinheiro e créditos de benefício identificados separadamente), as despesas realizadas e o resultado (receitas − despesas) do mês corrente. Previsões (pendências) SHALL aparecer identificadas como "previsto", separadas dos valores realizados.

#### Scenario: Fixture de março
- **GIVEN** a fixture conhecida e o mês de março de 2026
- **WHEN** o Início é exibido para março
- **THEN** mostra receitas R$ 5.000,00, despesas R$ 2.382,85, resultado R$ 2.617,15 e previsto de R$ 700,00 a receber e R$ 80,00 a pagar

#### Scenario: Benefícios fora do disponível
- **GIVEN** conta corrente com R$ 2.000,00, dinheiro com R$ 150,00 e vale-alimentação com R$ 600,00
- **WHEN** o Início é exibido
- **THEN** "Disponível para uso geral" mostra R$ 2.150,00, "Em benefícios" mostra R$ 600,00 e o total consolidado R$ 2.750,00 é apresentado como a soma dos dois

#### Scenario: Crédito de benefício no mês
- **GIVEN** salário de R$ 5.000,00 e crédito de vale-alimentação de R$ 800,00 efetivados no mês
- **WHEN** o Início é exibido
- **THEN** "Entrou" mostra R$ 5.800,00 com a composição R$ 5.000,00 em dinheiro e R$ 800,00 em benefícios
