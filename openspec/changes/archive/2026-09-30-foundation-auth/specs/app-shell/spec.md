# Spec Delta

## Purpose

Define a estrutura de navegação mobile-first do Afinia, com acesso rápido às áreas principais e ao registro de novos lançamentos.

## ADDED Requirements

### Requirement: Navegação inferior
O aplicativo autenticado SHALL exibir uma navegação inferior fixa com os itens Início, Lançamentos, Planejamento, Relatórios e Mais, cada um com ícone e rótulo de texto, indicando o item ativo por forma e texto além da cor.

#### Scenario: Item ativo
- **WHEN** o usuário está em Lançamentos
- **THEN** o item Lançamentos aparece destacado e anunciado como página atual para leitores de tela

### Requirement: Botão de novo lançamento
O aplicativo SHALL exibir um botão de destaque "Novo lançamento" alcançável com o polegar em telas de celular, com área de toque de pelo menos 44×44 px.

#### Scenario: Acesso ao botão
- **WHEN** o usuário está em qualquer página principal no celular
- **THEN** o botão "Novo lançamento" está visível acima da navegação inferior, respeitando a safe area

### Requirement: Layout responsivo sem rolagem horizontal
As páginas SHALL funcionar em larguras de 360 px a desktop sem rolagem horizontal, respeitando safe areas do dispositivo.

#### Scenario: Tela de 360 px
- **WHEN** qualquer página principal é aberta em uma tela de 360 px de largura
- **THEN** a largura do conteúdo não excede a largura da janela

### Requirement: Navegação por teclado e acessibilidade
Todos os controles interativos SHALL ser alcançáveis por teclado, com foco visível, e textos SHALL atender contraste mínimo WCAG AA.

#### Scenario: Navegar por Tab
- **WHEN** o usuário navega com Tab pela navegação inferior
- **THEN** cada item recebe foco visível e pode ser ativado com Enter
