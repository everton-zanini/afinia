# Tasks

## 1. Base monetária e datas

- [x] 1.1 Implementar `lib/money.ts` (parseBRL, formatBRL, assertCents) e verificar com testes unitários (0,10+0,20+0,30; formatos inválidos; negativos)
- [x] 1.2 Implementar `lib/dates.ts` (todayISO em São Paulo, conversões DB, meses) e verificar com testes unitários (virada de dia em UTC)

## 2. Modelo

- [x] 2.1 Adicionar Category, FinancialAccount, Transaction e Budget com FKs compostas e CHECKs; gerar migration e verificar `migrate dev`/`migrate deploy` e um teste que viola cada CHECK
- [x] 2.2 Semear categorias sugeridas em `onHouseholdCreated` (idempotente); verificar por teste de integração

## 3. Regras puras

- [x] 3.1 Implementar `lib/finance` (saldos por conta, totais do mês, orçamento com agregação de subcategorias e alertas) e verificar com testes unitários sobre fixture conhecida

## 4. Serviços

- [x] 4.1 Serviço de categorias (criar, editar, arquivar, reativar, excluir se não usada); verificar por testes de integração
- [x] 4.2 Serviço de contas (criar, editar com regra da data de abertura, arquivar, excluir se sem lançamentos, saldos); verificar por testes de integração
- [x] 4.3 Serviço de lançamentos (criar idempotente, editar, excluir, marcar pago/pendente, obter para duplicar, listar com filtros, mais usados); verificar por testes de integração incluindo transferências
- [x] 4.4 Serviço de orçamento (definir/remover limite, progresso do mês, copiar mês anterior); verificar por testes de integração
- [x] 4.5 Testes de isolamento com dois casais cobrindo leitura, alteração, exclusão, agregação, exportação e referências cruzadas

## 5. Interface

- [x] 5.1 Mais → Categorias (lista por tipo com subcategorias, criar/editar, arquivar/excluir); verificar por E2E
- [x] 5.2 Mais → Contas (lista com saldo, criar/editar, arquivar/excluir); verificar por E2E
- [x] 5.3 Novo lançamento mobile-first (tipo, valor, categoria/conta sugeridas, data de hoje, pago, detalhes recolhidos) e edição; verificar por E2E em 360 px
- [x] 5.4 Lista de lançamentos (agrupada por data, realizados × previstos, busca, filtros, exportar CSV) e detalhe (marcar pago, duplicar, excluir com confirmação); verificar por E2E
- [x] 5.5 Planejamento (orçamento do mês, navegação entre meses, definir limite, copiar mês anterior, alertas com texto e ícone); verificar por E2E

## 6. Validação

- [x] 6.1 Executar `openspec validate finance-core --strict`, typecheck, lint, testes, build e E2E
