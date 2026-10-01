// Usuários fixos dos testes E2E (somente no banco _test).
export const E2E = {
  admin: { name: "Admin Teste", email: "admin@e2e.test", password: "senha-do-admin-1" },
  ana: { name: "Ana Teste", email: "ana@e2e.test", password: "senha-da-ana-1" },
  beto: { name: "Beto Teste", email: "beto@e2e.test", password: "senha-do-beto-1" },
  temp: { name: "Temporária", email: "temp@e2e.test", password: "senha-temporaria-1" },
  // Casal com a fixture financeira conhecida (src/lib/finance/fixture.ts) para reconciliar telas.
  fixture: { name: "Fixture Teste", email: "fixture@e2e.test", password: "senha-da-fixture-1" },
  rec: { name: "Recorrência Teste", email: "rec@e2e.test", password: "senha-da-recorrencia-1" },
  ben: { name: "Benefício Teste", email: "ben@e2e.test", password: "senha-do-beneficio-1" },
  card: { name: "Cartão Teste", email: "card@e2e.test", password: "senha-do-cartao-1" },
};
