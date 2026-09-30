# Tasks

## 1. Regras e dados

- [x] 1.1 Implementar `lib/finance/reports.ts` (categorias, série de 6 meses, evolução do saldo, comparação, insights) e verificar com testes unitários sobre a fixture
- [x] 1.2 Implementar `server/finance/reports.ts` (dashboard e relatórios, filtro por conta) e verificar por teste de integração de reconciliação com a fixture persistida, incluindo isolamento

## 2. Interface

- [x] 2.1 Início: cards de resumo com comparação, previsões separadas, vencimentos/atrasos, orçamento resumido, insights e estado vazio; verificar por E2E
- [x] 2.2 Relatórios com abas (rosca, barras, linha), filtros de mês e conta, alternativas textuais, estados vazios e links; verificar por E2E (valores exibidos = fixture)
- [x] 2.3 Alternância lista ↔ calendário em Lançamentos; verificar por E2E
- [x] 2.4 `loading.tsx` e `error.tsx` no grupo autenticado; verificar build e navegação
- [x] 2.5 Verificar ausência de rolagem horizontal em 360 px nas novas telas (E2E)

## 3. Validação

- [x] 3.1 Executar `openspec validate dashboard-reports --strict`, typecheck, lint, testes, build e E2E
