# Spec Delta

## Purpose

Cria o primeiro administrador da plataforma de forma segura e repetível, sem credenciais embutidas no código e sem sobrescrever dados existentes.

## ADDED Requirements

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
