# Proposal

## Why

Boa parte das finanças do casal se repete: salário, aluguel, assinaturas, cobranças mensais temporárias, a transferência mensal para a reserva. Hoje cada ocorrência precisa ser lançada à mão, e as previsões (pendências, orçamento, calendário) ficam incompletas até alguém lembrar de cadastrar.

## What Changes

- Novo conceito de **recorrência**: uma série periódica (semanal, mensal ou anual) de receita, despesa ou transferência entre contas financeiras do casal.
- Três formas de término: **após N ocorrências**, **até uma data (inclusive)** ou **sem término**. O término é o fim lógico da programação.
- Valor informado **por ocorrência**; cada ocorrência é um lançamento comum, com identidade estável pela posição na série ("Ocorrência 3 de 12").
- **Janela de geração de 12 meses** para todas as séries: ocorrências com data prevista até hoje + 12 meses (inclusive, fuso de São Paulo) existem como pendentes. A expansão gera só posições ausentes, inclusive intermediárias após um período sem uso, e nunca altera ocorrências existentes. Sem tarefa agendada.
- Primeira ocorrência opcionalmente efetivada na criação, com data real de efetivação separada e não futura.
- Edição: "Só este lançamento" (personaliza a ocorrência, inclusive data) ou "Este e os próximos" (muda a regra a partir da posição, preservando efetivadas e personalizadas). Tipo, frequência e data inicial são imutáveis.
- Exclusão: "Só este lançamento" (exceção persistente) ou "Este e os próximos" (encerra antes da posição); "Encerrar recorrência" a partir de uma data, preservando pendências anteriores.
- Tela de recorrências distinguindo programação ativa/encerrada, pendentes já geradas e ocorrências ainda previstas para geração.

## Não faz parte desta change

- **Compras parceladas de cartão**: serão do futuro módulo de cartões, vinculadas à compra original e às faturas. Este módulo não modela parcelamento.
- Campos ou entidades de cartão; frequências personalizadas; valor total dividido; término "por N meses"; edição de tipo, frequência ou data inicial.

## Capabilities

### New Capabilities
- `recurring-transactions`: séries recorrentes, datas, término, janela de geração, identidade das ocorrências, edição/exclusão em escopo, encerramento e consulta.

### Modified Capabilities
- `transactions`: lançamentos podem pertencer a uma recorrência e exibir sua posição.

## Impact

- Migration aditiva: tabelas `recurring_series`, `recurring_rule` (regra por posição) e `recurring_exception` (posições excluídas); colunas `seriesId`, `occurrenceIndex`, `seriesOverride` em `financial_transaction`; unicidade e gatilhos de isolamento.
- Regras puras em `src/lib/finance/recurrence.ts`; serviço `src/server/finance/recurrences.ts`; formulário, detalhe e lista de lançamentos; Mais → Recorrências.
- README: recorrência entra no MVP; parcelamento de cartão segue fora.
