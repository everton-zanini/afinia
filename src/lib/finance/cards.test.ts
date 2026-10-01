import { describe, expect, it } from "vitest";
import {
  cycleContaining,
  cyclesFrom,
  cyclesNeededFor,
  suggestCycle,
  dueDateFor,
  invoiceStatus,
  limitView,
  nextCycle,
  previousCycle,
  splitInstallments,
} from "./cards";

const card = (closingDay: number, dueDay: number) => ({ closingDay, dueDay });

describe("ciclos", () => {
  it("compra antes, no dia e depois do fechamento", () => {
    const c = card(5, 15);
    const before = cycleContaining("2026-03-04", c);
    expect(before).toEqual({ periodStart: "2026-02-06", closingDate: "2026-03-05", dueDate: "2026-03-15" });
    expect(cycleContaining("2026-03-05", c)).toEqual(before);
    expect(cycleContaining("2026-03-06", c)).toEqual({ periodStart: "2026-03-06", closingDate: "2026-04-05", dueDate: "2026-04-15" });
    expect(nextCycle(before, c)).toEqual(cycleContaining("2026-03-06", c));
  });

  it("vencimento no mês seguinte ao fechamento", () => {
    expect(cycleContaining("2026-03-20", card(25, 5))).toMatchObject({ closingDate: "2026-03-25", dueDate: "2026-04-05" });
  });

  it("meses curtos mantêm o dia de referência", () => {
    const c = card(31, 10);
    const feb = cycleContaining("2026-02-15", c);
    expect(feb).toEqual({ periodStart: "2026-02-01", closingDate: "2026-02-28", dueDate: "2026-03-10" });
    expect(nextCycle(feb, c)).toEqual({ periodStart: "2026-03-01", closingDate: "2026-03-31", dueDate: "2026-04-10" });
    expect(nextCycle(nextCycle(feb, c), c)).toMatchObject({ closingDate: "2026-04-30" });
  });

  it("vencimento limitado ao fim do mês e estritamente posterior", () => {
    expect(dueDateFor("2026-02-28", 31)).toBe("2026-03-31");
    expect(dueDateFor("2026-03-05", 5)).toBe("2026-04-05");
    expect(dueDateFor("2026-12-25", 5)).toBe("2027-01-05");
  });

  it("mudança de dia vale para o próximo ciclo e continua a sequência", () => {
    const last = { periodStart: "2026-05-06", closingDate: "2026-06-05", dueDate: "2026-06-15" };
    expect(nextCycle(last, card(10, 20))).toEqual({ periodStart: "2026-06-06", closingDate: "2026-07-10", dueDate: "2026-07-20" });
  });

  it("ciclo anterior termina no dia anterior ao início do primeiro", () => {
    const first = cycleContaining("2026-03-04", card(5, 15));
    expect(previousCycle(first, card(5, 15))).toEqual({ periodStart: "2026-01-06", closingDate: "2026-02-05", dueDate: "2026-02-15" });
  });
});

describe("parcelas", () => {
  it("R$ 100,00 em 3 = 33,34 + 33,33 + 33,33", () => {
    expect(splitInstallments(10_000, 3)).toEqual([3_334, 3_333, 3_333]);
  });

  it("soma sempre exata", () => {
    for (const [total, n] of [[99_999, 7], [1, 1], [12_345, 12], [240_000, 24], [101, 48]] as const) {
      const p = splitInstallments(total, n)!;
      expect(p).toHaveLength(n);
      expect(p.reduce((s, v) => s + v, 0)).toBe(total);
      expect(Math.max(...p) - Math.min(...p)).toBeLessThanOrEqual(1);
    }
  });

  it("recusa parcela zero e quantidades inválidas", () => {
    expect(splitInstallments(2, 3)).toBeNull();
    expect(splitInstallments(10_000, 0)).toBeNull();
    expect(splitInstallments(10_000, 49)).toBeNull();
  });
});

describe("situação da fatura", () => {
  const inv = { closingDate: "2026-03-05", dueDate: "2026-03-15" };

  it("fechada e não paga, ainda não vencida", () => {
    expect(invoiceStatus(inv, 50_000, 0, "2026-03-10")).toEqual({
      cycle: "closed", payment: "open", overdue: false, totalCents: 50_000, paidCents: 0, remainingCents: 50_000,
    });
  });

  it("vencida com pagamento parcial", () => {
    expect(invoiceStatus(inv, 50_000, 20_000, "2026-03-20")).toMatchObject({ payment: "partial", overdue: true, remainingCents: 30_000 });
  });

  it("quitada e vazia nunca são devidas", () => {
    expect(invoiceStatus(inv, 50_000, 50_000, "2026-04-01")).toMatchObject({ payment: "paid", overdue: false });
    expect(invoiceStatus(inv, 0, 0, "2026-04-01")).toMatchObject({ payment: "empty", overdue: false, remainingCents: 0 });
    expect(invoiceStatus(inv, 0, 0, "2026-03-01").cycle).toBe("open");
  });
});

describe("limite estimado", () => {
  it("parcelas futuras comprometem; pagamentos liberam", () => {
    expect(limitView(500_000, 120_000, 10_000)).toEqual({ limitCents: 500_000, committedCents: 110_000, availableCents: 390_000, over: false });
    expect(limitView(500_000, 530_000, 0)).toMatchObject({ availableCents: -30_000, over: true });
  });
});

describe("faturas conhecidas e prévia", () => {
  const card = { closingDay: 5, dueDay: 15 };
  const known = [
    { periodStart: "2026-02-06", closingDate: "2026-03-05", dueDate: "2026-03-15", paid: true },
    { periodStart: "2026-03-06", closingDate: "2026-04-05", dueDate: "2026-04-15", paid: false },
  ];

  it("cyclesNeededFor estende para frente e para trás e não cria nada se já coberta", () => {
    const bounds = { first: known[0], last: known[1] };
    expect(cyclesNeededFor("2026-03-20", bounds, card)).toEqual([]);
    expect(cyclesNeededFor("2026-05-20", bounds, card).map((c) => c.closingDate)).toEqual(["2026-05-05", "2026-06-05"]);
    expect(cyclesNeededFor("2026-01-20", bounds, card).map((c) => c.closingDate)).toEqual(["2026-02-05"]);
    expect(cyclesNeededFor("2026-03-04", { first: null, last: null }, card)).toEqual([
      { periodStart: "2026-02-06", closingDate: "2026-03-05", dueDate: "2026-03-15" },
    ]);
  });

  it("suggestCycle usa a fatura do ciclo ou a seguinte quando aquela está quitada", () => {
    expect(suggestCycle("2026-03-20", known, card).closingDate).toBe("2026-04-05");
    expect(suggestCycle("2026-03-04", known, card).closingDate).toBe("2026-04-05");
    expect(suggestCycle("2026-04-20", known, card).closingDate).toBe("2026-05-05");
  });

  it("cyclesFrom usa as gravadas e cria as demais pela regra", () => {
    const list = cyclesFrom(known[1], known, 3, card);
    expect(list.map((c) => c.closingDate)).toEqual(["2026-04-05", "2026-05-05", "2026-06-05"]);
  });
});
