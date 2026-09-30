# Proposal

## Why

O casal usará o Afinia principalmente no celular; instalá-lo na tela inicial e ter comportamento claro sem conexão torna o uso diário mais natural. Falta também deixar o projeto pronto para produção na Vercel, com documentação de operação e dados de demonstração separados.

## What Changes

- PWA instalável: manifest (nome, nome curto, tema, `display: standalone`), ícones (incluindo maskable e Apple touch icon), service worker próprio.
- Cache apenas de recursos públicos e estáticos; nunca de páginas autenticadas, respostas de API ou dados financeiros.
- Página offline clara; indicação de falta de conexão no app e bloqueio de envio de formulários sem conexão (sem fingir que salvou).
- Estratégia de atualização: nova versão detectada → aviso "Nova versão disponível" com botão para atualizar.
- Orientação de instalação para Android e iOS em Mais → Instalar o app.
- Seed de demonstração opcional, recusado em produção.
- README em português com desenvolvimento local, Docker, PostgreSQL gerenciado, Vercel, migrations em produção, bootstrap, cadastro de casais, recuperação manual de senha, backup/restauração e limitações.

## Capabilities

### New Capabilities
- `pwa`: instalação, cache seguro, experiência offline e atualização.

### Modified Capabilities
- `platform-bootstrap`: seed de demonstração opcional e protegido.

## Impact

- `src/app/manifest.ts`, `public/sw.js`, `public/icons/*`, `src/app/offline/page.tsx`, componentes de registro do SW e de status de conexão.
- `scripts/seed-demo.ts`, `README.md`, `.env.example`.
