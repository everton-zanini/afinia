# Spec Delta

## ADDED Requirements

### Requirement: Casal do administrador no bootstrap
Quando `BOOTSTRAP_HOUSEHOLD_NAME` estiver definido, o bootstrap SHALL criar um casal ativo com esse nome e vincular o administrador como membro, caso ele ainda não participe de um casal. Reexecuções MUST NOT criar casais duplicados nem alterar o casal existente.

#### Scenario: Bootstrap com casal
- **GIVEN** `BOOTSTRAP_HOUSEHOLD_NAME=Casa Silva` e nenhum administrador
- **WHEN** o bootstrap é executado duas vezes
- **THEN** existe exatamente um casal "Casa Silva" com o administrador como único membro
