# Spec Delta

## Purpose

Compras no cartão de crédito, à vista ou parceladas, registradas com valores exatos e vinculadas às faturas em que serão cobradas.

## ADDED Requirements

### Requirement: Registro de compra
O membro SHALL poder registrar compra em cartão ativo do casal com descrição, valor total, data da compra (não futura), categoria ou subcategoria de despesa, responsável e observação opcionais, quantidade de parcelas (1 a 48, padrão 1) e fatura inicial. A compra MUST NOT movimentar nenhuma conta financeira. A operação MUST ser protegida contra duplo envio.

#### Scenario: Compra sem saída imediata do banco
- **GIVEN** conta corrente com R$ 2.000,00
- **WHEN** uma compra de R$ 250,00 é registrada no cartão
- **THEN** a conta continua com R$ 2.000,00 e a fatura recebe R$ 250,00

### Requirement: Fatura sugerida e escolha manual
Ao registrar a compra, o sistema SHALL sugerir a fatura cujo ciclo contém a data da compra (ou a próxima, se aquela já estiver quitada) e permitir escolher outra fatura não quitada do mesmo cartão. A interface MUST explicar que a sugestão é uma previsão manual e pode diferir da instituição.

#### Scenario: Escolher outra fatura
- **GIVEN** compra feita no dia do fechamento que a instituição lançou na fatura seguinte
- **WHEN** o membro escolhe a fatura seguinte
- **THEN** a compra (e suas parcelas) começa nessa fatura

### Requirement: Parcelas exatas
Compras parceladas SHALL ter uma compra original e parcelas vinculadas, cada uma com posição, valor e fatura, a primeira na fatura inicial e as seguintes nas faturas subsequentes do cartão. Os valores MUST ser em centavos exatos: cada parcela recebe o quociente inteiro e os centavos restantes são somados, um a um, às primeiras parcelas; a soma MUST ser igual ao total e nenhuma parcela pode ser zero. Todas as parcelas SHALL ser criadas no registro, sem limite de janela. A interface SHALL mostrar a prévia das parcelas antes de confirmar. Compras parceladas MUST NOT ser recorrências.

#### Scenario: Arredondamento
- **WHEN** uma compra de R$ 100,00 é registrada em 3 parcelas
- **THEN** as parcelas são R$ 33,34, R$ 33,33 e R$ 33,33, somando R$ 100,00

#### Scenario: Parcelas além de 12 meses
- **WHEN** uma compra de R$ 2.400,00 em 24 parcelas é registrada
- **THEN** existem 24 parcelas de R$ 100,00 em 24 faturas consecutivas, inclusive além de 12 meses

#### Scenario: Parcela zero
- **WHEN** alguém registra R$ 0,02 em 3 parcelas
- **THEN** o registro é recusado com "O valor não permite essa quantidade de parcelas"

### Requirement: Correções antes de pagamentos
Compras cujas parcelas não estão em faturas com pagamentos SHALL poder ser editadas e excluídas com confirmação; em compras parceladas, a interface MUST mostrar o alcance (todas as parcelas). Alterar valor, quantidade de parcelas, data ou fatura inicial SHALL recalcular todas as parcelas atomicamente. O membro SHALL poder mover uma parcela para outra fatura não quitada do mesmo cartão quando nem a origem nem o destino têm pagamentos.

#### Scenario: Recalcular parcelas
- **GIVEN** compra de R$ 300,00 em 3 parcelas sem pagamentos
- **WHEN** o valor muda para R$ 400,00 em 4 parcelas
- **THEN** passam a existir exatamente 4 parcelas de R$ 100,00, nas faturas consecutivas a partir da inicial

#### Scenario: Remanejar parcela
- **WHEN** o membro move a parcela 2 para a fatura seguinte, sem pagamentos em nenhuma das duas
- **THEN** a parcela muda de fatura e os totais das duas faturas são atualizados

### Requirement: Restrições após pagamentos
Se alguma parcela da compra estiver em fatura com pagamento, valores, quantidade, datas e faturas MUST NOT ser alterados, a compra MUST NOT ser excluída e suas parcelas MUST NOT ser movidas; o sistema SHALL orientar a desfazer primeiro o pagamento, caso tenha sido erro de cadastro. Descrição, categoria, responsável e observação SHALL continuar editáveis. Estornos, créditos e parcelamento de fatura não são suportados.

#### Scenario: Excluir compra com fatura paga
- **GIVEN** compra cuja parcela está em fatura com pagamento registrado
- **WHEN** o membro tenta excluí-la
- **THEN** a exclusão é recusada com "Há pagamento registrado na fatura desta compra. Se foi um erro de cadastro, desfaça o pagamento antes."

#### Scenario: Recategorizar compra paga
- **WHEN** o membro muda a categoria dessa compra para Lazer
- **THEN** a categoria muda e valores e faturas permanecem iguais

### Requirement: Limite estimado
Para cada cartão, o sistema SHALL mostrar o limite informado, o comprometimento estimado (soma de todas as parcelas confirmadas, inclusive futuras, menos os pagamentos registrados nas faturas do cartão) e o disponível estimado (limite − comprometimento), identificados como estimativas manuais. Previsões de cobranças recorrentes e saldos de contas MUST NOT entrar nesse cálculo. Ao exceder o limite, o sistema SHALL alertar sem impedir o registro.

#### Scenario: Comprometimento com parcelas futuras
- **GIVEN** limite de R$ 5.000,00, compra de R$ 1.200,00 em 12 parcelas e pagamento de R$ 100,00 da primeira fatura
- **WHEN** o limite é exibido
- **THEN** comprometido estimado é R$ 1.100,00 e disponível estimado R$ 3.900,00

#### Scenario: Estouro
- **GIVEN** disponível estimado de R$ 200,00
- **WHEN** uma compra de R$ 300,00 é registrada
- **THEN** a compra é salva e o cartão mostra "Acima do limite estimado"
