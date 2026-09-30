# Design

## Context

Serviços financeiros e regras puras (`accountBalances`, `monthTotals`, `budgetProgress`) existem e estão reconciliados com a fixture conhecida. Faltam agregações para gráficos e as telas.

## Goals / Non-Goals

**Goals:** números dos gráficos idênticos aos das listas/saldos (mesmas regras puras); acessibilidade; leveza no celular.

**Non-Goals:** relatórios anuais, exportação de gráficos, projeções futuras além das pendências existentes.

## Decisions

- **Regras puras** em `src/lib/finance/reports.ts`:
  - `expensesByCategory(movements, month, parentOf)` → categorias principais com valor e percentual (percentuais arredondados; soma exibida é o total exato em centavos).
  - `monthlySeries(movements, endMonth, 6)` → receitas/despesas realizadas por mês, com zeros.
  - `balanceEvolution(accounts, movements, month)` → `{ opening, points[{date, balance}] }` diário; `opening` = saldo ao fim do dia anterior ao mês.
  - `compare(current, previous)` → `{ delta, percent | null }` (null quando anterior = 0).
  - `buildInsights(...)` → frases determinísticas: maior categoria (% das despesas), variação de despesas vs mês anterior, categorias acima do limite, pendências atrasadas.
  - Todos reconciliados em testes com `FIXTURE_EXPECTED`.
- **Carregamento**: `src/server/finance/reports.ts` busca os lançamentos do casal com `movementSelect` (efetivados até o fim do mês + pendentes do mês), opcionalmente filtrados por conta (origem ou destino), e delega às regras puras. Volume de um casal permite agregação em memória; mantém uma única fonte de regra.
- **Gráficos**: Recharts em Client Components recebendo dados já agregados (props serializáveis). Tooltip com `trigger` padrão (toque ativa no mobile); cores das categorias persistidas; valores formatados por `formatBRL`. Alternativa textual: legenda/tabela sempre renderizada no servidor ao lado do gráfico; o SVG recebe `role="img"` com `aria-label` resumido.
- **Revelação progressiva**: `/relatorios?aba=categorias|mensal|saldo` renderiza somente a aba ativa (abas são links → funciona sem JS e mantém filtros na URL). Início mostra resumo + 3 itens de orçamento + vencimentos + insights, com links "ver mais".
- **Calendário**: `/lancamentos?visao=calendario` reaproveita `listTransactions` do mês e agrupa por data de referência; células com totais compactos; dia → `?de=D&ate=D`.
- **Estados**: `loading.tsx` (skeletons) e `error.tsx` (mensagem + "Tentar novamente") no grupo `(app)`.

## Risks / Trade-offs

- Agregação em memória cresce com o histórico → aceitável no MVP; migrar para SQL `GROUP BY` se necessário, mantendo os mesmos testes de reconciliação.
