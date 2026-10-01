# Spec Delta

## ADDED Requirements

### Requirement: Créditos de benefício nos relatórios
O relatório de receitas × despesas SHALL distinguir, em cada mês, receitas em dinheiro e créditos de benefício, no gráfico e na alternativa textual. As despesas continuam agrupadas por categoria, independentemente da conta usada.

#### Scenario: Mês com crédito de benefício
- **GIVEN** salário de R$ 5.000,00 e crédito de vale-alimentação de R$ 800,00 efetivados em abril
- **WHEN** a tabela de receitas × despesas é exibida
- **THEN** a linha de abril mostra R$ 5.000,00 em receitas em dinheiro e R$ 800,00 em créditos de benefício
