# Spec Delta

## ADDED Requirements

### Requirement: Login restrito a vínculos ativos
O sistema SHALL recusar a criação de sessão para usuários que não são administradores da plataforma e que não possuem vínculo ativo com um casal ativo, mesmo com a senha correta.

#### Scenario: Casal desativado
- **GIVEN** Carla, participante de um casal desativado
- **WHEN** ela entra com a senha correta
- **THEN** o login é recusado com "Acesso desativado. Fale com o administrador."

#### Scenario: Administrador sem casal
- **GIVEN** o administrador da plataforma sem vínculo com casal
- **WHEN** ele entra com a senha correta
- **THEN** o login é aceito e ele acessa o painel administrativo
