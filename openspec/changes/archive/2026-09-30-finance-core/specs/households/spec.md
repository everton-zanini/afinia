# Spec Delta

## ADDED Requirements

### Requirement: Casal criado com categorias sugeridas
A criação de um casal (pelo administrador ou pelo bootstrap) SHALL incluir, na mesma operação atômica, as categorias sugeridas do plano de contas.

#### Scenario: Bootstrap do casal do administrador
- **WHEN** o bootstrap cria o casal do administrador
- **THEN** o casal já possui as categorias sugeridas
