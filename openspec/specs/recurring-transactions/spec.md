# recurring-transactions Specification

## Purpose
Permite cadastrar uma vez receitas, despesas e transferências periódicas, gerando automaticamente as ocorrências como lançamentos pendentes, com término após N ocorrências, até uma data ou sem término. Não representa compras parceladas de cartão.

## Requirements

### Requirement: Criação de recorrência
O membro SHALL poder criar uma recorrência de receita, despesa ou transferência informando os mesmos campos de um lançamento (descrição, valor por ocorrência, categoria ou contas, responsável, observação), a data da primeira ocorrência, a frequência (semanal, mensal ou anual) e o término. A recorrência MUST pertencer ao casal da sessão e respeitar as mesmas validações de referências, tipos e valores de um lançamento. Os destinos são as contas financeiras do casal.

#### Scenario: Aluguel mensal
- **GIVEN** hoje é 05/04/2026 e o casal tem a categoria Moradia e a conta Corrente
- **WHEN** um membro cria a despesa "Aluguel" de R$ 1.800,00, mensal, a partir de 10/04/2026, sem término
- **THEN** existe uma recorrência com programação ativa e as ocorrências de 10/04/2026 a 10/03/2027 existem como despesas pendentes de R$ 1.800,00

#### Scenario: Referência de outro casal
- **GIVEN** a conta "Poupança" do casal B
- **WHEN** um membro do casal A cria uma recorrência nessa conta
- **THEN** a operação é recusada como "Registro não encontrado" e nada é gerado

#### Scenario: Transferência recorrente
- **GIVEN** uma transferência mensal recorrente de R$ 500,00 da Corrente para a Reserva, com a ocorrência de abril efetivada
- **WHEN** os totais de abril são calculados
- **THEN** receitas e despesas não mudam, a Corrente diminui R$ 500,00 e a Reserva aumenta R$ 500,00

### Requirement: Formas de término
A recorrência SHALL terminar de uma destas formas: após N ocorrências (2 a 600), até uma data final inclusive (posterior à primeira ocorrência e no máximo 30 anos depois) ou sem término. O término configurado define o fim lógico da programação; ele não obriga a criar de imediato ocorrências fora da janela de geração.

#### Scenario: Após N ocorrências
- **GIVEN** hoje é 01/05/2026
- **WHEN** um membro cria a cobrança mensal temporária "Curso de inglês" de R$ 450,00 com 10 ocorrências a partir de 05/05/2026
- **THEN** a programação termina na 10ª ocorrência, prevista para 05/02/2027, e nenhuma ocorrência é gerada depois dela

#### Scenario: Até uma data, inclusive
- **WHEN** um membro cria uma receita semanal a partir de 01/06/2026 até 29/06/2026
- **THEN** são geradas as ocorrências de 01, 08, 15, 22 e 29/06/2026

### Requirement: Regras de datas das ocorrências
A data prevista original de cada ocorrência SHALL ser calculada pela sua posição na série a partir da primeira ocorrência: semanal soma 7 dias por posição; mensal mantém o dia do mês da primeira ocorrência; anual mantém dia e mês. Quando o dia não existir no mês (ex.: 31, ou 29/02 fora de ano bissexto), a ocorrência SHALL cair no último dia do mês, sem alterar o dia de referência das seguintes.

#### Scenario: Dia 31
- **GIVEN** uma recorrência mensal iniciada em 31/01/2026
- **WHEN** as ocorrências são geradas
- **THEN** as datas são 31/01, 28/02, 31/03, 30/04 e 31/05/2026

#### Scenario: Anual em 29/02
- **GIVEN** uma recorrência anual iniciada em 29/02/2028
- **WHEN** as ocorrências são geradas
- **THEN** as datas são 29/02/2028, 28/02/2029 e 28/02/2030

### Requirement: Identidade estável das ocorrências
Cada ocorrência SHALL ser identificada pela sua posição na série, independente da data prevista, que pode ser editada. O banco de dados MUST garantir no máximo um lançamento por posição de cada série, e a geração MUST permanecer correta com acessos simultâneos, sem depender apenas de uma consulta prévia.

#### Scenario: Data alterada não duplica
- **GIVEN** a ocorrência de maio de uma série mensal teve a data prevista alterada de 10/05 para 15/06/2026
- **WHEN** a janela de geração é expandida novamente
- **THEN** não é criada outra ocorrência para a posição de maio, e a ocorrência de junho continua existindo uma única vez

#### Scenario: Geração concorrente
- **WHEN** os dois membros abrem o aplicativo ao mesmo tempo com ocorrências a gerar
- **THEN** cada posição da série tem exatamente um lançamento

### Requirement: Janela de geração de 12 meses
O sistema SHALL materializar, para todas as séries (finitas ou não), as ocorrências cuja data prevista original seja menor ou igual à data de hoje acrescida de 12 meses de calendário, inclusive, no fuso America/Sao_Paulo, respeitando o término e as exceções da série. A geração SHALL ocorrer automaticamente quando o casal usa o aplicativo, sem tarefa agendada, e SHALL criar como pendentes apenas as posições ausentes. A expansão da janela MUST NOT alterar situação, valor ou qualquer campo de ocorrências já existentes.

