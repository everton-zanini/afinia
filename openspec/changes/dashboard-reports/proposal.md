# Proposal

## Why

Com os lançamentos persistidos, o casal precisa responder rapidamente: quanto temos, quanto entrou e saiu no mês, onde estamos gastando, o que vence em breve e como está o orçamento — sem planilhas e sem poluir a tela do celular.

## What Changes

- **Início (dashboard)**: resumo com saldo total, receitas e despesas realizadas, resultado do mês e comparação com o mês anterior; próximos vencimentos e pendências atrasadas; orçamento resumido; insights determinísticos; acesso progressivo aos detalhes.
- **Relatórios**: abas com gráfico de rosca de despesas por categoria, barras de receitas × despesas nos últimos 6 meses e linha da evolução do saldo realizado (com saldo inicial do período). Filtros de mês e conta. Cada gráfico com tooltip utilizável no toque, alternativa textual, estado vazio e links para os lançamentos correspondentes.
- **Lançamentos**: alternância entre lista cronológica e calendário mensal.
- Estados de carregamento e erro nas telas principais.

## Capabilities

### New Capabilities
- `dashboard`: resumo inicial, comparação mensal, vencimentos, insights.
- `reports`: gráficos e suas alternativas acessíveis, filtros e drill-down.

### Modified Capabilities
- `transactions`: visualização em calendário mensal.

## Impact

- Regras puras novas em `src/lib/finance/reports.ts` (reconciliadas com a fixture conhecida).
- Serviço `src/server/finance/reports.ts`; componentes de gráfico (Recharts, Client Components).
- Páginas `/inicio`, `/relatorios`; visão calendário em `/lancamentos`.
