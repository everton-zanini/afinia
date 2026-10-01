import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  horizon,
  lastLogicalIndex,
  positionLabel,
  positionsToGenerate,
  ruleFor,
  scheduledDate,
  summarize,
  validateEnd,
  type Schedule,
} from "./recurrence";

const base = (over: Partial<Schedule> = {}): Schedule => ({
  startDate: "2026-01-10",
  frequency: "MONTHLY",
  endMode: "NONE",
  occurrenceCount: null,
  untilDate: null,
  stopBeforeIndex: null,
  stoppedOn: null,
  ...over,
});

describe("datas", () => {
  it("mensal no dia 31 cai no último dia sem perder a referência", () => {
    expect([0, 1, 2, 3, 4].map((i) => scheduledDate("2026-01-31", "MONTHLY", i))).toEqual([
      "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31",
    ]);
  });

  it("anual em 29/02", () => {
    expect([0, 1, 2].map((i) => scheduledDate("2028-02-29", "YEARLY", i))).toEqual(["2028-02-29", "2029-02-28", "2030-02-28"]);
    expect(scheduledDate("2028-02-29", "YEARLY", 4)).toBe("2032-02-29");
  });

  it("semanal e virada de ano", () => {
    expect(scheduledDate("2026-12-29", "WEEKLY", 1)).toBe("2027-01-05");
    expect(scheduledDate("2026-11-15", "MONTHLY", 2)).toBe("2027-01-15");
  });

  it("horizonte é hoje + 12 meses de calendário, inclusive", () => {
    expect(horizon("2026-04-05")).toBe("2027-04-05");
    expect(horizon("2028-02-29")).toBe("2029-02-28");
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("término", () => {
  it("após N ocorrências", () => {
    const s = base({ startDate: "2026-05-05", endMode: "COUNT", occurrenceCount: 10 });
    expect(lastLogicalIndex(s)).toBe(9);
    expect(scheduledDate(s.startDate, s.frequency, 9)).toBe("2027-02-05");
  });

  it("até uma data, inclusive", () => {
    const s = base({ startDate: "2026-06-01", frequency: "WEEKLY", endMode: "UNTIL", untilDate: "2026-06-29" });
    const p = positionsToGenerate(s, "2099-01-01", 0);
    expect(p.map((i) => scheduledDate(s.startDate, s.frequency, i))).toEqual([
      "2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29",
    ]);
  });

  it("sem término é infinito; exclusão em escopo e encerramento limitam", () => {
    expect(lastLogicalIndex(base())).toBe(Infinity);
    expect(lastLogicalIndex(base({ stopBeforeIndex: 3 }))).toBe(2);
    // encerrado em 20/05/2026: 10/05 (índice 4) ainda vale, 10/06 não
    expect(lastLogicalIndex(base({ stoppedOn: "2026-05-20" }))).toBe(4);
    expect(lastLogicalIndex(base({ stoppedOn: "2026-01-10" }))).toBe(-1);
  });

  it("validações", () => {
    expect(validateEnd({ startDate: "2026-01-01", endMode: "COUNT", occurrenceCount: 1, untilDate: null })).toMatch("2 a 600");
    expect(validateEnd({ startDate: "2026-01-01", endMode: "COUNT", occurrenceCount: 601, untilDate: null })).toMatch("2 a 600");
    expect(validateEnd({ startDate: "2026-01-01", endMode: "UNTIL", occurrenceCount: null, untilDate: "2026-01-01" })).toMatch("posterior");
    expect(validateEnd({ startDate: "2026-01-01", endMode: "UNTIL", occurrenceCount: null, untilDate: "2056-01-02" })).toMatch("30 anos");
    expect(validateEnd({ startDate: "2026-01-01", endMode: "NONE", occurrenceCount: null, untilDate: null })).toBeNull();
  });
});

describe("janela de geração", () => {
  it("série finita que ultrapassa a janela gera só até o horizonte", () => {
    const s = base({ startDate: "2026-05-10", endMode: "COUNT", occurrenceCount: 24 });
    const p = positionsToGenerate(s, horizon("2026-05-01"), 0);
    expect(p).toHaveLength(12);
    expect(scheduledDate(s.startDate, s.frequency, p.at(-1)!)).toBe("2027-04-10");
  });

  it("aluguel sem término criado em 05/04/2026 vai até 10/03/2027", () => {
    const s = base({ startDate: "2026-04-10" });
    const p = positionsToGenerate(s, horizon("2026-04-05"), 0);
    expect(scheduledDate(s.startDate, s.frequency, p.at(-1)!)).toBe("2027-03-10");
  });

  it("retorno após meses continua de onde parou, incluindo vencidas", () => {
    const s = base({ startDate: "2026-01-05" });
    const first = positionsToGenerate(s, horizon("2026-01-05"), 0);
    const next = positionsToGenerate(s, horizon("2026-09-20"), first.at(-1)! + 1);
    expect(scheduledDate(s.startDate, s.frequency, next[0])).toBe("2027-02-05");
    expect(scheduledDate(s.startDate, s.frequency, next.at(-1)!)).toBe("2027-09-05");
  });
});

describe("regras e rótulos", () => {
  it("regra vigente por posição", () => {
    const rules = [{ fromIndex: 0, v: 1800 }, { fromIndex: 4, v: 1950 }];
    expect(ruleFor(rules, 3).v).toBe(1800);
    expect(ruleFor(rules, 4).v).toBe(1950);
    expect(ruleFor(rules, 40).v).toBe(1950);
  });

  it("rótulos", () => {
    expect(positionLabel(2, { endMode: "COUNT", occurrenceCount: 12, frequency: "MONTHLY" })).toBe("Ocorrência 3 de 12");
    expect(positionLabel(2, { endMode: "NONE", occurrenceCount: null, frequency: "WEEKLY" })).toBe("Recorrente · semanal");
  });
});

describe("resumo", () => {
  const occ = (index: number, status: "PENDING" | "EFFECTIVE") => ({ index, status, amountCents: 100 });

  it("série encerrada com pagamentos pendentes", () => {
    const s = base({ endMode: "COUNT", occurrenceCount: 10, stopBeforeIndex: 6 });
    const occurrences = [0, 1, 2, 3].map((i) => occ(i, "EFFECTIVE" as const)).concat([occ(5, "PENDING")]);
    expect(summarize(s, occurrences, new Set([4]), 5)).toEqual({
      programming: "ended", pendingCount: 1, pendingCents: 100, toGenerate: 0,
    });
  });

  it("restantes consideram exclusões e não subtraem efetivadas do total", () => {
    const s = base({ endMode: "COUNT", occurrenceCount: 12 });
    const occurrences = [0, 1, 2, 3].map((i) => occ(i, "EFFECTIVE" as const)).concat([5, 6, 7, 8, 9, 10, 11].map((i) => occ(i, "PENDING")));
    expect(summarize(s, occurrences, new Set([4]), 11)).toEqual({
      programming: "ended", pendingCount: 7, pendingCents: 700, toGenerate: 0,
    });
  });

  it("finita além da janela mostra previstas para geração", () => {
    const s = base({ endMode: "COUNT", occurrenceCount: 24 });
    expect(summarize(s, [], new Set(), 11)).toMatchObject({ programming: "active", toGenerate: 12 });
  });
});
