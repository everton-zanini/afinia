/** Erro de regra de negócio com mensagem segura para exibir ao usuário. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** Recurso inexistente ou de outro casal — sempre a mesma resposta para não vazar existência. */
export class NotFoundError extends DomainError {
  constructor(message = "Registro não encontrado") {
    super(message);
    this.name = "NotFoundError";
  }
}
