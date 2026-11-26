import { describe, expect, it } from "vitest";
import { addDaysISO, diffDays, formatCurrency, formatDate, formatPercent, parseBRNumber, relativeDays, toLocalInput, todayISO } from "@/lib/format";

describe("formatação brasileira", () => {
  it("formata moeda em reais", () => {
    expect(formatCurrency(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
    expect(formatCurrency(null)).toBe("—");
  });

  it("formata datas puras sem deslocamento de fuso", () => {
    expect(formatDate("2026-03-01")).toBe("01/03/2026");
  });

  it("formata instantes no fuso de São Paulo", () => {
    // 02:30 UTC = 23:30 do dia anterior em São Paulo (UTC-3)
    expect(formatDate("2026-06-10T02:30:00Z", "America/Sao_Paulo")).toBe("09/06/2026");
    expect(toLocalInput("2026-06-10T02:30:00Z", "America/Sao_Paulo")).toBe("2026-06-09T23:30");
  });

  it("interpreta números digitados no padrão brasileiro", () => {
    expect(parseBRNumber("1.234,56")).toBe(1234.56);
    expect(parseBRNumber("R$ 9,90")).toBe(9.9);
    expect(parseBRNumber("12.5")).toBe(12.5);
    expect(parseBRNumber("5.000")).toBe(5000);
    expect(parseBRNumber("1.250.000")).toBe(1250000);
    expect(parseBRNumber("0.125")).toBe(0.125); // zero à esquerda nunca é grupo de milhar
    expect(parseBRNumber("")).toBeNull(); // ausente nunca vira zero
    expect(parseBRNumber("abc")).toBeNull();
  });

  it("calcula dias e textos relativos", () => {
    expect(addDaysISO("2026-02-27", 3)).toBe("2026-03-02");
    expect(diffDays("2026-01-01", "2026-01-31")).toBe(30);
    expect(relativeDays("2026-01-02", "2026-01-01")).toBe("amanhã");
    expect(relativeDays("2026-01-01", "2026-01-05")).toBe("há 4 dias");
    expect(formatPercent(33.333, 1)).toBe("33,3%");
  });

  it("calcula a data de hoje no fuso informado", () => {
    expect(todayISO("America/Sao_Paulo", new Date("2026-01-01T02:00:00Z"))).toBe("2025-12-31");
  });
});
