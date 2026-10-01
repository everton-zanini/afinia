# financial-accounts Specification

## Purpose
Contas financeiras indicam onde o dinheiro do casal está (banco, dinheiro, reserva) e mantêm seu saldo realizado.

## Requirements

### Requirement: Cadastro de contas
O casal SHALL poder cadastrar contas dos tipos conta bancária, dinheiro, reserva e benefício, com nome livre, saldo inicial e data de abertura. O tipo é estruturado (lista fixa); o nome é escolhido pelo casal para qualquer tipo. O saldo inicial pode ser negativo, exceto em contas de benefício, onde MUST ser zero ou positivo. Contas cadastradas antes da existência do tipo benefício MUST continuar com o tipo e o saldo que já tinham.

#### Scenario: Nova conta
- **WHEN** um membro cadastra "Conta corrente" com saldo inicial R$ 1.000,00 em 01/03/2026
- **THEN** a conta aparece com saldo realizado R$ 1.000,00

#### Scenario: Benefício com nome livre
- **WHEN** um membro cadastra a conta "Vale-refeição da esposa" do tipo Benefício, finalidade Refeição, saldo inicial R$ 320,00
- **THEN** a conta aparece com esse nome, a indicação "Benefício · Refeição" e saldo realizado R$ 320,00

#### Scenario: Benefício com saldo negativo
- **WHEN** um membro informa saldo inicial −R$ 10,00 para uma conta de benefício
- **THEN** o cadastro é recusado com "O saldo de um benefício não pode ser negativo"

#### Scenario: Contas existentes
- **GIVEN** contas bancária, dinheiro e reserva cadastradas antes desta versão
- **WHEN** o casal abre Contas após a atualização
- **THEN** as contas mantêm tipo, nome e saldo, sem finalidade de benefício

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

### Requirement: Finalidade do benefício
Contas do tipo Benefício MUST ter uma finalidade entre alimentação, refeição, mobilidade/combustível, flexível ou outros; os demais tipos MUST NOT ter finalidade. A finalidade é informativa: o sistema MUST NOT bloquear lançamentos por categoria ou finalidade. Benefícios não têm fatura, fechamento, vencimento nem limite de crédito.

#### Scenario: Categoria independente da conta
- **GIVEN** a conta "Cartão combustível" (Benefício, mobilidade/combustível)
- **WHEN** um membro registra nela uma despesa da categoria Alimentação
- **THEN** a despesa é aceita normalmente

### Requirement: Saldo de uso geral separado dos benefícios
O saldo disponível para uso geral SHALL somar apenas contas bancárias, dinheiro e reservas ativas. O saldo de benefícios SHALL somar as contas de benefício ativas e ser exibido separadamente. Quando um total consolidado for exibido, ele MUST informar sua composição (uso geral + benefícios). O saldo realizado de cada conta segue a mesma regra de cálculo para todos os tipos.

#### Scenario: Composição dos saldos
- **GIVEN** conta corrente com saldo R$ 2.000,00, dinheiro R$ 150,00 e vale-alimentação R$ 600,00
- **WHEN** o casal consulta os saldos
- **THEN** o disponível para uso geral é R$ 2.150,00, o saldo em benefícios é R$ 600,00 e o total consolidado é R$ 2.750,00 (R$ 2.150,00 + R$ 600,00)

#### Scenario: Saldo do benefício
- **GIVEN** um vale-alimentação aberto com R$ 0,00, crédito efetivado de R$ 800,00 e despesa efetivada de R$ 215,40
- **WHEN** o saldo é calculado
- **THEN** o saldo realizado do benefício é R$ 584,60

### Requirement: Mudança de tipo de conta
Uma conta MUST NOT passar a ser do tipo Benefício se tiver transferências registradas. A troca para outros tipos segue as regras existentes.

#### Scenario: Conta com transferências
- **GIVEN** uma conta "Carteira" que recebeu uma transferência
- **WHEN** um membro tenta mudar seu tipo para Benefício
- **THEN** a alteração é recusada com "Contas com transferências não podem virar benefício"
