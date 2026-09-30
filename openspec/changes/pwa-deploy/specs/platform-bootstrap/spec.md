# Spec Delta

## ADDED Requirements

### Requirement: Dados de demonstração separados
O sistema SHALL oferecer um comando opcional que cria um casal de demonstração com usuários e lançamentos fictícios, separado do bootstrap. O comando MUST recusar execução quando `NODE_ENV=production` ou sem a confirmação explícita `DEMO_SEED=1`, e MUST NOT alterar casais, usuários ou senhas existentes.

#### Scenario: Produção
- **GIVEN** `NODE_ENV=production`
- **WHEN** o seed de demonstração é executado
- **THEN** ele termina com erro e não grava nada

#### Scenario: Reexecução
- **GIVEN** o casal de demonstração já existe
- **WHEN** o seed é executado novamente
- **THEN** nada é duplicado nem sobrescrito