#### Scenario: Série finita ultrapassa a janela
- **GIVEN** hoje é 01/05/2026
- **WHEN** um membro cria uma despesa mensal com 24 ocorrências a partir de 10/05/2026
- **THEN** existem apenas as ocorrências de 10/05/2026 a 10/04/2027 (12 ocorrências) e a consulta mostra 12 ainda previstas para geração

#### Scenario: Janela avança sem alterar existentes
- **GIVEN** uma série mensal sem término com ocorrências geradas até 10/03/2027, e a de 10/04/2026 efetivada por R$ 1.750,00
- **WHEN** um membro abre o aplicativo em 15/04/2026
- **THEN** a ocorrência de 10/04/2027 passa a existir como pendente e a de 10/04/2026 continua efetivada por R$ 1.750,00

#### Scenario: Retorno após meses sem acesso
- **GIVEN** uma série mensal sem término criada em 05/01/2026 e nenhum acesso entre 06/01/2026 e 20/09/2026
- **WHEN** um membro abre o aplicativo em 20/09/2026
- **THEN** todas as posições ausentes até 05/09/2027 passam a existir como pendentes, inclusive as já vencidas, sem recriar posições excluídas e usando a regra vigente de cada posição

### Requirement: Ocorrências são lançamentos comuns
Cada ocorrência SHALL ser um lançamento normal (pendente até ser marcado como pago, recebido ou realizado) e entrar em saldos, totais, previsões, calendário, vencimentos, orçamento, relatórios e exportação pelas mesmas regras dos demais lançamentos.

#### Scenario: Previsão do orçamento
- **GIVEN** uma assinatura mensal recorrente de R$ 55,90 em Assinaturas
- **WHEN** o orçamento do próximo mês é exibido
- **THEN** R$ 55,90 aparece como previsto em Assinaturas

### Requirement: Primeira ocorrência efetivada
Ao criar a recorrência, o membro PODE indicar que a primeira ocorrência "Já foi paga", "Já foi recebida" ou, para transferências, "Já foi realizada". Nesse caso, a data real de efetivação MUST ser informada separadamente da data prevista, MUST NOT ser futura e MUST respeitar a data de abertura das contas envolvidas; transferências seguem as mesmas regras de atomicidade das transferências comuns. As demais ocorrências SHALL ser criadas pendentes.

#### Scenario: Primeira paga em data diferente
- **GIVEN** hoje é 12/04/2026
- **WHEN** um membro cria uma despesa mensal prevista para 10/04/2026, marcando "Já foi paga" em 11/04/2026
- **THEN** a primeira ocorrência fica efetivada em 11/04/2026 com data prevista 10/04/2026 e as seguintes ficam pendentes

#### Scenario: Efetivação futura
- **GIVEN** hoje é 12/04/2026
- **WHEN** o membro informa efetivação em 13/04/2026 para a primeira ocorrência
- **THEN** a criação é recusada com "A data de pagamento não pode ser futura"

### Requirement: Posição na série
Ocorrências de séries com término após N ocorrências SHALL exibir "Ocorrência 3 de 12"; as demais SHALL exibir "Recorrente" com a frequência. A indicação MUST usar texto ou ícone com rótulo, não apenas cor.

#### Scenario: Posição exibida
- **GIVEN** a terceira ocorrência de uma série de 12 ocorrências
- **WHEN** o lançamento é exibido na lista ou no detalhe
- **THEN** aparece "Ocorrência 3 de 12"

### Requirement: Campos imutáveis da série
Tipo, frequência e data da primeira ocorrência MUST NOT ser alterados depois da criação. Para mudá-los, o aplicativo SHALL orientar a encerrar a recorrência e criar outra.

#### Scenario: Mudar frequência
- **WHEN** o membro edita uma ocorrência de uma série mensal
- **THEN** tipo e frequência aparecem somente para leitura, com a orientação "Para mudar, encerre esta recorrência e crie outra"

### Requirement: Editar em escopo
Ao editar uma ocorrência pendente, o membro SHALL escolher entre "Só este lançamento" e "Este e os próximos".
- "Só este lançamento" PODE ajustar qualquer campo válido da ocorrência, inclusive a data prevista, sem mudar sua posição; a ocorrência passa a ser personalizada.
- "Este e os próximos" usa a posição original da ocorrência como marco: altera a regra da série para essa posição e as seguintes (inclusive as ainda não geradas) e atualiza somente a ocorrência selecionada e as pendentes posteriores não personalizadas. Não altera datas.
- Ocorrências efetivadas e personalizadas MUST ser preservadas, e as posições anteriores ao marco MUST NOT mudar.
- Para uma ocorrência efetivada, somente "Só este lançamento" SHALL ser oferecido.

