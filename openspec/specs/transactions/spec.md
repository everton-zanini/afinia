# transactions Specification

## Purpose
Lançamentos registram receitas, despesas e transferências do casal, com regras monetárias exatas, autoria e situação (pendente ou efetivado).

## Requirements

### Requirement: Tipos de lançamento e campos
O sistema SHALL suportar receita, despesa e transferência. Receita e despesa MUST ter descrição, valor, categoria do mesmo tipo (principal ou subcategoria), conta, data prevista e situação. Transferência MUST ter descrição, valor, conta de origem, conta de destino diferente da origem, data prevista e situação, e MUST NOT ter categoria. Todos podem ter pessoa responsável (membro do casal) e observação.

#### Scenario: Categoria de tipo diferente
- **WHEN** alguém registra uma despesa com a categoria de receita "Salários"
- **THEN** a operação é recusada

#### Scenario: Transferência para a mesma conta
- **WHEN** alguém registra uma transferência com origem e destino iguais
- **THEN** a operação é recusada com "Escolha contas diferentes"

### Requirement: Referências do mesmo casal
Categoria, contas e pessoa responsável de um lançamento MUST pertencer ao casal da sessão. Referências de outro casal SHALL ser recusadas como "Registro não encontrado".

#### Scenario: Conta de outro casal
- **GIVEN** a conta "Poupança" do casal B
- **WHEN** um membro do casal A registra uma despesa nessa conta
- **THEN** a operação é recusada e nenhum lançamento é criado

### Requirement: Valores monetários exatos
Valores SHALL ser armazenados e calculados em centavos inteiros, sem ponto flutuante. Valores de lançamento MUST ser positivos e no máximo R$ 10.000.000,00; o tipo define o efeito. A entrada aceita o formato brasileiro (ex.: "1.234,56").

#### Scenario: Soma sem erro de arredondamento
- **GIVEN** três despesas efetivadas de R$ 0,10, R$ 0,20 e R$ 0,30
- **WHEN** o total do mês é calculado
- **THEN** o total é exatamente R$ 0,60

#### Scenario: Valor zero ou negativo
- **WHEN** alguém informa valor R$ 0,00 ou "-5"
- **THEN** a operação é recusada com "Informe um valor maior que zero"

### Requirement: Datas de calendário
Datas previstas e de efetivação SHALL ser datas de calendário (dia/mês/ano) sem hora, que não mudam com o fuso. O padrão de "hoje" SHALL ser calculado no fuso America/Sao_Paulo.

#### Scenario: Lançamento no fim do dia
- **GIVEN** são 23h30 de 31/03/2026 em São Paulo (02h30 de 01/04 em UTC)
- **WHEN** um membro abre um novo lançamento
- **THEN** a data sugerida é 31/03/2026 e o lançamento é contado em março

### Requirement: Situação e efetivação
Um lançamento pendente MUST NOT ter data de efetivação; um efetivado MUST ter. O membro SHALL poder marcar um pendente como pago/recebido (data padrão: hoje) e voltar um efetivado para pendente.

#### Scenario: Marcar como pago
- **GIVEN** uma despesa pendente com vencimento 10/04/2026
- **WHEN** um membro a marca como paga em 09/04/2026
- **THEN** ela passa a efetivada com data de efetivação 09/04/2026 e altera o saldo realizado da conta

### Requirement: Regras de agrupamento
Receitas e despesas realizadas SHALL ser agrupadas pela data de efetivação. Pendências SHALL ser agrupadas pela data prevista. Transferências alteram os saldos das contas envolvidas e MUST NOT entrar em totais de receita, despesa ou orçamento.

#### Scenario: Pago em mês diferente do vencimento
- **GIVEN** uma despesa com vencimento 31/03/2026 paga em 02/04/2026
- **WHEN** as despesas realizadas são totalizadas por mês
- **THEN** ela conta em abril, não em março

#### Scenario: Transferência não é despesa
- **GIVEN** uma transferência efetivada de R$ 500,00 da conta corrente para a reserva
- **WHEN** os totais do mês são calculados
- **THEN** receitas e despesas não mudam, a conta corrente diminui R$ 500,00 e a reserva aumenta R$ 500,00

### Requirement: Transferência atômica e consistente
Uma transferência SHALL ser um único registro que afeta origem e destino em conjunto. Edição e exclusão MUST atualizar as duas contas de forma consistente.

#### Scenario: Excluir transferência
- **GIVEN** uma transferência efetivada de R$ 200,00 entre duas contas
- **WHEN** ela é excluída
- **THEN** os saldos das duas contas voltam aos valores anteriores

### Requirement: Autoria e responsável
O sistema SHALL registrar automaticamente, a partir da sessão, quem cadastrou o lançamento e quando; a pessoa responsável é opcional e distinta de quem cadastrou.

#### Scenario: Autor não é informado pelo navegador
- **WHEN** a requisição de criação envia um campo de autor com outro usuário
- **THEN** o lançamento registra como autor o usuário da sessão

### Requirement: Operações sobre lançamentos
Os membros SHALL poder consultar, editar, excluir (com confirmação), duplicar (abrindo um novo lançamento pré-preenchido com a data de hoje e situação pendente) e marcar como pago/recebido. Edições e exclusões MUST refletir imediatamente nos saldos.

#### Scenario: Editar valor
- **GIVEN** uma despesa efetivada de R$ 100,00 na conta com saldo R$ 900,00
- **WHEN** o valor é alterado para R$ 150,00
- **THEN** o saldo da conta passa a R$ 850,00

