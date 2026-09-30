# Spec Delta

## Purpose

Permite ao administrador da plataforma cadastrar e gerenciar casais de teste sem alterar código e sem acessar as finanças desses casais.

## ADDED Requirements

### Requirement: Acesso restrito ao administrador
O painel administrativo e suas operações SHALL estar disponíveis apenas a usuários com a condição de administrador da plataforma. Demais usuários MUST receber "página não encontrada".

#### Scenario: Membro comum abre o painel
- **WHEN** um usuário que não é administrador abre `/admin`
- **THEN** recebe a página de não encontrado

### Requirement: Painel sem dados financeiros
O painel SHALL exibir apenas nome e situação do casal, nome, email e situação da senha dos participantes, e datas de cadastro. A condição de administrador MUST NOT conceder acesso a categorias, contas, lançamentos, orçamentos ou relatórios de outros casais.

#### Scenario: Administrador sem vínculo
- **GIVEN** o administrador participa do casal A
- **WHEN** ele tenta acessar dados financeiros do casal B por qualquer rota
- **THEN** o acesso é negado como a qualquer membro do casal A

### Requirement: Cadastro de casal
O administrador SHALL poder cadastrar um casal informando o nome e um ou dois participantes (nome, email e senha temporária de pelo menos 10 caracteres). Pode optar por participar ele mesmo do novo casal no lugar de um participante, se ainda não participa de outro. Os participantes criados MUST ser obrigados a trocar a senha no primeiro acesso. A operação SHALL ser atômica.

#### Scenario: Casal com dois participantes
- **WHEN** o administrador cadastra "Casal Teste" com Carla e Davi e senhas temporárias
- **THEN** o casal é criado ativo, com os dois vínculos, e ambos precisam trocar a senha ao entrar

#### Scenario: Email duplicado
- **GIVEN** já existe um usuário com o email `carla@exemplo.com`
- **WHEN** o administrador cadastra um casal usando esse email
- **THEN** nada é criado e o erro indica o email duplicado

### Requirement: Adicionar segundo participante
O administrador SHALL poder adicionar um participante a um casal que tenha apenas um membro ativo.

#### Scenario: Adicionar a esposa ao casal do administrador
- **GIVEN** o casal do administrador com um único membro
- **WHEN** o administrador adiciona Bia com senha temporária
- **THEN** Bia passa a ver as mesmas finanças do casal após trocar a senha

### Requirement: Ativar e desativar casal
O administrador SHALL poder desativar e reativar um casal. Ao desativar, todas as sessões dos participantes MUST ser revogadas e novos logins MUST ser recusados. Os dados do casal são preservados.

#### Scenario: Desativação
- **GIVEN** Carla autenticada no casal "Casal Teste"
- **WHEN** o administrador desativa o casal
- **THEN** a próxima requisição de Carla exige login e o login é recusado com "Acesso desativado. Fale com o administrador."

### Requirement: Redefinir senha temporária
O administrador SHALL poder definir uma nova senha temporária para um participante, o que MUST revogar as sessões desse participante e exigir troca no próximo acesso. Este é o procedimento de recuperação de senha do MVP.

#### Scenario: Recuperação manual
- **GIVEN** Davi esqueceu a senha
- **WHEN** o administrador define uma senha temporária para Davi
- **THEN** Davi entra com a senha temporária e é levado a definir uma nova senha
