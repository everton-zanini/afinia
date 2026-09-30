# Tasks

## 1. Modelo

- [x] 1.1 Adicionar `Household` e `HouseholdMember` ao schema e gerar migration; verificar `prisma migrate dev` e `migrate deploy` no banco de teste

## 2. Vínculo e contexto

- [x] 2.1 Implementar `addMember` com limite de 2 membros ativos e bloqueio de linha; verificar por teste de integração (terceiro membro e usuário já vinculado recusados)
- [x] 2.2 Implementar `getHouseholdContext`/`requireHousehold` e página "sem casal"; verificar por teste de integração que casal inativo/vínculo inativo não gera contexto
- [x] 2.3 Estender `assertLoginAllowed` (admin ou vínculo ativo em casal ativo); verificar por teste de integração de login

## 3. Administração

- [x] 3.1 Implementar serviço admin: criar casal (1–2 participantes, opção de incluir o próprio admin), adicionar participante, ativar/desativar (revogando sessões), redefinir senha temporária; verificar por testes de integração
- [x] 3.2 Implementar `requireAdmin` e páginas `/admin` (lista), `/admin/casais/novo`, `/admin/casais/[id]` com campos de gestão apenas; verificar por E2E (admin cria casal; membro comum recebe não encontrado)
- [x] 3.3 Exibir item "Administração" em Mais somente para administradores; verificar no E2E

## 4. Bootstrap

- [x] 4.1 Estender bootstrap com `BOOTSTRAP_HOUSEHOLD_NAME` idempotente; verificar por teste de integração

## 5. Validação

- [x] 5.1 Executar `openspec validate households-isolation --strict`, typecheck, lint, testes e build
