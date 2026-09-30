import { describe, expect, it } from "vitest";
import { assertTestDatabaseUrl } from "./test-db-guard";

describe("assertTestDatabaseUrl", () => {
  it("aceita bancos terminados em _test", () => {
    const url = "postgresql://u:p@127.0.0.1:5434/afinia_test";
    expect(assertTestDatabaseUrl(url)).toBe(url);
  });

  it.each([
    "postgresql://u:p@127.0.0.1:5434/afinia_dev",
    "postgresql://u:p@host/afinia_test_backup",
    "postgresql://u:p@host/afinia",
  ])("recusa %s", (url) => {
    expect(() => assertTestDatabaseUrl(url)).toThrow("Recusado");
  });

  it("recusa URL ausente", () => {
    expect(() => assertTestDatabaseUrl(undefined)).toThrow();
  });
});
