# Design

## Context

A change `foundation-auth` entregou usuários, sessões, bootstrap e o shell. Ainda não existem dados financeiros; esta change cria o tenant e o mecanismo de autorização que todas as consultas financeiras usarão.

## Goals / Non-Goals

**Goals:**
- Modelo explícito de vínculo, com a regra "≤ 2 membros ativos" num único lugar.
- Um único ponto de derivação do contexto de casal (`requireHousehold`).
- Painel administrativo mínimo e seguro.

**Non-Goals:**
- Finanças privadas por membro, convites por email, remoção de membros, múltiplos casais por usuário.

## Decisions

- **Modelo**:
  - `Household(id cuid, name, active, createdAt, updatedAt)`.
  - `HouseholdMember(id cuid, householdId, userId @unique, active, createdAt)` — `userId` único garante "um casal por usuário". Índice `(householdId, active)`.
  - IDs `cuid` (não sequenciais, não previsíveis).
- **Limite de dois membros**: `addMember(tx, householdId, userId)` em `src/server/households/members.ts` bloqueia a linha do casal (`SELECT … FOR UPDATE`) e conta membros ativos antes de inserir. É a única função que cria vínculos; o limite `MAX_ACTIVE_MEMBERS = 2` vive só ali.
- **Contexto**: `getHouseholdContext(userId)` (puro/testável) retorna `{ householdId, memberId, members }` apenas se vínculo e casal estiverem ativos. `requireHousehold()` (páginas/ações) = `requireUser()` + contexto; sem contexto → página "sem casal". Todos os serviços financeiros recebem `HouseholdContext` como primeiro argumento e filtram por `ctx.householdId` em toda consulta; nunca recebem `householdId` de formulário.
- **Não encontrado uniforme**: serviços lançam `NotFoundError("Registro não encontrado")` tanto para ID inexistente quanto de outro casal (busca sempre com `where: { id, householdId }`).
- **Login**: `assertLoginAllowed` (hook `session.create.before`) exige `isPlatformAdmin` ou vínculo ativo em casal ativo.
- **Desativação**: transação que marca `active=false` e apaga as sessões dos membros. Como o cookie cache do Better Auth está desabilitado, a revogação é imediata.
- **Admin**: `requireAdmin()` → `notFound()` para não administradores. Rotas `/admin`, `/admin/casais/novo`, `/admin/casais/[id]`. Consultas do painel usam `select` explícito com campos de gestão apenas. Senhas temporárias: mínimo 10 caracteres, digitadas pelo admin ou geradas no navegador (`crypto.getRandomValues`), exibidas uma única vez no formulário.
- **Cache**: todas as páginas autenticadas são dinâmicas (dependem de `headers()`); nenhuma resposta autenticada é cacheada entre usuários.

## Risks / Trade-offs

- `FOR UPDATE` requer transação interativa do Prisma → aceitável (baixa concorrência).
- Admin vê emails dos participantes de teste → necessário para gestão; documentado.
