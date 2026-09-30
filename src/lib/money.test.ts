import { describe, expect, it } from "vitest";
import { centsToInput, formatBRL, parseBRL, percentOf, sumCents } from "./money";

describe("parseBRL", () => {
  it.each([
    ["1234", 123400],
    ["1234,5", 123450],
    ["1.234,56", 123456],
    ["R$ 1.234,56", 123456],
    ["0,10", 10],
    [",5", 50],
    ["1234.56", 123456],
    ["1.234", 123400],
    ["10.000.000,00", 1_000_000_000],
    ["-5", -500],
  ])("%s → %d centavos", (input, cents) => {
    expect(parseBRL(input)).toBe(cents);
  });

  it.each(["", "abc", "1,2,3", "1,234", "12.34.56", "1.23,45", "1e3", "0x10", "1,5a"])("recusa %s", (input) => {
    expect(parseBRL(input)).toBeNull();
  });
});

describe("formatBRL", () => {
  it("formata com aritmética inteira", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
    expect(formatBRL(5)).toBe("R$ 0,05");
    expect(formatBRL(-2000)).toBe("−R$ 20,00");
    expect(formatBRL(100, { signed: true })).toBe("+R$ 1,00");
    expect(formatBRL(0)).toBe("R$ 0,00");
  });

  it("recusa valores não inteiros", () => {
    expect(() => formatBRL(0.1)).toThrow();
  });
});

describe("somas exatas", () => {
  it("0,10 + 0,20 + 0,30 = 0,60", () => {
    const total = sumCents([parseBRL("0,10")!, parseBRL("0,20")!, parseBRL("0,30")!]);
    expect(total).toBe(60);
    expect(formatBRL(total)).toBe("R$ 0,60");
  });
});

describe("centsToInput e percentOf", () => {
  it("gera texto editável e percentuais seguros", () => {
    expect(centsToInput(123456)).toBe("1234,56");
    expect(parseBRL(centsToInput(987))).toBe(987);
    expect(percentOf(50000, 100000)).toBe(50);
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(10, 0)).toBeNull();
  });
});
