# budgets Specification

## Purpose
Orçamento mensal por categoria principal de despesa, comparando o planejado com o realizado e com as pendências previstas.

## Requirements

### Requirement: Limite mensal por categoria principal
O casal SHALL poder definir, para cada mês, um limite em reais para categorias principais de despesa. Limites MUST ser positivos e únicos por categoria e mês. Subcategorias e categorias de receita MUST NOT receber limite.

#### Scenario: Limite em subcategoria
- **WHEN** alguém tenta definir limite para a subcategoria "Mercado"
- **THEN** a operação é recusada

### Requirement: Consumo do orçamento
Para cada limite, o sistema SHALL mostrar: limite, realizado, pendente, disponível (limite − realizado), percentual consumido (realizado ÷ limite) e alerta.
- Realizado = despesas comuns efetivadas no mês pela data de efetivação + parcelas de compras confirmadas no cartão cuja fatura vence no mês (compromissos assumidos, mesmo com a fatura ainda não paga).
- Pendente = despesas comuns pendentes com data prevista no mês + previsões de cobrança recorrente no cartão cuja fatura sugerida vence no mês.

Despesas de subcategorias MUST ser somadas à categoria principal exatamente uma vez. Transferências e pagamentos de fatura MUST NOT ser considerados.

#### Scenario: Subcategoria agregada
- **GIVEN** limite de R$ 1.000,00 para Alimentação em abril, despesa efetivada de R$ 300,00 em Alimentação e R$ 200,00 em Mercado (subcategoria)
- **WHEN** o orçamento de abril é exibido
- **THEN** Alimentação mostra realizado R$ 500,00, disponível R$ 500,00 e 50%

#### Scenario: Compra parcelada distribui o consumo
- **GIVEN** compra de R$ 300,00 em Lazer, 3 parcelas, nas faturas que vencem em abril, maio e junho
- **WHEN** os orçamentos desses meses são exibidos
- **THEN** Lazer mostra R$ 100,00 realizado em cada um, e o pagamento da fatura de abril não soma nada a Lazer

#### Scenario: Previsão de assinatura no cartão
- **GIVEN** previsão de R$ 55,90 em Assinaturas com fatura sugerida vencendo em maio
- **WHEN** o orçamento de maio é exibido
- **THEN** R$ 55,90 aparece como pendente (previsto) em Assinaturas

### Requirement: Alertas de orçamento
O alerta SHALL ser "Dentro do limite" abaixo de 80%, "Perto do limite" de 80% a 100% inclusive, e "Acima do limite" acima de 100%, comunicado por texto e ícone além da cor.

#### Scenario: Estouro
- **GIVEN** limite de R$ 100,00 e realizado R$ 120,00
- **WHEN** o orçamento é exibido
- **THEN** aparece "Acima do limite", disponível −R$ 20,00 e 120%

### Requirement: Copiar orçamento do mês anterior
O casal SHALL poder copiar os limites do mês anterior para o mês atual, sem sobrescrever limites já definidos no mês de destino e ignorando categorias arquivadas.

#### Scenario: Cópia parcial
- **GIVEN** março com limites para Moradia e Lazer, e abril já com limite para Lazer
- **WHEN** o casal copia março para abril
- **THEN** abril recebe Moradia e mantém o limite de Lazer já existente
