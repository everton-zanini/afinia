import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  formatDate,
  formatDayHeading,
  fromDbDate,
  isISODate,
  monthRange,
  toDbDate,
  todayISO,
} from "./dates";

describe("todayISO", () => {
  it("usa o fuso de São Paulo na virada do dia em UTC", () => {
    // 02:30 UTC de 01/04 = 23:30 de 31/03 em São Paulo (UTC−3)
    expect(todayISO(new Date("2026-04-01T02:30:00Z"))).toBe("2026-03-31");
    expect(todayISO(new Date("2026-04-01T03:30:00Z"))).toBe("2026-04-01");
  });
});

describe("conversões de banco", () => {
  it("ida e volta sem deslocamento", () => {
    expect(fromDbDate(toDbDate("2026-02-28"))).toBe("2026-02-28");
    expect(toDbDate("2026-03-01").toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("valida datas reais", () => {
    expect(isISODate("2026-02-29")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(() => toDbDate("31/03/2026")).toThrow();
  });
});

describe("meses", () => {
  it("navega e calcula intervalos", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-03", -6)).toBe("2025-09");
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02").to).toBe("2028-02-29");
    expect(addDays("2026-03-31", 1)).toBe("2026-04-01");
  });

  it("formata em português", () => {
    expect(formatDate("2026-03-31")).toBe("31/03/2026");
    expect(formatDayHeading("2026-03-31")).toBe("terça, 31 de março");
  });
});
