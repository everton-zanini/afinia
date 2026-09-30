# Design

## Context

Next.js 16 com Turbopack. Serwist exige webpack para build; o guia oficial do Next sugere manifest nativo + service worker próprio. O app exige conexão para dados (sem gravação offline no MVP).

## Goals / Non-Goals

**Goals:** instalação, página offline, nenhum dado sensível em cache, atualização explícita, documentação de produção.

**Non-Goals:** sincronização/gravação offline, notificações push.

## Decisions

- **Manifest**: `src/app/manifest.ts` (rota `/manifest.webmanifest`), `start_url: /inicio`, `scope: /`, `lang: pt-BR`.
- **Ícones**: PNGs gerados por script (`scripts/generate-icons.mjs`, sem dependências — codifica PNG com `zlib` do Node) a partir da marca: 192, 512, maskable 512 (área segura 80%) e apple-touch 180. Versionados em `public/icons/`.
- **Service worker** (`public/sw.js`, servido com `Cache-Control: no-cache` e `Service-Worker-Allowed: /`):
  - `install`: pré-cache de `/offline`, manifest e ícones em `afinia-static-<versão>`; sem `skipWaiting` automático.
  - `activate`: remove caches com outro nome; `clients.claim()`.
  - `fetch`: somente GET de mesma origem. `/_next/static/*` e `/icons/*` → cache-first (arquivos imutáveis/versionados). Navegações → rede sempre (`cache: "no-store"`); em falha, responde a página offline do cache. Todo o resto (API, Server Actions, RSC, exportação) passa direto sem cache.
  - `message: SKIP_WAITING` → `skipWaiting()`.
  - Versão: constante `VERSION` no arquivo, atualizada a cada release (documentado); qualquer alteração de bytes do `sw.js` dispara atualização.
- **Registro** (`PwaRegister`, Client Component no layout raiz): registra só em produção; detecta `registration.waiting`/`updatefound` e mostra toast persistente "Nova versão disponível" → envia `SKIP_WAITING` e recarrega no `controllerchange`.
- **Offline no app**: `ConnectionBanner` (fixo, com texto e ícone) usando eventos `online/offline`; `ActionForm` verifica `navigator.onLine` antes de enviar e mostra "Sem conexão. O lançamento não foi salvo." A página `/offline` é estática, pública e sem dados.
- **Instalação**: `/mais/instalar` com instruções Android/iOS e botão que usa `beforeinstallprompt` quando disponível.
- **Seed demo**: `scripts/seed-demo.ts` com guardas (`NODE_ENV !== production` e `DEMO_SEED=1`), casal "Casal Demonstração" com usuários `demo1@afinia.local`/`demo2@afinia.local` e senha lida de `DEMO_PASSWORD` (sem padrão no código); idempotente (sai se o casal existe).

## Risks / Trade-offs

- SW próprio exige disciplina de versão → documentado no README e o fallback de navegação nunca serve conteúdo antigo autenticado.
- iOS tem suporte limitado a PWA (sem prompt nativo) → instruções manuais.
