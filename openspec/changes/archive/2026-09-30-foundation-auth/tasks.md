# Tasks

## 1. Projeto e ferramentas

- [x] 1.1 Criar projeto Next.js 16 (TypeScript, App Router, `src/`, Tailwind 4, ESLint) e verificar `npm run build`
- [x] 1.2 Configurar shadcn/ui, lucide-react, fonte e tokens de cor; verificar renderização da página de login
- [x] 1.3 Configurar scripts `typecheck`, `lint`, `test`, `test:unit`, `test:integration`, `e2e` e verificar que cada um executa
- [x] 1.4 Inicializar git com `.gitignore` adequado (sem `.env`) e verificar `git status`

## 2. Banco local e Prisma

- [x] 2.1 Criar `compose.yaml` (PostgreSQL 17, volume, healthcheck, bind em 127.0.0.1, porta configurável) e script de init do banco de testes; verificar `docker compose config`
- [x] 2.2 Criar `.env.example` sem segredos e verificar que todas as variáveis usadas estão documentadas
- [x] 2.3 Configurar Prisma 7 (`prisma.config.ts`, adapter pg, client singleton) com modelos do Better Auth e `LoginThrottle`; gerar migration inicial e verificar `prisma migrate dev` no banco de desenvolvimento
- [x] 2.4 Criar guarda do banco de testes (recusa nomes sem sufixo `_test`) e verificar com teste unitário

## 3. Autenticação

- [x] 3.1 Configurar Better Auth (email/senha, `disableSignUp`, campos adicionais, nextCookies, rate limit em banco) e rota `/api/auth/[...all]`; verificar que cadastro anônimo é recusado (teste de integração)
- [x] 3.2 Implementar limitação de tentativas por email via hooks; verificar bloqueio após 5 falhas e reset após sucesso (teste de integração)
- [x] 3.3 Implementar `requireUser()` e `proxy.ts`; verificar redirecionamento anônimo para `/login` (E2E)
- [x] 3.4 Implementar tela de login e logout; verificar fluxo login → início → sair (E2E)
- [x] 3.5 Implementar perfil: alterar nome e email (com senha atual e unicidade); verificar por teste de integração
- [x] 3.6 Implementar alteração de senha com revogação das outras sessões; verificar que a sessão B é invalidada (teste de integração)
- [x] 3.7 Implementar troca obrigatória de senha temporária; verificar redirecionamento e liberação (E2E)

## 4. Bootstrap

- [x] 4.1 Implementar `npm run bootstrap` (variáveis de ambiente, senha ≥ 12, idempotente, sem sobrescrever); verificar por teste de integração de reexecução

## 5. Shell do aplicativo

- [x] 5.1 Criar layout `(app)` com navegação inferior (5 itens, estado ativo acessível) e botão "Novo lançamento" com safe area; verificar em 360 px sem rolagem horizontal (E2E)
- [x] 5.2 Criar páginas iniciais de Início, Lançamentos, Planejamento, Relatórios e Mais (perfil, senha, sair) com estados vazios honestos; verificar navegação por teclado

## 6. Validação

- [x] 6.1 Executar `openspec validate foundation-auth --strict`, typecheck, lint, testes e build; registrar resultados
