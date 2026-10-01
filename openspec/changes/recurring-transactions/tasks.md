# Tasks

## 1. Regras puras

- [x] 1.1 Implementar `lib/finance/recurrence.ts` (`scheduledDate`, `horizon`, `lastLogicalIndex`, `positionsToGenerate`, `ruleFor`, `positionLabel`, `summarize`) e verificar com testes unitários: dia 31, 29/02, virada de ano, término por N/data inclusive/sem término, horizonte de 12 meses inclusive, série finita além da janela, resolução de regra por posição, contagens com exclusões e encerramento

## 2. Modelo

- [x] 2.1 Adicionar `RecurringSeries`, `RecurringRule`, `RecurringException` e colunas `seriesId`/`occurrenceIndex`/`seriesOverride` em `Transaction`, com unicidade `(seriesId, occurrenceIndex)`, CHECKs e gatilhos de isolamento; gerar migration e verificar `migrate dev`/`deploy` no banco de teste e testes que violam a unicidade, um CHECK e uma referência cruzada

## 3. Serviço

- [x] 3.1 `createSeries` (validações reaproveitadas, idempotência, primeira ocorrência efetivada com data real não futura, transferência atômica) e verificar por testes de integração
- [x] 3.2 `ensureGenerated` (janela, só posições ausentes, exceções, lotes, lock + `skipDuplicates`, sem alterar existentes) e verificar por testes de integração: série finita além da janela, retorno após meses sem acesso, geração concorrente, ocorrência com data alterada não duplicada, janela avança sem alterar existentes
- [x] 3.3 Edição em escopo (só este com override e data; este e os próximos com nova regra por posição; bloqueio para efetivada) e verificar por testes de integração preservando exceções e efetivadas e aplicando a regra a posições geradas depois
- [x] 3.4 Exclusão em escopo (exceção persistente; encerrar antes da posição com pré-visualização de quantidade/valor) e encerramento por data preservando pendências vencidas; verificar por testes de integração (ocorrência excluída não reaparece; encerramento preservando vencidas)
- [x] 3.5 `summarize`/consulta de recorrências e verificar por teste de integração (série encerrada com pagamentos pendentes; restantes considerando exclusão)
- [x] 3.6 Chamar `ensureGenerated` em `requireHousehold` (memoizado) e verificar que orçamento e previsões incluem ocorrências e que transferência recorrente não altera receitas/despesas (teste de integração)
- [x] 3.7 Estender testes de isolamento: séries, regras, exceções e ocorrências de outro casal inacessíveis; `seriesId`/`occurrenceIndex` forjados ignorados; duplicar ocorrência gera avulso

## 4. Interface

- [x] 4.1 Seção "Repetir" no novo lançamento (frequência; após N ocorrências / até data / sem término; data real de efetivação quando já paga/recebida/realizada) e verificar por E2E em 360 px
- [x] 4.2 Edição com escolha de escopo (oculta "Este e os próximos" para efetivadas; tipo/frequência só leitura) e exclusão com escopo e confirmação de quantidade/valor; verificar por E2E
- [x] 4.3 Selo "Ocorrência N de M" / "Recorrente · frequência" na lista e no detalhe; verificar por E2E
- [x] 4.4 Mais → Recorrências (programação ativa/encerrada, pendentes geradas, previstas para geração, encerrar em data, ver lançamentos) e filtro `serie` na lista; verificar por E2E e ausência de rolagem horizontal

## 5. Documentação e validação

- [x] 5.1 Atualizar README (recorrência no MVP; parcelamento de cartão fora; nota sobre futura cobrança recorrente na fatura) e verificar
- [x] 5.2 Executar `openspec validate recurring-transactions --strict`, typecheck, lint, testes, build e E2E
