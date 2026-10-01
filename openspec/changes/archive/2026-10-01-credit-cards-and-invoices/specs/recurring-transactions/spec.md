# Spec Delta

## ADDED Requirements

### Requirement: Recorrência cobrada no cartão
Recorrências de despesa SHALL poder ter como destino uma conta financeira ou um cartão de crédito ativo do casal; receitas e transferências MUST NOT usar cartão. O destino (conta ou cartão específico) é fixo na série: para mudar de conta para cartão, ou de cartão, o casal encerra a série e cria outra, e a interface MUST orientar a encerrar antes para não haver sobreposição. A janela de 12 meses, exceções, encerramentos, edição em escopo e idempotência continuam valendo.

#### Scenario: Assinatura no cartão
- **GIVEN** hoje é 01/04/2026
- **WHEN** um membro cria a despesa mensal "Streaming" de R$ 55,90 no "Cartão roxo" a partir de 10/04/2026, sem término
- **THEN** existem 12 previsões de cobrança (10/04/2026 a 10/03/2027), cada uma com a fatura sugerida pela data, e nenhuma compra confirmada

#### Scenario: Receita no cartão
- **WHEN** alguém tenta criar uma receita recorrente com destino em cartão
- **THEN** a operação é recusada

### Requirement: Previsão de cobrança
Cada ocorrência de série no cartão SHALL ser uma previsão de cobrança vinculada à série e à posição, com data prevista, valor e fatura sugerida. Previsões MUST NOT afetar saldo de contas nem o limite comprometido, aparecem separadas das compras confirmadas e entram no orçamento apenas como previsto. A interface MUST NOT oferecer "Marcar como pago" para elas: o pagamento acontece na fatura.

#### Scenario: Previsão não consome limite
- **GIVEN** limite de R$ 5.000,00 sem compras e uma previsão de R$ 55,90
- **WHEN** o limite é exibido
- **THEN** o comprometido estimado é R$ 0,00

### Requirement: Confirmar cobrança
O membro SHALL poder confirmar uma previsão revisando data (não futura), valor e fatura (não quitada, do mesmo cartão). A confirmação SHALL converter a previsão em compra confirmada à vista uma única vez, preservando o vínculo com a série, sem criar despesa comum. Confirmar novamente MUST NOT criar outra compra. Pular uma previsão ("Só este") registra exceção; "Este e os próximos" encerra a série antes da posição e remove as previsões seguintes; compras confirmadas permanecem.

#### Scenario: Confirmação idempotente
- **GIVEN** a previsão de 10/04/2026 de R$ 55,90
- **WHEN** o membro confirma com valor R$ 59,90 e a confirmação é reenviada
- **THEN** existe uma única compra de R$ 59,90 vinculada à série e à posição, e nenhuma despesa comum foi criada
