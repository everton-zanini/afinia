# credit-cards Specification

## Purpose
Controle manual dos cartões de crédito do casal: cadastro, limite informado, ciclo de fechamento e vencimento, titularidade informativa e arquivamento, sem armazenar dados sensíveis do cartão.

## Requirements

### Requirement: Cadastro de cartão
O casal SHALL poder cadastrar cartões com nome livre, emissor opcional, quatro últimos dígitos opcionais (exatamente 4 dígitos), cor, limite informado (positivo), dia de fechamento e dia de vencimento (1 a 31), membro titular e conta sugerida para pagamento (opcional). O sistema MUST NOT aceitar nem armazenar número completo, CVV, senha ou credencial bancária. A conta sugerida MUST NOT ser de benefício.

#### Scenario: Novo cartão
- **WHEN** um membro cadastra "Cartão roxo", emissor "Banco X", final 1234, limite R$ 5.000,00, fechamento dia 5, vencimento dia 15, titular Ana, conta sugerida Conta corrente
- **THEN** o cartão aparece na lista do casal com esses dados

#### Scenario: Dados sensíveis
- **WHEN** alguém informa "1234 5678 9012 3456" como últimos dígitos
- **THEN** o cadastro é recusado com "Informe somente os 4 últimos dígitos"

#### Scenario: Conta de benefício para pagamento
- **WHEN** alguém escolhe o vale-alimentação como conta sugerida para pagamento
- **THEN** o cadastro é recusado com "Contas de benefício não podem pagar fatura"

### Requirement: Acesso compartilhado e titular informativo
Os dois membros do casal SHALL poder ver e gerenciar todos os cartões do casal; o titular é apenas informativo. Cartões de outro casal MUST ser tratados como inexistentes.

#### Scenario: Cartão do parceiro
- **GIVEN** um cartão com titular Beto
- **WHEN** Ana registra uma compra nele
- **THEN** a compra é aceita e registrada como cadastrada por Ana

### Requirement: Arquivamento
Arquivar um cartão SHALL impedir novas compras e confirmações de cobranças recorrentes nele, e interromper a geração de novas previsões, preservando compras, faturas, pagamentos e o acesso a eles. Faturas com saldo devedor continuam podendo ser pagas.

#### Scenario: Cartão arquivado com fatura em aberto
- **GIVEN** um cartão arquivado com fatura de R$ 300,00 em aberto
- **WHEN** um membro abre o cartão
- **THEN** vê a fatura e pode registrar o pagamento, mas não pode registrar nova compra

### Requirement: Mudança de fechamento e vencimento
Alterar o dia de fechamento ou de vencimento SHALL valer apenas para faturas criadas depois da alteração. Faturas existentes, inclusive futuras já criadas por parcelas, MUST manter suas datas, e nenhuma compra é movida. A interface MUST explicar esse efeito antes de salvar.

#### Scenario: Novo dia de fechamento
- **GIVEN** um cartão com fechamento dia 5 e faturas já criadas até a de fechamento 05/06/2026
- **WHEN** o fechamento muda para o dia 10
- **THEN** as faturas existentes mantêm suas datas e a próxima fatura criada fecha em 10/07/2026, começando em 06/06/2026