### Requirement: Proteção contra duplicação
Cada envio do formulário SHALL carregar uma chave única gerada ao abrir o formulário. Reenvios com a mesma chave MUST NOT criar lançamentos adicionais.

#### Scenario: Duplo toque
- **WHEN** o botão Salvar é acionado duas vezes rapidamente
- **THEN** apenas um lançamento é criado

### Requirement: Busca, filtros e exportação
A lista de lançamentos SHALL permitir busca por descrição e filtros por período, categoria (incluindo suas subcategorias), conta (origem ou destino), situação e pessoa responsável. O período usa a data de efetivação para efetivados e a data prevista para pendentes. A exportação CSV SHALL conter exatamente os lançamentos do filtro aplicado, somente do casal da sessão, e MUST neutralizar conteúdo que planilhas interpretariam como fórmula.

#### Scenario: Exportar filtro
- **GIVEN** 10 lançamentos em abril, 3 deles na categoria Alimentação
- **WHEN** o membro filtra abril + Alimentação e exporta
- **THEN** o CSV contém exatamente os 3 lançamentos e nenhum de outro casal

#### Scenario: Descrição com fórmula
- **GIVEN** um lançamento com descrição "=HYPERLINK(...)"
- **WHEN** ele é exportado
- **THEN** a célula é exportada como texto, sem ser interpretada como fórmula

### Requirement: Visão em calendário
A lista de lançamentos SHALL permitir alternar entre lista cronológica e calendário mensal. O calendário SHALL mostrar, por dia, o total realizado de entradas e saídas e a existência de pendências (com texto/ícone, não só cor), usando a data de referência de cada lançamento. Tocar em um dia SHALL abrir a lista daquele dia.

#### Scenario: Dia com pendência
- **GIVEN** uma despesa pendente com vencimento em 28/03/2026
- **WHEN** o calendário de março é exibido
- **THEN** o dia 28 indica pendência e, ao tocar, lista essa despesa

### Requirement: Vínculo com recorrência
Um lançamento PODE pertencer a uma recorrência do mesmo casal, com uma posição fixa na série e a indicação de personalização individual. Vínculo, posição e personalização MUST ser definidos apenas pelo servidor e MUST NOT ser aceitos de dados enviados pelo navegador. Duplicar um lançamento recorrente SHALL criar um lançamento avulso, sem vínculo com a série.

#### Scenario: Duplicar ocorrência
- **GIVEN** a ocorrência 3 de 12 de uma recorrência
- **WHEN** o membro usa "Duplicar"
- **THEN** o novo lançamento é avulso e não altera as ocorrências nem as contagens da série

#### Scenario: Vínculo forjado
- **WHEN** uma requisição de criação ou edição de lançamento envia identificador de recorrência, posição ou personalização
- **THEN** esses valores são ignorados e o vínculo existente (ou a ausência dele) é mantido

### Requirement: Benefícios não participam de transferências
Transferências MUST NOT ter conta de benefício como origem ou destino, inclusive quando editadas. O formulário de transferência MUST NOT oferecer contas de benefício. Receitas e despesas PODEM usar contas de benefício normalmente.

#### Scenario: Transferir a partir do benefício
- **GIVEN** o vale-alimentação do casal
- **WHEN** alguém tenta registrar uma transferência do vale-alimentação para a conta corrente
- **THEN** a operação é recusada com "Contas de benefício não permitem transferência ou saque"

#### Scenario: Opções do formulário
- **WHEN** o membro escolhe "Transferir" no novo lançamento
- **THEN** as contas de benefício não aparecem como origem nem como destino

### Requirement: Créditos de benefício
Receitas efetivadas em contas de benefício SHALL ser identificadas como créditos de benefício e apresentadas separadamente das receitas em dinheiro (contas bancárias, dinheiro e reservas). O total de receitas e o resultado do mês continuam incluindo os dois.

#### Scenario: Crédito do empregador
- **GIVEN** salário efetivado de R$ 5.000,00 na conta corrente e crédito efetivado de R$ 800,00 no vale-alimentação no mesmo mês
- **WHEN** os totais do mês são calculados
- **THEN** receitas em dinheiro são R$ 5.000,00, créditos de benefício R$ 800,00 e receitas totais R$ 5.800,00

### Requirement: Lançamento de pagamento de fatura
O sistema SHALL ter o tipo de lançamento "pagamento de fatura", criado somente pelo pagamento de uma fatura: efetivado, vinculado à fatura, com conta de origem e sem categoria. Ele reduz o saldo da conta de origem na data do pagamento, aparece nas listas e no fluxo de caixa como "Pagamento de fatura" e MUST NOT entrar em receitas, despesas por categoria ou orçamento. Esse lançamento MUST NOT ser editado, duplicado, marcado como pendente ou excluído pelas operações comuns; só pode ser desfeito pelo fluxo de desfazer pagamento da fatura.

#### Scenario: Pagamento na lista de lançamentos
- **GIVEN** pagamento de R$ 500,00 da fatura do "Cartão roxo" pela conta corrente em 15/03/2026
- **WHEN** a lista de lançamentos de março é exibida
- **THEN** aparece "Pagamento de fatura · Cartão roxo" de −R$ 500,00 na conta corrente, sem categoria, com acesso à fatura

#### Scenario: Operação comum sobre pagamento
- **WHEN** alguém tenta editar ou duplicar esse lançamento pelas telas de lançamento
- **THEN** a operação não é oferecida e, se chamada, é recusada
