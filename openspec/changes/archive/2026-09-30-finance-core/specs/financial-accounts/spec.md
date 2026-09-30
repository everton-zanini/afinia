# Spec Delta

## Purpose

Contas financeiras indicam onde o dinheiro do casal está (banco, dinheiro, reserva) e mantêm seu saldo realizado.

## ADDED Requirements

### Requirement: Cadastro de contas
O casal SHALL poder cadastrar contas dos tipos conta bancária, dinheiro e reserva, com nome, saldo inicial (pode ser negativo) e data de abertura.

#### Scenario: Nova conta
- **WHEN** um membro cadastra "Conta corrente" com saldo inicial R$ 1.000,00 em 01/03/2026
- **THEN** a conta aparece com saldo realizado R$ 1.000,00

### Requirement: Saldo inicial não é receita
O saldo inicial SHALL ser uma posição de abertura na data de abertura. Ele MUST NOT ser contado como receita em totais, relatórios ou orçamento.

#### Scenario: Totais do mês de abertura
- **GIVEN** a conta aberta em 01/03/2026 com saldo inicial R$ 1.000,00 e nenhum lançamento
- **WHEN** o casal consulta as receitas realizadas de março de 2026
- **THEN** o total é R$ 0,00 e o saldo total é R$ 1.000,00

### Requirement: Data de abertura limita lançamentos efetivados
Um lançamento efetivado que movimenta uma conta MUST ter data de efetivação igual ou posterior à data de abertura dessa conta. A data de abertura MUST NOT ser alterada para depois de um lançamento efetivado existente na conta.

#### Scenario: Pagamento antes da abertura
- **GIVEN** a conta aberta em 01/03/2026
- **WHEN** alguém registra uma despesa paga em 28/02/2026 nessa conta
- **THEN** a operação é recusada com "A data de pagamento é anterior à abertura da conta"

### Requirement: Saldo realizado da conta
O saldo realizado SHALL ser: saldo inicial + receitas efetivadas − despesas efetivadas − transferências efetivadas enviadas + transferências efetivadas recebidas. Lançamentos pendentes MUST NOT alterar o saldo realizado.

#### Scenario: Saldo com pendência
- **GIVEN** conta com saldo inicial R$ 100,00, uma receita efetivada de R$ 50,00 e uma despesa pendente de R$ 30,00
- **WHEN** o saldo é exibido
- **THEN** o saldo realizado é R$ 150,00 e a despesa pendente aparece separadamente como previsão

### Requirement: Arquivamento de contas
Contas com lançamentos MUST NOT ser excluídas; SHALL ser arquivadas, deixando de aparecer para novos lançamentos e mantendo o histórico. Contas sem lançamentos podem ser excluídas.

#### Scenario: Excluir conta com lançamentos
- **GIVEN** uma conta com lançamentos
- **WHEN** um membro tenta excluí-la
- **THEN** a exclusão é recusada e é oferecido o arquivamento
