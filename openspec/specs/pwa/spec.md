# pwa Specification

## Purpose
Permite instalar o Afinia como aplicativo e define um comportamento seguro e honesto sem conexão, sem armazenar dados financeiros em cache.

## Requirements

### Requirement: Aplicativo instalável
O aplicativo SHALL publicar um manifest com nome "Afinia", nome curto, cor de tema verde-petróleo, cor de fundo, `display: standalone`, `start_url` em `/inicio` e ícones de 192 e 512 px, incluindo versão maskable, além de ícone Apple touch.

#### Scenario: Critérios de instalação
- **WHEN** o navegador lê o manifest em produção (HTTPS)
- **THEN** ele contém nome, ícones 192/512 (incluindo maskable), `display: standalone` e um service worker ativo controla a página

### Requirement: Cache somente de recursos públicos
O service worker SHALL armazenar em cache apenas recursos estáticos públicos (arquivos versionados em `/_next/static/`, ícones, manifest e a página offline). Páginas de navegação, respostas de API, Server Actions, exportações e qualquer resposta autenticada MUST NOT ser armazenadas em cache.

#### Scenario: Página financeira não fica em cache
- **GIVEN** o usuário visitou `/inicio` e `/lancamentos`
- **WHEN** o cache do service worker é inspecionado
- **THEN** não há entradas para essas páginas, para `/api/*` ou para `/lancamentos/exportar`

### Requirement: Experiência sem conexão
Sem conexão, navegar para uma página SHALL mostrar a página offline explicando que o Afinia precisa de internet para consultar e salvar dados. Formulários MUST NOT indicar sucesso sem confirmação do servidor; com o dispositivo offline, o botão de salvar SHALL informar que não há conexão e não enviar.

#### Scenario: Navegação offline
- **GIVEN** o aplicativo instalado e o dispositivo sem conexão
- **WHEN** o usuário abre Lançamentos
- **THEN** vê "Você está sem conexão" e nenhum dado financeiro em cache

#### Scenario: Salvar sem conexão
- **GIVEN** o formulário de novo lançamento aberto e a conexão perdida
- **WHEN** o usuário toca em Salvar
- **THEN** aparece "Sem conexão. O lançamento não foi salvo." e nada é enviado

### Requirement: Atualização do aplicativo
Quando uma nova versão do service worker for instalada, o aplicativo SHALL avisar "Nova versão disponível" com a ação "Atualizar", que ativa a nova versão e recarrega a página. Versões antigas do cache MUST ser removidas na ativação.

#### Scenario: Nova versão
- **GIVEN** uma nova versão publicada
- **WHEN** o usuário abre o aplicativo
- **THEN** vê o aviso e, ao tocar em Atualizar, passa a usar a nova versão

### Requirement: Orientação de instalação
O aplicativo SHALL oferecer instruções de instalação para Android (menu do navegador → Instalar app) e iOS (Compartilhar → Adicionar à Tela de Início), e usar o prompt nativo quando o navegador oferecer.

#### Scenario: iPhone
- **WHEN** um usuário de iPhone abre Mais → Instalar o app
- **THEN** vê o passo a passo com "Compartilhar" e "Adicionar à Tela de Início"
