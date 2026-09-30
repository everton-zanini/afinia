# Proposal

## Why

O Afinia é usado por casais: cada casal precisa de um espaço financeiro próprio, compartilhado pelos dois membros e totalmente isolado dos demais. Além do casal do administrador, outros casais de teste precisam ser cadastrados sem alterar código.

## What Changes

- Modelo de casal (household) como tenant e vínculo explícito usuário ↔ casal (um casal por usuário, até dois membros ativos).
- Contexto de casal derivado sempre da sessão no servidor; nenhuma operação aceita identificador de casal vindo do navegador.
- Painel administrativo (`/admin`) para: cadastrar casal com um ou dois participantes e senhas temporárias, adicionar o segundo participante, ativar/desativar o casal, redefinir senha temporária de um participante. O administrador pode participar do próprio casal.
- Casal desativado: participantes não conseguem entrar e sessões existentes são revogadas.
- Bootstrap estendido: cria opcionalmente o casal do administrador.
- Procedimento documentado de recuperação manual de senha pelo administrador (sem serviço de email).

## Capabilities

### New Capabilities
- `households`: casal como tenant, vínculo de membros, limite de dois membros ativos, derivação do contexto pela sessão e regras gerais de isolamento.
- `platform-admin`: painel administrativo de casais de teste, com acesso restrito a dados de gestão.

### Modified Capabilities
- `user-auth`: login passa a ser recusado para participantes de casal desativado ou usuários sem vínculo ativo (exceto administrador).
- `platform-bootstrap`: bootstrap pode criar o casal do administrador.

## Impact

- Novas tabelas `household` e `household_member`; migration nova.
- Novos módulos de servidor: contexto de casal, serviço de administração; páginas `/admin`.
- A camada de dados financeira (change seguinte) passa a depender do contexto de casal.
