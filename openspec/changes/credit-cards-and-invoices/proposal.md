# Proposal

## Why

O casal usa cartões de crédito, e hoje isso só pode ser representado com despesas manuais ("Fatura do cartão"), que misturam o momento do gasto com o do pagamento, não mostram parcelas futuras nem o limite comprometido, e distorcem orçamento e saldo. Recorrências e benefícios já existem; falta o controle manual de cartões e faturas, com regras claras que não contem o mesmo gasto duas vezes.

## What Changes

- **Cartões de crédito** do casal: nome livre, emissor e 4 últimos dígitos opcionais, cor, limite informado, dia de fechamento, dia de vencimento, titular (informativo), conta sugerida para pagamento (nunca benefício), ativo/arquivado. Nenhum número completo, CVV, senha ou credencial é armazenado.
- **Faturas** com identidade estável e datas próprias gravadas (início do ciclo, fechamento, vencimento), regra determinística de ciclos e estados calculados na consulta: ciclo aberto/fechado; pagamento em aberto/parcial/quitado; atraso.
- **Compras** à vista e parceladas: compra original + parcelas com posição, valor exato em centavos e fatura; todas as parcelas geradas na criação; prévia antes de confirmar; fatura sugerida pela data com escolha de outra fatura não quitada.
- **Pagamento de fatura**: movimentação financeira específica (novo tipo de lançamento) vinculada à fatura, parcial ou total até o saldo devedor, data real não futura, atômico, idempotente e seguro sob concorrência; pode ser desfeito. Juros, multas e encargos não são calculados.
- **Correções**: editar/excluir compras sem pagamentos associados, recalculando parcelas; remanejar parcela para outra fatura não quitada; apenas descrição, categoria, responsável e observação editáveis quando há pagamentos.
- **Recorrências no cartão**: despesas recorrentes podem ter um cartão como destino; geram previsões de cobrança (sem afetar saldo ou limite) que o casal confirma uma única vez, virando compra.
- **Três visões explícitas**: caixa (contas), gastos/orçamento (categoria, pelo mês de vencimento da parcela) e limite (estimativa manual).
- **Interface**: Cartões acessível em Mais e no Início; lista de cartões com fatura atual, próximo vencimento e barra de limite; detalhe com navegação entre faturas, compras, previsões, pagamentos, gastos por categoria, compromissos das próximas faturas e parcelas futuras por mês. Início mostra dinheiro em contas, benefícios e dívidas de cartão separados.
- **Transição**: orientação para quem registrava faturas como despesa manual (não há conversão automática).

## Não faz parte desta change

Integração bancária; estornos, créditos em fatura, pagamento excedente, juros, multas, financiamento ou parcelamento de fatura; dicas educativas; cartões de benefício (continuam contas com saldo).

## Capabilities

### New Capabilities
- `credit-cards`: cadastro, titularidade informativa, arquivamento e mudança de ciclo.
- `card-invoices`: ciclos, faturas, estados, pagamento e desfazer pagamento.
- `card-purchases`: compras, parcelas, edição e remanejamento.

### Modified Capabilities
- `transactions`: novo tipo "pagamento de fatura".
- `recurring-transactions`: destino em cartão para despesas recorrentes, com previsões e confirmação.
- `budgets`: consumo inclui parcelas de cartão pelo mês de vencimento.
- `dashboard`: resumo separa contas, benefícios e dívidas de cartão; gastos incluem cartão; pagamentos identificados.
- `reports`: gastos por categoria incluem cartão sem duplicar pagamentos.

## Impact

- Migrations aditivas: `credit_card`, `card_invoice`, `card_purchase`, `card_installment`; valor `CARD_PAYMENT` em `TransactionKind`; `invoiceId` em `financial_transaction`; `cardId` em `recurring_series`; `recurring_rule.accountId` anulável; CHECKs e gatilhos de isolamento.
- Novos módulos `src/lib/finance/cards.ts` (regras puras) e `src/server/finance/cards.ts`; extensões em regras, recorrências, orçamento, relatórios e Início.
