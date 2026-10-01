# Spec Delta

## Purpose

Faturas mensais dos cartões, com ciclo e datas próprias gravadas, situação calculada a cada consulta e pagamentos manuais vinculados, sem calcular encargos.

## ADDED Requirements

### Requirement: Regra de ciclo
Cada fatura SHALL ter identidade estável e datas gravadas: início do ciclo, fechamento e vencimento. O fechamento de um mês é o dia configurado, limitado ao último dia do mês, sem perder o dia de referência nos ciclos seguintes. Cada ciclo começa no dia seguinte ao fechamento anterior e termina no fechamento, inclusive. O vencimento é a primeira ocorrência do dia configurado (limitado ao último dia do mês) estritamente posterior ao fechamento. Faturas novas continuam a sequência das já gravadas: a fatura seguinte começa no dia seguinte ao último fechamento gravado e fecha no mês seguinte ao desse fechamento; a anterior à primeira gravada termina no dia anterior ao início dela. A primeira fatura de um cartão é a do ciclo que contém a data da compra, calculado pela configuração atual.

#### Scenario: Compra antes, no dia e depois do fechamento
- **GIVEN** cartão com fechamento dia 5 e vencimento dia 15
- **WHEN** compras são feitas em 04/03/2026, 05/03/2026 e 06/03/2026
- **THEN** as duas primeiras ficam na fatura de ciclo 06/02 a 05/03/2026, vencimento 15/03/2026, e a terceira na fatura de ciclo 06/03 a 05/04/2026, vencimento 15/04/2026

#### Scenario: Vencimento no mês seguinte ao fechamento
- **GIVEN** cartão com fechamento dia 25 e vencimento dia 5
- **WHEN** uma compra é feita em 20/03/2026
- **THEN** ela fica na fatura que fecha em 25/03/2026 e vence em 05/04/2026

#### Scenario: Meses curtos
- **GIVEN** cartão com fechamento dia 31 e vencimento dia 10
- **WHEN** compras são feitas em 15/02/2026 e 15/03/2026
- **THEN** a primeira fica na fatura de ciclo 01/02 a 28/02/2026, vencimento 10/03/2026, e a segunda na de ciclo 01/03 a 31/03/2026, vencimento 10/04/2026

#### Scenario: Vencimento limitado ao fim do mês
- **GIVEN** cartão com fechamento dia 30 e vencimento dia 31
- **WHEN** a fatura que fecha em fevereiro de 2026 é criada
- **THEN** ela fecha em 28/02/2026 e vence em 31/03/2026, pois 28/02 não é posterior ao fechamento

### Requirement: Situação da fatura
A fatura SHALL mostrar, calculadas na consulta (sem depender de tarefa agendada): ciclo aberto (hoje ≤ fechamento) ou fechado; total confirmado (soma das parcelas); valor pago; saldo devedor (total − pago); situação de pagamento em aberto, parcial ou quitada; e atraso quando o vencimento já passou e há saldo devedor. Fechar não significa pagar. Fatura sem compras MUST NOT aparecer como vencida ou devida.

#### Scenario: Fechada e não paga
- **GIVEN** hoje é 10/03/2026 e a fatura de fechamento 05/03/2026 tem R$ 500,00 em compras e nenhum pagamento
- **WHEN** a fatura é exibida
- **THEN** aparece "Ciclo fechado", "Em aberto", saldo devedor R$ 500,00 e não aparece como atrasada

#### Scenario: Vencida com pagamento parcial
- **GIVEN** hoje é 20/03/2026 e a fatura que venceu em 15/03/2026 tem R$ 500,00 e R$ 200,00 pagos
- **WHEN** a fatura é exibida
- **THEN** aparece "Parcial", saldo devedor R$ 300,00 e "Atrasada"

#### Scenario: Fatura vazia
- **GIVEN** uma fatura vencida sem compras
- **WHEN** as faturas são listadas
- **THEN** ela não aparece como vencida nem como dívida

### Requirement: Pagamento de fatura
O membro SHALL poder registrar pagamentos informando conta de origem (de qualquer tipo, exceto benefício), data real (não futura e não anterior à abertura da conta) e valor positivo limitado ao saldo devedor. O pagamento SHALL gerar uma única movimentação do tipo "pagamento de fatura", vinculada à fatura, que reduz o saldo da conta na data do pagamento e MUST NOT gerar despesa por categoria. A operação MUST ser atômica e protegida contra duplo envio e pagamentos simultâneos: a soma dos pagamentos nunca excede o total da fatura. Pagamento excedente e crédito em fatura não são suportados. Juros, multas e financiamento não são calculados, e a interface MUST informar que esses encargos não estão incluídos.

#### Scenario: Pagamento parcial e total
- **GIVEN** fatura de R$ 500,00 e conta corrente com R$ 2.000,00
- **WHEN** o membro paga R$ 200,00 e depois R$ 300,00
- **THEN** a fatura fica "Parcial" com saldo R$ 300,00 e depois "Quitada", e a conta passa a R$ 1.500,00

#### Scenario: Valor acima do saldo devedor
- **GIVEN** fatura com saldo devedor de R$ 300,00
- **WHEN** alguém tenta pagar R$ 300,01
- **THEN** o pagamento é recusado com "O valor excede o saldo devedor da fatura (R$ 300,00)"

#### Scenario: Reenvio e concorrência
- **WHEN** o mesmo pagamento é enviado duas vezes, ou dois pagamentos simultâneos somariam mais que o saldo devedor
- **THEN** existe um único pagamento por envio e a soma paga nunca ultrapassa o total da fatura

#### Scenario: Sem duplicar a despesa
- **GIVEN** compra de R$ 120,00 em Alimentação e o pagamento integral da fatura
- **WHEN** os gastos por categoria do mês são calculados
- **THEN** Alimentação soma R$ 120,00, sem somar o pagamento

### Requirement: Desfazer pagamento
O membro SHALL poder desfazer um pagamento registrado por engano, com confirmação. Desfazer MUST restaurar o saldo da conta e o saldo devedor da fatura de forma consistente.

#### Scenario: Pagamento lançado por engano
- **GIVEN** pagamento de R$ 200,00 que deixou a fatura "Parcial"
- **WHEN** o membro desfaz o pagamento
- **THEN** a fatura volta a "Em aberto" com o saldo anterior e a conta recupera R$ 200,00
