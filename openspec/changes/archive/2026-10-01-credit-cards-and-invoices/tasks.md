# Tasks

## 1. Regras puras

- [x] 1.1 `lib/finance/cards.ts`: `clampDay`, primeira fatura, seguinte, anterior, vencimento, `splitInstallments`, `invoiceStatus`, comprometimento/limite; verificar com testes unitários (antes/no dia/depois do fechamento, meses curtos, vencimento no mês seguinte, mudança de dia, arredondamento e soma exata, parcela zero, fatura vazia, atraso)
- [x] 1.2 Extender `rules.ts`/`reports.ts` para `CARD_PAYMENT` (saída de caixa), gastos de cartão e previsões; verificar com testes unitários (sem duplicação, fixture inalterada sem cartões)

## 2. Modelo

- [x] 2.1 Migrations (enum `CARD_PAYMENT`; tabelas, colunas, CHECKs e gatilhos de isolamento, benefício e coerência) aplicadas em dev/teste sem divergência; verificar por teste de integração que o banco recusa referências cruzadas, benefício pagando fatura e fatura de outro cartão

## 3. Serviços

- [x] 3.1 Cartões: criar, editar (dias valem para novas faturas), arquivar; validações (4 dígitos, conta de pagamento não benefício, titular do casal); verificar por testes de integração
- [x] 3.2 Faturas: `ensureInvoiceFor`/sequência, situação, listagem; verificar por testes de integração (sequência estável, mudança de dia, concorrência sem duplicar faturas)
- [x] 3.3 Compras: criar com parcelas (sugestão, escolha, idempotência, 24 parcelas), editar/excluir/mover com restrições após pagamento; verificar por testes de integração
- [x] 3.4 Pagamentos: pagar (parcial/total, limite ao saldo, idempotência, concorrência), desfazer, bloqueio das operações comuns; verificar por testes de integração
- [x] 3.5 Recorrências no cartão: criar série com cartão, gerar previsões, confirmar idempotente, pular/encerrar, destino imutável; verificar por testes de integração
- [x] 3.6 Integração: orçamento, relatórios, Início (contas, benefícios, dívidas, gastos com cartão, pagamentos identificados) e limite; verificar por teste de reconciliação com fixture de cartão
- [x] 3.7 Isolamento entre dois casais (cartões, faturas, compras, parcelas, pagamentos, previsões, agregações e manipulação de ids) e compatibilidade com benefícios; verificar por testes de integração

## 4. Interface

- [x] 4.1 Lista de cartões, cadastro e edição (com explicação da mudança de dias e arquivamento); entrada em Mais e bloco no Início; verificar por E2E
- [x] 4.2 Nova compra com fatura sugerida, escolha de fatura, prévia de parcelas e aviso de limite; verificar por E2E
- [x] 4.3 Detalhe do cartão: navegação entre faturas, situação, compras e parcelas, previsões (confirmar/pular), pagamento (dialog) e histórico com desfazer, gastos por categoria, próximas faturas e parcelas futuras (gráfico + alternativa textual); verificar por E2E
- [x] 4.4 Detalhe/edição da compra com alcance, restrições e remanejamento; verificar por E2E
- [x] 4.5 "Repetir" com destino cartão no novo lançamento; pagamento de fatura na lista/detalhe de lançamentos sem ações comuns; verificar por E2E e ausência de rolagem horizontal em 360 px

## 5. Documentação e validação

- [x] 5.1 README: três visões (fórmulas e fontes), cartões, faturas, limitações e transição de faturas manuais
- [x] 5.2 `openspec validate credit-cards-and-invoices --strict`, typecheck, lint, testes, build e E2E; registrar o que não pôde ser verificado
  - Não verificado: Safari/iOS real; migrations não aplicadas em produção (fora desta change); 360 px só em Chromium (Pixel 5).
