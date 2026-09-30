# platform-bootstrap Specification

## Purpose
Cria o primeiro administrador da plataforma de forma segura e repetível, sem credenciais embutidas no código e sem sobrescrever dados existentes.

## Requirements

### Requirement: Bootstrap do administrador por comando
O sistema SHALL fornecer um comando documentado que cria o administrador da plataforma a partir de variáveis de ambiente (`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_PASSWORD`). O código MUST NOT conter senha padrão. A senha MUST ter pelo menos 12 caracteres.

#### Scenario: Primeira execução
- **GIVEN** um banco sem administrador e as variáveis definidas
- **WHEN** o comando de bootstrap é executado
- **THEN** o usuário é criado com a condição de administrador e com troca de senha obrigatória no primeiro acesso

#### Scenario: Variáveis ausentes
- **WHEN** o comando é executado sem `BOOTSTRAP_ADMIN_PASSWORD`
- **THEN** ele termina com erro explicativo e não cria nada

### Requirement: Bootstrap idempotente
Executar o bootstrap novamente MUST NOT alterar a senha, o nome ou os dados de um usuário existente com o mesmo email; apenas garante a condição de administrador.

#### Scenario: Reexecução
- **GIVEN** o administrador já existe e já trocou a senha
- **WHEN** o bootstrap é executado de novo com outra senha no ambiente
- **THEN** a senha atual continua válida e nenhum dado é sobrescrito

### Requirement: Casal do administrador no bootstrap
Quando `BOOTSTRAP_HOUSEHOLD_NAME` estiver definido, o bootstrap SHALL criar um casal ativo com esse nome e vincular o administrador como membro, caso ele ainda não participe de um casal. Reexecuções MUST NOT criar casais duplicados nem alterar o casal existente.

#### Scenario: Bootstrap com casal
- **GIVEN** `BOOTSTRAP_HOUSEHOLD_NAME=Casa Silva` e nenhum administrador
- **WHEN** o bootstrap é executado duas vezes
- **THEN** existe exatamente um casal "Casa Silva" com o administrador como único membro

### Requirement: Dados de demonstração separados
O sistema SHALL oferecer um comando opcional que cria um casal de demonstração com usuários e lançamentos fictícios, separado do bootstrap. O comando MUST recusar execução quando `NODE_ENV=production` ou sem a confirmação explícita `DEMO_SEED=1`, e MUST NOT alterar casais, usuários ou senhas existentes.

#### Scenario: Produção
- **GIVEN** `NODE_ENV=production`
- **WHEN** o seed de demonstração é executado
- **THEN** ele termina com erro e não grava nada

#### Scenario: Reexecução
- **GIVEN** o casal de demonstração já existe
- **WHEN** o seed é executado novamente
- **THEN** nada é duplicado nem sobrescrito
