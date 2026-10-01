# Spec Delta

## ADDED Requirements

### Requirement: Vínculo com recorrência
Um lançamento PODE pertencer a uma recorrência do mesmo casal, com uma posição fixa na série e a indicação de personalização individual. Vínculo, posição e personalização MUST ser definidos apenas pelo servidor e MUST NOT ser aceitos de dados enviados pelo navegador. Duplicar um lançamento recorrente SHALL criar um lançamento avulso, sem vínculo com a série.

#### Scenario: Duplicar ocorrência
- **GIVEN** a ocorrência 3 de 12 de uma recorrência
- **WHEN** o membro usa "Duplicar"
- **THEN** o novo lançamento é avulso e não altera as ocorrências nem as contagens da série

#### Scenario: Vínculo forjado
- **WHEN** uma requisição de criação ou edição de lançamento envia identificador de recorrência, posição ou personalização
- **THEN** esses valores são ignorados e o vínculo existente (ou a ausência dele) é mantido
