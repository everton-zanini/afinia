# households Specification

## Purpose
Define o casal (household) como unidade isolada de dados financeiros, compartilhada por até dois membros com a mesma visão das finanças.

## Requirements

### Requirement: Vínculo explícito de membros
Cada usuário SHALL pertencer a no máximo um casal. Cada casal SHALL ter no máximo dois membros ativos. A tentativa de vincular um terceiro membro ativo MUST ser recusada sem alterar dados.

#### Scenario: Terceiro membro
- **GIVEN** um casal com dois membros ativos
- **WHEN** o administrador tenta adicionar outro participante
- **THEN** a operação é recusada com a mensagem "Este casal já tem dois participantes"

#### Scenario: Usuário já vinculado
- **GIVEN** um usuário que já participa do casal A
- **WHEN** alguém tenta vinculá-lo ao casal B
- **THEN** a operação é recusada

### Requirement: Contexto de casal derivado da sessão
O casal autorizado em qualquer leitura, alteração, exclusão, agregação ou exportação SHALL ser derivado exclusivamente da sessão do usuário e do seu vínculo ativo. Identificadores de casal enviados pelo navegador MUST ser ignorados.

#### Scenario: householdId forjado
- **GIVEN** a usuária Ana, membro do casal A
- **WHEN** uma requisição de Ana inclui o identificador do casal B
- **THEN** a operação atua somente sobre o casal A

#### Scenario: Usuário sem casal
- **GIVEN** um administrador autenticado que não participa de nenhum casal
- **WHEN** ele abre o Início
- **THEN** vê uma mensagem explicando que ainda não participa de um casal, sem dados financeiros

### Requirement: Isolamento entre casais
Registros de um casal MUST NOT ser lidos, alterados, excluídos, agregados ou exportados por membros de outro casal. Um registro de outro casal SHALL ser tratado como inexistente, com a mesma resposta dada a um identificador que não existe.

#### Scenario: Acesso por identificador de outro casal
- **GIVEN** um registro pertencente ao casal B
- **WHEN** um membro do casal A solicita esse registro pelo identificador
- **THEN** o sistema responde "Registro não encontrado", sem revelar que o registro existe

### Requirement: Mesma visão para os dois membros
Os dois membros ativos de um casal SHALL ver os mesmos dados financeiros do casal.

#### Scenario: Registro criado por um membro
- **GIVEN** Ana e Beto, membros do mesmo casal
- **WHEN** Ana cria um registro financeiro
- **THEN** Beto também o vê, identificado como criado por Ana

### Requirement: Casal criado com categorias sugeridas
A criação de um casal (pelo administrador ou pelo bootstrap) SHALL incluir, na mesma operação atômica, as categorias sugeridas do plano de contas.

#### Scenario: Bootstrap do casal do administrador
- **WHEN** o bootstrap cria o casal do administrador
- **THEN** o casal já possui as categorias sugeridas
