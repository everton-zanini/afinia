# Design

## Context

Repositório greenfield com OpenSpec inicializado. Máquina de desenvolvimento Windows, Node 20.19, Docker Desktop disponível (nem sempre em execução). Produção alvo: Vercel (funções serverless) + PostgreSQL gerenciado.

## Goals / Non-Goals

**Goals:**
- Base Next.js pronta para as próximas changes, com lint, tipos, testes unitários, integração e E2E.
- Autenticação por email/senha segura e compatível com serverless.
- Bootstrap do administrador sem segredo no código.

**Non-Goals:**
- Casais, finanças, painel admin (changes seguintes).
- Recuperação de senha por email (não há serviço de email; recuperação manual pelo admin na change 2).

## Decisions

- **Versões**: Next.js 16 (App Router, Turbopack), React 19, Prisma 7.10 (a tag `latest` no npm é um RC da 8 — evitado), Better Auth 1.7, Tailwind 4, shadcn/ui, Zod 4, Vitest, Playwright. Lockfile `package-lock.json`.
- **Banco**: PostgreSQL 17 no Docker (`compose.yaml`, volume nomeado `afinia-pgdata`, healthcheck `pg_isready`, porta publicada só em `127.0.0.1:${POSTGRES_PORT:-5432}`). Um script de init cria `afinia_test` ao lado de `afinia_dev`. Produção: Neon/Prisma Postgres na mesma versão principal.
- **Prisma 7**: client gerado em `src/generated/prisma`, driver adapter `@prisma/adapter-pg` com `DATABASE_URL`. Em produção usa-se a URL *pooled* do provedor em `DATABASE_URL` e a URL direta em `DIRECT_URL` para `prisma migrate deploy` (configurado em `prisma.config.ts`). Singleton do client em `globalThis` para evitar múltiplas conexões no hot reload.
- **Better Auth**: adapter Prisma; `emailAndPassword.enabled`, `disableSignUp: true`, `minPasswordLength: 8`; hash scrypt padrão da biblioteca; plugin `nextCookies` para Server Actions; cookies `Secure` em produção. Campos adicionais do usuário (`isPlatformAdmin`, `mustChangePassword`) com `input: false`. Criação de usuários por scripts/admin usa `auth.$context` (hash da biblioteca + criação de `user` e `account` credential) — não depende do endpoint público de cadastro.
- **Limitação de tentativas**: tabela própria `LoginThrottle(key=email normalizado, failures, windowStart, lockedUntil)`. Aplicada em `hooks.before`/`hooks.after` do Better Auth no caminho `/sign-in/email`, cobrindo tanto a Server Action quanto chamadas diretas à API. Adicionalmente o rate limit nativo por IP do Better Auth fica ativo com `storage: "database"`. Ambos persistem no Postgres, logo funcionam entre instâncias serverless.
- **Troca de email**: Server Action própria que verifica a senha atual (via `auth.$context.password.verify`) e unicidade, pois não há serviço de verificação por email no MVP.
- **Troca de senha**: `auth.api.changePassword({ revokeOtherSessions: true })`; na troca obrigatória também zera `mustChangePassword` e recusa nova senha igual à atual.
- **Proteção**: `proxy.ts` (middleware do Next 16) faz apenas redirecionamento otimista por presença de cookie; a verificação real acontece em `requireUser()` no servidor (layouts protegidos e todas as Server Actions). `mustChangePassword` é verificado em `requireUser()`.
- **Datas/Moeda/Idioma**: `lang="pt-BR"`; utilitários de data/moeda chegam na change 3.
- **UI**: tokens de cor em CSS (primária verde-petróleo `#0F6B6B` aprox., fundo claro quente), fonte Inter via `next/font`. Layout `(app)` com `BottomNav` e FAB "Novo lançamento" (abre a rota de novo lançamento; na change 3 vira bottom sheet funcional — até lá o botão leva a uma página que informa que a funcionalidade chega na próxima etapa **somente durante o desenvolvimento**, não no MVP final).
- **Testes**: Vitest com dois projetos (`unit` sem banco; `integration` com `DATABASE_URL_TEST`, recusando executar se o nome do banco não terminar em `_test`). Playwright sobe `next dev` apontando para o banco de teste.

## Risks / Trade-offs

- Prisma 7 + driver adapter é recente → mitigado fixando versões e cobrindo com testes de integração.
- Better Auth `$context` é API semi-interna → isolado em `src/server/auth-admin.ts` para facilitar atualização.
- Rate limit por email permite que um atacante bloqueie temporariamente uma conta (lockout de 15 min) → aceitável para o público do MVP.
