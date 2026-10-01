# Afinia

**Duas pessoas. Planos em comum.** Aplicativo de gestão financeira para casais: um espaço
financeiro compartilhado por casal, com plano de contas (categorias), contas, lançamentos,
orçamento mensal, dashboard e relatórios. PWA instalável, pensado para o celular.

- Stack: Next.js 16 (App Router, TypeScript), Prisma 7 + PostgreSQL 17, Better Auth
  (email/senha), Tailwind CSS 4 + shadcn/ui, lucide-react, Recharts, Zod, Vitest e Playwright.
- Especificações e decisões: `openspec/specs/*` (requisitos vigentes) e
  `openspec/changes/archive/*` (propostas, designs e tarefas de cada etapa).

## Sumário

1. [Requisitos](#requisitos)
2. [Desenvolvimento local](#desenvolvimento-local)
3. [Testes](#testes)
4. [Primeiro administrador e casais](#primeiro-administrador-e-casais)
5. [Produção: PostgreSQL gerenciado e Vercel](#produção-postgresql-gerenciado-e-vercel)
6. [Backup e restauração](#backup-e-restauração)
7. [Regras importantes](#regras-importantes)
8. [Limitações e próximos passos](#limitações-e-próximos-passos)

## Requisitos

- Node.js **22 LTS** (recomendado; mínimo 20.19 — o Node 20 já saiu de suporte).
- Docker Desktop (apenas para o PostgreSQL local).

## Desenvolvimento local

O Next.js roda direto no computador (com hot reload); só o banco fica no Docker.

```bash
cp .env.example .env          # ajuste POSTGRES_PASSWORD, BETTER_AUTH_SECRET e as URLs
npm install                   # também gera o Prisma Client
npm run db:up                 # sobe o PostgreSQL 17 e aguarda ficar saudável
npm run db:migrate            # aplica as migrations no banco de desenvolvimento
npm run bootstrap             # cria o administrador (ver seção abaixo)
npm run dev                   # http://localhost:3000
```

Gere o segredo com `npx @better-auth/cli secret` ou `openssl rand -base64 32`.

**Porta ocupada?** Defina outra em `POSTGRES_PORT` (ex.: `5434`) e use a mesma porta em
`DATABASE_URL` e `DATABASE_URL_TEST`. Nenhum serviço existente é afetado — o banco é
publicado somente em `127.0.0.1`.

**Bancos locais** (no mesmo container):

| Banco | Uso |
| --- | --- |
| `afinia_dev` | desenvolvimento (`DATABASE_URL`) |
| `afinia_test` | testes automatizados (`DATABASE_URL_TEST`), criado na 1ª inicialização do volume |

**Parar e remover:**

```bash
npm run db:stop               # para o container — os dados são PRESERVADOS no volume
docker compose up -d          # volta a subir com os mesmos dados
docker compose down           # remove o container; o volume (dados) continua
docker compose down -v        # ATENÇÃO: remove o volume e APAGA o banco local
```

Se o volume foi criado antes do script de init (sem `afinia_test`), crie o banco de testes:
`docker compose exec db createdb -U afinia afinia_test`.

**Dados de demonstração (opcional, só desenvolvimento):**

```bash
DEMO_SEED=1 DEMO_PASSWORD=uma-senha-local npm run seed:demo
```

Cria o "Casal Demonstração" (`demo1@afinia.local`, `demo2@afinia.local`) com lançamentos
fictícios. Recusa rodar com `NODE_ENV=production`, sem `DEMO_SEED=1` ou sem senha, e nunca
altera dados existentes. **Não use em produção nem no casal real.**

Outros comandos: `npm run db:status` (situação das migrations), `npm run db:seed:categories`
(garante as categorias sugeridas em todos os casais, sem alterar as existentes),
`npm run icons` (regera os ícones do PWA), `npm run lint`, `npm run typecheck`.

## Testes

Os testes nunca usam o banco de desenvolvimento ou de produção: os scripts apontam
`DATABASE_URL` para `DATABASE_URL_TEST`, e a limpeza **recusa** qualquer banco cujo nome não
termine em `_test`.

```bash
npm run test:unit             # regras monetárias, datas, saldos, orçamento, relatórios
npm run test:integration      # serviços + banco de teste: permissões, isolamento, reconciliação
npm run test                  # os dois acima
npm run e2e                   # build de produção + Playwright (celular 360 px)
```

A fixture financeira conhecida (`src/lib/finance/fixture.ts`) tem os valores esperados
calculados à mão; ela é usada para reconciliar regras puras, serviços persistidos, relatórios
e os valores exibidos na interface (E2E).

## Primeiro administrador e casais

Não há cadastro público. O administrador da plataforma é criado por bootstrap:

```bash
BOOTSTRAP_ADMIN_EMAIL=voce@exemplo.com \
BOOTSTRAP_ADMIN_NAME="Seu Nome" \
BOOTSTRAP_ADMIN_PASSWORD="senha-temporaria-forte" \
BOOTSTRAP_HOUSEHOLD_NAME="Nossa Casa" \
npm run bootstrap
```

- Senha com pelo menos 12 caracteres; é temporária: a troca é exigida no primeiro acesso.
- É idempotente: rodar de novo **não** altera senha, nome ou casal existentes.
- `BOOTSTRAP_HOUSEHOLD_NAME` (opcional) cria o casal do administrador já com as categorias
  sugeridas. Remova as variáveis `BOOTSTRAP_*` do ambiente depois de usar.

**Cadastrar a esposa/o parceiro e outros casais (sem alterar código):** entre como
administrador → **Mais → Administração**.

- *Adicionar participante* no casal existente (nome, email e senha temporária de 10+
  caracteres; o botão "Gerar" cria uma aleatória).
- *Novo casal* para casais de teste, com um ou dois participantes.
- *Desativar acesso*: bloqueia o login e encerra as sessões do casal (dados preservados).

O painel mostra só dados de gestão. Ser administrador **não** dá acesso às finanças de outros
casais.

**Recuperação de senha (sem email no MVP):** o administrador abre o casal da pessoa em
Administração → *Definir senha temporária*, informa a nova senha temporária e a repassa por um
canal seguro. As sessões da pessoa são encerradas e ela precisa definir uma nova senha no
próximo acesso. Se o próprio administrador perder a senha, quem tem acesso ao banco executa:

```bash
RESET_EMAIL=voce@exemplo.com RESET_PASSWORD="nova-temporaria-forte" npm run reset-password
```

## Produção: PostgreSQL gerenciado e Vercel

> O projeto está pronto para a Vercel, mas **não foi publicado**. Os passos abaixo são a
> configuração externa pendente.

1. **Banco**: crie um PostgreSQL 17 gerenciado — [Neon](https://neon.tech) (recomendado) ou
   Prisma Postgres. Use projetos/bancos **separados** para produção e preview.
   - `DATABASE_URL`: URL **com pooler** (no Neon, host com `-pooler`), usada pela aplicação
     serverless.
   - `DIRECT_URL`: URL **direta** (sem pooler), usada apenas por `prisma migrate deploy`.
   - Ambas com `sslmode=require`.
2. **Vercel**: importe o repositório (framework Next.js, build padrão `npm run build`, que
   executa `prisma generate`). Configure as variáveis por ambiente:
   `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET` (um por ambiente) e `BETTER_AUTH_URL`
   (ex.: `https://afinia.vercel.app`). Use Node 22 nas configurações do projeto.
3. **Migrations em produção** — nunca `migrate dev`/`reset` em produção:
   ```bash
   DATABASE_URL="<pooled>" DIRECT_URL="<direta-producao>" npx prisma migrate deploy
   ```
   Rode antes de promover um deploy que traga migrations novas (a partir da sua máquina ou
   de um job de CI com as credenciais de produção). Confira com `npx prisma migrate status`.
4. **Bootstrap em produção**: rode `npm run bootstrap` uma vez com as variáveis `BOOTSTRAP_*`
   e a `DATABASE_URL` de produção no terminal (não as salve na Vercel).
5. **Atualizações do PWA**: ao mudar `public/sw.js`, altere a constante `VERSION`. Os
   usuários verão "Nova versão disponível".

Nunca use credenciais de produção nos testes; os testes só aceitam bancos `*_test`.

## Backup e restauração

- **Neon**: backups contínuos com *point-in-time restore* (janela conforme o plano). Para
  restaurar, crie um branch a partir de um horário anterior e troque as URLs, ou restaure o
  branch principal pelo console. Antes de migrations arriscadas, crie um branch de segurança.
- **Prisma Postgres**: use os backups automáticos do console do provedor.
- **Backup lógico (qualquer provedor)** com o cliente PostgreSQL 17:
  ```bash
  pg_dump "$DIRECT_URL" --format=custom --no-owner --file=afinia-$(date +%F).dump
  pg_restore --clean --if-exists --no-owner --dbname="<URL-do-banco-destino>" afinia-AAAA-MM-DD.dump
  ```
  Guarde os arquivos cifrados e fora do repositório; teste a restauração em um banco separado.
- **Local (Docker)**:
  ```bash
  docker compose exec -T db pg_dump -U afinia -Fc afinia_dev > afinia-dev.dump
  docker compose exec -T db pg_restore -U afinia --clean --if-exists -d afinia_dev < afinia-dev.dump
  ```

## Regras importantes

- **Isolamento**: todo dado financeiro pertence a um casal; o casal é derivado da sessão, nunca
  do navegador. Gatilhos no banco recusam referências cruzadas entre casais.
- **Dinheiro** em centavos inteiros, sem ponto flutuante; valores sempre positivos (o tipo define
  o efeito). **Datas** de calendário (`DATE`), com "hoje" no fuso America/Sao_Paulo.
- **Saldo realizado** = saldo inicial + efetivados. Saldo inicial não é receita. Pendências
  aparecem como "previsto".
- Receitas/despesas realizadas contam pela data de efetivação; pendências pela data prevista.
- **Transferências** são um único registro (atômico), alteram as duas contas e não entram em
  receitas, despesas ou orçamento.
- Lançamentos efetivados precisam ser na data de abertura da conta ou depois.
- Categorias/contas usadas são arquivadas, nunca excluídas.
- **Recorrências** (Repetir no novo lançamento; Mais → Recorrências): semanal, mensal ou anual,
  com término após N ocorrências, até uma data (inclusive) ou sem término. As ocorrências com data
  até hoje + 12 meses existem como lançamentos pendentes e são criadas automaticamente quando o
  casal usa o app (sem tarefa agendada), inclusive as que ficaram para trás após um período sem
  uso. Cada ocorrência tem posição fixa na série; edição e exclusão perguntam "Só este lançamento"
  ou "Este e os próximos" e nunca alteram lançamentos efetivados.
- **Offline**: o service worker guarda só recursos públicos e estáticos; páginas, APIs e dados
  financeiros nunca vão para o cache. Sem conexão, nada é salvo.

## Limitações e próximos passos

Fora do MVP: cartões e faturas, compras parceladas no cartão, conciliação e Open Finance,
cadastro público, recuperação de senha por email, finanças privadas por membro, notificações
push, gravação/sincronização offline e recursos com IA.

Recorrências não representam compras parceladas: estas virão no módulo de cartões, vinculadas à
compra original e às faturas. Quando houver cartões, uma recorrência cobrada no cartão deverá
gerar uma cobrança vinculada à fatura, sem descontar diretamente uma conta bancária e sem duplicar
a despesa no pagamento da fatura.

Próximos passos sugeridos: módulo de cartões e faturas, recuperação de senha por email (com
serviço transacional), agregações em SQL quando o histórico crescer e testes E2E em Safari/iOS
real.
