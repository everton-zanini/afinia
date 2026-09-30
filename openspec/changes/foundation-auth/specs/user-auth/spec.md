# Spec Delta

## Purpose

Garante que cada pessoa acesse o Afinia com credenciais individuais, sessões seguras e controle sobre seu perfil e senha, sem cadastro público.

## ADDED Requirements

### Requirement: Login com email e senha
O sistema SHALL autenticar usuários existentes por email e senha e criar uma sessão em cookie HttpOnly, `SameSite=Lax` e `Secure` em produção. Mensagens de falha SHALL ser genéricas, sem revelar se o email existe.

#### Scenario: Credenciais válidas
- **GIVEN** um usuário ativo com email `ana@exemplo.com` e senha conhecida
- **WHEN** ele envia email e senha corretos na tela de login
- **THEN** uma sessão é criada e ele é redirecionado para o Início

#### Scenario: Credenciais inválidas
- **GIVEN** um usuário existente
- **WHEN** alguém envia a senha errada ou um email inexistente
- **THEN** o sistema responde "Email ou senha inválidos" nos dois casos e não cria sessão

### Requirement: Sem cadastro público
O sistema SHALL recusar qualquer tentativa de criação de conta por usuários não autenticados, pela interface ou pela API.

#### Scenario: Tentativa de cadastro pela API
- **WHEN** uma requisição anônima chama o endpoint de cadastro por email
- **THEN** o sistema recusa a requisição e nenhum usuário é criado

### Requirement: Limitação de tentativas de login
O sistema SHALL limitar tentativas de login falhas por email usando armazenamento persistente compartilhado entre instâncias serverless. Após 5 falhas em 15 minutos para o mesmo email, novas tentativas SHALL ser recusadas até o fim da janela, mesmo com a senha correta.

#### Scenario: Bloqueio após falhas repetidas
- **GIVEN** 5 tentativas falhas para `ana@exemplo.com` nos últimos 15 minutos
- **WHEN** uma sexta tentativa é feita com a senha correta
- **THEN** o login é recusado com a mensagem "Muitas tentativas. Tente novamente em alguns minutos."

#### Scenario: Sucesso zera o contador
- **GIVEN** 2 tentativas falhas recentes
- **WHEN** o usuário entra com a senha correta
- **THEN** o contador de falhas daquele email é zerado

### Requirement: Logout
O sistema SHALL encerrar a sessão atual quando o usuário escolher "Sair", invalidando-a no servidor.

#### Scenario: Sair
- **GIVEN** um usuário autenticado
- **WHEN** ele toca em "Sair"
- **THEN** a sessão é removida do banco e ele volta para a tela de login

### Requirement: Alteração de nome e email
O usuário autenticado SHALL poder alterar seu nome e seu email. A alteração de email MUST exigir a senha atual e MUST recusar um email já usado por outra pessoa.

#### Scenario: Alterar nome
- **WHEN** o usuário salva um novo nome não vazio
- **THEN** o novo nome aparece no perfil e na autoria de novos registros

#### Scenario: Email já utilizado
- **GIVEN** outro usuário com o email `bia@exemplo.com`
- **WHEN** o usuário tenta mudar seu email para `bia@exemplo.com`
- **THEN** a alteração é recusada e o email atual é mantido

### Requirement: Alteração de senha
O usuário autenticado SHALL poder alterar a senha informando a senha atual e a nova senha (mínimo de 8 caracteres) com confirmação. Após a alteração, todas as outras sessões do usuário MUST ser revogadas.

#### Scenario: Senha atual incorreta
- **WHEN** o usuário informa a senha atual errada
- **THEN** a senha não é alterada e uma mensagem de erro é exibida

#### Scenario: Revogação de sessões
- **GIVEN** o usuário autenticado em dois dispositivos
- **WHEN** ele altera a senha no dispositivo A
- **THEN** a sessão do dispositivo B deixa de ser válida e o dispositivo A continua autenticado

### Requirement: Troca obrigatória de senha temporária
Usuários marcados com senha temporária SHALL ser redirecionados para a tela de troca de senha em qualquer página protegida até definirem uma nova senha diferente da temporária.

#### Scenario: Primeiro acesso
- **GIVEN** um usuário criado com senha temporária
- **WHEN** ele faz login e tenta abrir o Início
- **THEN** é redirecionado para "Definir nova senha"
- **AND** após salvar a nova senha, o redirecionamento deixa de ocorrer

### Requirement: Proteção de rotas e operações
Todas as páginas e operações do aplicativo, exceto login, página offline e recursos públicos estáticos, MUST exigir sessão válida verificada no servidor.

#### Scenario: Acesso anônimo
- **WHEN** um visitante sem sessão abre `/inicio`
- **THEN** é redirecionado para `/login`

#### Scenario: Operação sem sessão
- **WHEN** uma operação de servidor é chamada sem sessão válida
- **THEN** a operação é recusada sem alterar dados
