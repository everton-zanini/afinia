/**
 * Garante que operações destrutivas de teste só rodem em um banco cujo nome termina em `_test`.
 * Protege os bancos de desenvolvimento e produção contra limpezas acidentais.
 */
export function assertTestDatabaseUrl(url: string | undefined): string {
  if (!url) throw new Error("DATABASE_URL_TEST não definida");
  let dbName: string;
  try {
    dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    throw new Error("DATABASE_URL_TEST inválida");
  }
  if (!/_test$/.test(dbName)) {
    throw new Error(`Recusado: o banco de testes deve terminar em _test (recebido "${dbName}")`);
  }
  return url;
}
