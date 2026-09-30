# Spec Delta

## ADDED Requirements

### Requirement: Visão em calendário
A lista de lançamentos SHALL permitir alternar entre lista cronológica e calendário mensal. O calendário SHALL mostrar, por dia, o total realizado de entradas e saídas e a existência de pendências (com texto/ícone, não só cor), usando a data de referência de cada lançamento. Tocar em um dia SHALL abrir a lista daquele dia.

#### Scenario: Dia com pendência
- **GIVEN** uma despesa pendente com vencimento em 28/03/2026
- **WHEN** o calendário de março é exibido
- **THEN** o dia 28 indica pendência e, ao tocar, lista essa despesa
