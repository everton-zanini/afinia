# Proposal

## Why

O Afinia ainda não existe como aplicação: não há projeto, banco, autenticação nem estrutura de navegação. Todas as funcionalidades financeiras dependem de uma base segura com usuários individuais, sessões protegidas e um primeiro administrador criado sem credenciais embutidas no código.

## What Changes

- Criação do projeto Next.js (App Router, TypeScript) com Tailwind CSS, shadcn/ui, lucide-react, lint, verificação de tipos, Vitest e Playwright.
- Ambiente local com PostgreSQL via Docker (`compose.yaml`), banco de desenvolvimento e banco de testes separados, `.env.example` sem segredos.
- Prisma ORM com migrations versionadas e conexão adequada a serverless.
- Autenticação por email e senha: login, logout, alteração de nome/email, alteração de senha com confirmação da senha atual, revogação de sessões na troca de senha, limitação de tentativas de login persistida no banco.
- Sem cadastro público.
- Obrigação de troca de senha no primeiro acesso (senha temporária).
- Bootstrap do primeiro administrador da plataforma por comando documentado, lendo variáveis de ambiente, idempotente e sem senha padrão.
- Shell do aplicativo: layout mobile-first, navegação inferior (Início, Lançamentos, Planejamento, Relatórios, Mais), botão de destaque "Novo lançamento", proteção de rotas.

## Capabilities

### New Capabilities
- `user-auth`: identidade individual, login/logout, sessões, perfil, alteração de senha, troca obrigatória, limitação de tentativas e ausência de cadastro público.
- `platform-bootstrap`: criação segura e idempotente do primeiro administrador da plataforma.
- `app-shell`: estrutura de navegação protegida e responsiva do aplicativo.

### Modified Capabilities
- (nenhuma)

## Impact

- Novo código em todo o repositório (projeto greenfield).
- Dependências: next, react, prisma, @prisma/client, @prisma/adapter-pg, better-auth, tailwindcss, shadcn/ui, lucide-react, zod, vitest, @playwright/test.
- Infraestrutura local: Docker com PostgreSQL 17. Produção: PostgreSQL gerenciado (Neon/Prisma Postgres) e Vercel — configuração documentada, não executada.
