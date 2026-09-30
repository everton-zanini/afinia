# Spec Delta

## Purpose

Tela inicial que responde em poucos segundos à situação financeira atual do casal, com resumo primeiro e detalhes sob demanda.

## ADDED Requirements

### Requirement: Resumo do mês
O Início SHALL exibir saldo total realizado (todas as contas ativas), receitas realizadas, despesas realizadas e resultado (receitas − despesas) do mês corrente. Previsões (pendências) SHALL aparecer identificadas como "previsto", separadas dos valores realizados.

#### Scenario: Fixture de março
- **GIVEN** a fixture conhecida e o mês de março de 2026
- **WHEN** o Início é exibido para março
- **THEN** mostra receitas R$ 5.000,00, despesas R$ 2.382,85, resultado R$ 2.617,15 e previsto de R$ 700,00 a receber e R$ 80,00 a pagar

### Requirement: Comparação com o mês anterior
O sistema SHALL comparar receitas, despesas e resultado com o mês anterior, exibindo a variação em reais e em percentual. Quando o valor do mês anterior for zero, o percentual MUST NOT ser calculado e SHALL aparecer "sem base de comparação".

#### Scenario: Mês anterior sem dados
- **GIVEN** nenhuma receita em fevereiro e R$ 1.000,00 em março
- **WHEN** a comparação de receitas de março é exibida
- **THEN** aparece "+R$ 1.000,00" e "sem base de comparação", sem divisão por zero

### Requirement: Vencimentos e atrasos
O Início SHALL listar pendências atrasadas (data prevista anterior a hoje) e as que vencem nos próximos 7 dias, ordenadas por data, com acesso ao lançamento para marcá-lo como pago.

#### Scenario: Conta atrasada
- **GIVEN** uma despesa pendente com vencimento ontem
- **WHEN** o Início é exibido
- **THEN** ela aparece em "Atrasados" com o texto "Atrasado" e ícone de alerta

### Requirement: Insights determinísticos
O sistema SHALL gerar frases calculadas apenas a partir dos dados do casal (sem IA externa e sem recomendações financeiras), como a participação da maior categoria nas despesas realizadas do mês, a variação das despesas em relação ao mês anterior e categorias acima do limite.

#### Scenario: Maior categoria
- **GIVEN** despesas realizadas de R$ 1.000,00 no mês, R$ 280,00 em Alimentação
- **WHEN** os insights são exibidos
- **THEN** aparece "Alimentação representa 28% das despesas realizadas do mês"

### Requirement: Estados da tela
O Início SHALL ter estado de carregamento, de erro com opção de tentar novamente e de ausência de dados que orienta o primeiro lançamento, sem exibir dados fictícios.

#### Scenario: Casal novo
- **GIVEN** um casal sem contas nem lançamentos
- **WHEN** abre o Início
- **THEN** vê orientação para cadastrar uma conta e fazer o primeiro lançamento, com valores zerados
