# categories Specification

## Purpose
Plano de contas compartilhado do casal: categorias e subcategorias que indicam a finalidade de cada receita ou despesa.

## Requirements

### Requirement: Categorias e subcategorias
O casal SHALL poder criar e editar categorias de receita ou despesa com nome, cor, ícone e tipo, e subcategorias com um único nível de profundidade. A subcategoria MUST ter o mesmo tipo da categoria principal. Nomes MUST ser únicos entre irmãos do mesmo tipo, sem diferenciar maiúsculas.

#### Scenario: Criar subcategoria
- **GIVEN** a categoria de despesa "Alimentação"
- **WHEN** um membro cria a subcategoria "Mercado" dentro dela
- **THEN** "Mercado" aparece sob "Alimentação" como despesa

#### Scenario: Subcategoria de outro tipo
- **WHEN** alguém tenta criar uma subcategoria de receita dentro de "Alimentação"
- **THEN** a operação é recusada

#### Scenario: Categoria principal de outro casal
- **GIVEN** a categoria "Lazer" do casal B
- **WHEN** um membro do casal A tenta criar uma subcategoria dentro dela
- **THEN** a operação é recusada como "Registro não encontrado"

### Requirement: Sugestões iniciais
Ao criar um casal, o sistema SHALL criar as categorias sugeridas editáveis: receitas Salários, Trabalhos extras e Outras receitas; despesas Moradia, Alimentação, Transporte, Saúde, Lazer, Educação, Assinaturas e Outras despesas. A criação MUST ser idempotente.

#### Scenario: Novo casal
- **WHEN** o administrador cadastra um casal
- **THEN** o casal possui as 11 categorias sugeridas e nenhum lançamento

### Requirement: Arquivamento preserva histórico
Categorias utilizadas em lançamentos ou orçamentos MUST NOT ser excluídas; SHALL ser arquivadas. Categorias arquivadas não aparecem para novos lançamentos, mas continuam exibidas nos lançamentos existentes e relatórios. Categorias nunca usadas e sem subcategorias podem ser excluídas.

#### Scenario: Excluir categoria usada
- **GIVEN** a categoria "Assinaturas" usada em um lançamento
- **WHEN** um membro tenta excluí-la
- **THEN** a exclusão é recusada e é oferecido o arquivamento

#### Scenario: Categoria arquivada
- **GIVEN** a categoria "Assinaturas" arquivada
- **WHEN** um membro abre o formulário de novo lançamento
- **THEN** "Assinaturas" não aparece entre as opções, mas o lançamento antigo continua mostrando "Assinaturas"