#### Scenario: Reajuste preservando exceções e efetivadas
- **GIVEN** um aluguel mensal de R$ 1.800,00 com abril efetivado, junho personalizado para R$ 1.700,00 e as demais pendentes
- **WHEN** o membro edita maio para R$ 1.950,00 com "Este e os próximos"
- **THEN** maio e as pendentes seguintes não personalizadas passam a R$ 1.950,00, junho continua R$ 1.700,00, abril continua R$ 1.800,00, e ocorrências geradas depois usam R$ 1.950,00

#### Scenario: Ocorrência efetivada
- **WHEN** o membro edita uma ocorrência já efetivada
- **THEN** a opção "Este e os próximos" não é oferecida

### Requirement: Excluir em escopo
Ao excluir uma ocorrência, o membro SHALL escolher o escopo.
- "Só este lançamento" exclui a ocorrência pendente e registra uma exceção persistente: a posição não volta a ser gerada.
- "Este e os próximos" encerra a programação antes da posição selecionada e remove as ocorrências pendentes a partir dela, inclusive as personalizadas. A confirmação MUST mostrar quantas ocorrências pendentes e qual valor serão removidos.
- Ocorrências efetivadas MUST ser preservadas.

#### Scenario: Ocorrência excluída não reaparece
- **GIVEN** a ocorrência de julho de uma série mensal foi excluída com "Só este lançamento"
- **WHEN** a janela de geração é expandida em acessos posteriores
- **THEN** julho não volta a existir e agosto continua existindo

#### Scenario: Cancelar a partir de uma posição
- **GIVEN** uma assinatura mensal com ocorrências efetivadas até março, abril pendente vencida e maio personalizado
- **WHEN** o membro exclui abril com "Este e os próximos"
- **THEN** a confirmação informa as ocorrências e o valor removidos, abril e as seguintes (inclusive maio) deixam de existir, as efetivadas permanecem e nenhuma nova é gerada

### Requirement: Encerrar recorrência
O membro SHALL poder encerrar a programação de uma recorrência em uma data (padrão: hoje). O encerramento SHALL remover as ocorrências pendentes da série com data prevista igual ou posterior à data de encerramento e MUST preservar as pendentes anteriores (inclusive vencidas) e as efetivadas. Nenhuma posição posterior ao encerramento SHALL ser gerada, inclusive posições com exceção individual.

#### Scenario: Encerramento preservando pendências vencidas
- **GIVEN** hoje é 20/05/2026 e uma série mensal tem a ocorrência de 10/05/2026 pendente vencida
- **WHEN** o membro encerra a recorrência hoje
- **THEN** a de 10/05/2026 continua pendente, as de 10/06/2026 em diante são removidas e a programação fica encerrada

### Requirement: Consulta de recorrências
O aplicativo SHALL listar as recorrências do casal com descrição, valor vigente, frequência e término, e mostrar separadamente:
- a situação da programação (ativa ou encerrada);
- as ocorrências pendentes já geradas (quantidade e valor);
- para término após N ocorrências, quantas ainda estão previstas para geração.

Esses números MUST considerar exclusões e encerramentos e MUST NOT ser obtidos apenas subtraindo efetivadas do total. Ocorrências excluídas MUST NOT aparecer como valores devidos. A consulta SHALL oferecer encerrar a recorrência e ver seus lançamentos.

#### Scenario: Série encerrada com pagamentos pendentes
- **GIVEN** uma série de 10 ocorrências com programação encerrada após a 6ª, sendo 4 efetivadas, 1 excluída e 1 pendente vencida
- **WHEN** o membro abre Recorrências
- **THEN** a série aparece com programação encerrada, 1 ocorrência pendente gerada com seu valor e nenhuma prevista para geração

#### Scenario: Restantes considerando exclusão
- **GIVEN** hoje é 01/05/2026 e uma série de 12 ocorrências iniciada em 10/01/2026, com 4 efetivadas, a 5ª excluída e as demais pendentes geradas
- **WHEN** o membro abre Recorrências
- **THEN** aparecem 7 pendentes geradas e 0 previstas para geração, sem contar a excluída

### Requirement: Recorrências com contas de benefício
Recorrências de receita e despesa SHALL aceitar contas de benefício, com as mesmas regras de geração, edição e exclusão. Recorrências de transferência MUST NOT usar contas de benefício, nem na criação nem em edições "Este e os próximos".

#### Scenario: Crédito mensal do vale-alimentação
- **WHEN** um membro cria uma receita mensal sem término de R$ 800,00 no vale-alimentação, categoria Outras receitas
- **THEN** as ocorrências são geradas como pendentes nessa conta e, quando efetivadas, contam como créditos de benefício

#### Scenario: Transferência recorrente com benefício
- **WHEN** alguém cria uma transferência recorrente com destino no vale-alimentação
- **THEN** a criação é recusada com "Contas de benefício não permitem transferência ou saque"
