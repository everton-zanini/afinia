# Proposal

## Why

Com casais isolados e autenticação prontos, falta o núcleo do produto: registrar receitas, despesas e transferências de forma rápida no celular, com saldos corretos e um orçamento mensal por categoria. É a base dos relatórios e do dashboard.

## What Changes

- **Categorias (plano de contas)**: categorias e subcategorias de receita/despesa com nome, cor, ícone e status ativo/arquivado; sugestões iniciais editáveis criadas junto com o casal; categorias usadas são arquivadas, nunca excluídas.
- **Contas financeiras**: conta bancária, dinheiro e reserva, com saldo inicial e data de abertura; saldo realizado calculado a partir dos lançamentos efetivados.
- **Lançamentos**: receita, despesa e transferência; criação, consulta, edição, exclusão com confirmação, marcar como pago/recebido, duplicar, busca, filtros (período, categoria, conta, situação, pessoa) e exportação CSV dos resultados filtrados.
- Proteção contra duplicação por duplo toque/reenvio (chave de idempotência).
- Regras monetárias: centavos inteiros, valores positivos, tipo define o efeito, datas de calendário sem fuso.
- **Orçamento mensal** por categoria principal de despesa: limite, realizado, pendente, disponível, percentual, alertas e cópia do mês anterior.
- Formulário de novo lançamento mobile-first (teclado numérico, hoje como padrão, sugestões das mais usadas, campos avançados recolhidos).

## Capabilities

### New Capabilities
- `categories`: plano de contas compartilhado do casal.
- `financial-accounts`: contas onde o dinheiro está e seus saldos.
- `transactions`: lançamentos, regras financeiras, filtros e exportação.
- `budgets`: orçamento mensal por categoria.

### Modified Capabilities
- `households`: a criação do casal passa a incluir as categorias sugeridas.

## Impact

- Novas tabelas `category`, `financial_account`, `transaction`, `budget` com chaves compostas `(id, household_id)` garantindo no banco que referências pertencem ao mesmo casal; restrições CHECK para regras de valor, situação e transferência.
- Novos serviços em `src/server/finance/*`, utilitários `src/lib/money.ts`, `src/lib/dates.ts`, regras puras `src/lib/finance/*`.
- Páginas Lançamentos, Planejamento e Mais → Categorias/Contas.
