# Tasks

## 1. PWA

- [x] 1.1 Gerar ícones (192, 512, maskable, apple-touch) por script e criar `manifest.ts`; verificar `/manifest.webmanifest` no build
- [x] 1.2 Implementar `public/sw.js` (pré-cache estático, cache-first para estáticos versionados, rede para navegações com fallback offline, limpeza de versões) e cabeçalhos; verificar por E2E que páginas autenticadas não entram no cache
- [x] 1.3 Página `/offline`, banner de conexão e bloqueio de envio sem conexão; verificar por E2E com contexto offline
- [x] 1.4 Registro do SW com aviso de nova versão; verificar registro ativo no E2E de produção
- [x] 1.5 Página Mais → Instalar o app (Android/iOS e prompt nativo); verificar por E2E
- [x] 1.6 Auditoria Lighthouse (PWA/instalabilidade, acessibilidade) no build local; registrar resultado

## 2. Dados e documentação

- [x] 2.1 Seed de demonstração com guardas e idempotência; verificar recusa em produção e reexecução
- [x] 2.2 README em português (local, Docker, bancos, Vercel, migrations, bootstrap, casais, recuperação de senha, backup/restauração, limitações) e `.env.example` atualizado; verificar comandos documentados

## 3. Validação final

- [x] 3.1 Executar `openspec validate pwa-deploy --strict`, typecheck, lint, testes, build e E2E completos; registrar o que não pôde ser validado
