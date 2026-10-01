# reports Specification

## Purpose
Visualizações dos dados reais do casal — despesas por categoria, receitas × despesas e evolução do saldo — acessíveis no celular e com caminho até os lançamentos.

## Requirements

### Requirement: Despesas por categoria
O relatório SHALL mostrar um gráfico de rosca das despesas realizadas do mês por categoria principal (subcategorias agregadas sem dupla contagem), com legenda contendo nome, valor e percentual. Transferências MUST NOT entrar.

#### Scenario: Fixture de março
- **GIVEN** a fixture conhecida
- **WHEN** o relatório de março é exibido
- **THEN** Moradia R$ 1.800,00 (76%), Alimentação R$ 582,85 (24%) e o total R$ 2.382,85

### Requirement: Receitas × despesas em seis meses
O relatório SHALL mostrar barras de receitas e despesas realizadas dos últimos seis meses até o mês selecionado, incluindo meses sem movimento com valor zero.

#### Scenario: Meses sem dados
- **GIVEN** lançamentos apenas em fevereiro e março de 2026
- **WHEN** o relatório termina em abril de 2026
- **THEN** aparecem 6 meses (novembro a abril), com zeros nos meses sem movimento

### Requirement: Evolução do saldo realizado
O relatório SHALL mostrar a evolução diária do saldo realizado no mês, partindo do saldo inicial do período (saldo ao fim do dia anterior ao primeiro dia do mês, incluindo saldos de abertura de contas abertas antes). Contas abertas durante o mês somam seu saldo de abertura na data de abertura.

#### Scenario: Saldo inicial de março
- **GIVEN** a fixture conhecida
- **WHEN** a evolução de março é exibida
- **THEN** o saldo inicial do período é R$ 10.700,00 e o saldo em 31/03 é R$ 13.317,15

### Requirement: Filtros aplicáveis
Os relatórios SHALL aceitar mês e conta como filtros. Com uma conta selecionada, categorias e receitas × despesas consideram apenas lançamentos daquela conta e a evolução mostra apenas o saldo dela.

#### Scenario: Filtro por conta
- **GIVEN** a fixture e a conta Carteira selecionada
- **WHEN** o relatório de março é exibido
- **THEN** despesas por categoria mostram apenas Alimentação R$ 12,35

### Requirement: Acessibilidade e toque
Todo gráfico SHALL ter tooltip acionável por toque, uma alternativa textual (tabela ou lista) com os mesmos valores, estado vazio quando não houver dados e, quando fizer sentido, link para os lançamentos correspondentes (ex.: categoria no mês).

#### Scenario: Sem dados
- **GIVEN** um mês sem despesas realizadas
- **WHEN** o gráfico de categorias é exibido
- **THEN** aparece "Sem despesas realizadas neste mês" em vez de um gráfico vazio

#### Scenario: Abrir lançamentos da categoria
- **WHEN** o usuário toca em "Alimentação" na legenda
- **THEN** abre a lista de lançamentos filtrada por Alimentação no mês

### Requirement: Revelação progressiva
Em telas pequenas, os gráficos SHALL ser apresentados um por vez (abas), nunca todos simultaneamente.

#### Scenario: Celular
- **WHEN** o usuário abre Relatórios em 360 px
- **THEN** vê apenas o gráfico da aba selecionada

### Requirement: Créditos de benefício nos relatórios
O relatório de receitas × despesas SHALL distinguir, em cada mês, receitas em dinheiro e créditos de benefício, no gráfico e na alternativa textual. As despesas continuam agrupadas por categoria, independentemente da conta usada.

#### Scenario: Mês com crédito de benefício
- **GIVEN** salário de R$ 5.000,00 e crédito de vale-alimentação de R$ 800,00 efetivados em abril
- **WHEN** a tabela de receitas × despesas é exibida
- **THEN** a linha de abril mostra R$ 5.000,00 em receitas em dinheiro e R$ 800,00 em créditos de benefício
