# Spec Delta

## MODIFIED Requirements

### Requirement: Resumo do mês
O Início SHALL exibir, separadamente:
- o disponível para uso geral (saldo realizado de contas bancárias, dinheiro e reservas ativas, sem benefícios);
- o saldo em benefícios;
- quando exibido, o total consolidado com sua composição;
- as dívidas de cartão (saldo devedor das faturas com compras confirmadas).

O limite de crédito MUST NOT ser apresentado como saldo, patrimônio ou dinheiro disponível.

O Início SHALL exibir também, para o mês corrente:
- as receitas realizadas, com receitas em dinheiro e créditos de benefício identificados;
- os gastos realizados: despesas comuns efetivadas + parcelas de cartão cuja fatura vence no mês, com a parte do cartão identificada;
- o resultado (receitas − gastos);
- os pagamentos de fatura do mês como saída de caixa identificada, sem somá-los aos gastos.

Previsões (pendências e cobranças recorrentes no cartão ainda não confirmadas) SHALL aparecer identificadas como "previsto", separadas dos valores realizados.

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

#### Scenario: Cartão no resumo
- **GIVEN** em abril: despesa comum efetivada de R$ 1.000,00, parcela de cartão de R$ 400,00 em fatura que vence em abril, pagamento dessa fatura de R$ 400,00, conta corrente com R$ 3.000,00 após o pagamento e limite do cartão de R$ 5.000,00 com R$ 800,00 ainda devidos em faturas futuras
- **WHEN** o Início de abril é exibido
- **THEN** gastos mostram R$ 1.400,00 (R$ 400,00 no cartão), "Pagamentos de fatura" mostra R$ 400,00 sem somar aos gastos, dívidas de cartão mostram R$ 800,00, o disponível para uso geral é R$ 3.000,00 e o limite não aparece como saldo
