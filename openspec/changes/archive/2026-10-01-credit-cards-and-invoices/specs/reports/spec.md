# Spec Delta

## ADDED Requirements

### Requirement: Cartão nos relatórios
Gastos por categoria e receitas × despesas SHALL incluir as parcelas de compras confirmadas no cartão pelo mês de vencimento da fatura, sem incluir pagamentos de fatura. Com filtro por conta, os gastos de cartão MUST NOT ser atribuídos à conta (pagamentos aparecem apenas na evolução do saldo da conta pagadora). A evolução do saldo SHALL refletir pagamentos de fatura na data do pagamento e MUST NOT refletir compras no cartão.

#### Scenario: Gastos por categoria com cartão
- **GIVEN** em abril, despesa comum de R$ 200,00 em Alimentação, parcela de R$ 120,00 em Alimentação no cartão com fatura vencendo em abril e o pagamento dessa fatura
- **WHEN** o relatório de categorias de abril é exibido
- **THEN** Alimentação mostra R$ 320,00

#### Scenario: Evolução do saldo
- **GIVEN** compra no cartão em 02/04/2026 e pagamento da fatura em 15/04/2026
- **WHEN** a evolução do saldo de abril é exibida
- **THEN** o saldo só diminui em 15/04/2026, pelo valor pago
