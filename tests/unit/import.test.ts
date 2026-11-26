import { describe, expect, it } from "vitest";
import { autoMap, buildRecords, capabilityStatus, detectHeaderRow, detectSections, matchOption, mergeDuplicates, NO_SECTION, qualityStatus, type Grid } from "@/lib/import/engine";
import { TARGETS } from "@/lib/import/targets";

// Planilha sintética no mesmo formato "em matriz" usado por consultorias (fornecedor × tipo de produto)
const grid: Grid = [
  [null, null, null, null],
  ["CONTROLE DE FORNECEDORES", null, null, null],
  [null, null, null, null],
  ["FORNECEDOR", "AVALIAÇÃO QUALIDADE\n2019", "AEROSSOL", "BATOM /CORRETIVO\nBALA"],
  ["Fábrica Alfa", "Aprovado", "Apto", null],
  ["Fábrica Beta", "Aprovado Condicionalmente", "Em avaliação", "Apto"],
  ["EMBALAGENS / INSUMO", null, null, null],
  ["FORNECEDOR", "AVALIAÇÃO QUALIDADE\n2019", "AEROSSOL", "BATOM /CORRETIVO\nBALA"],
  ["Embalagens Gama", "Pendente", null, "Suspenso"],
  ["Fábrica Alfa", null, null, "N/A"],
  ["Sem Status", "Talvez", "Xpto", null],
];

describe("importação em matriz", () => {
  it("detecta cabeçalho, seções e ano da avaliação", () => {
    const h = detectHeaderRow(grid);
    expect(h).toBe(3);
    expect(detectSections(grid, h)).toEqual([NO_SECTION, "EMBALAGENS / INSUMO"]);
    const m = autoMap(TARGETS.suppliers, grid, h, ["Batom e corretivo bala"]);
    expect(m.qualityYear).toBe(2019);
    expect(m.columns.map((c) => c.mode)).toEqual(["field", "field", "capability", "capability"]);
    expect(m.columns[3].capability).toBe("Batom e corretivo bala"); // casou com a opção existente
    expect(m.columns[2].capability).toBe("Aerossol");
  });

  it("gera registros com categoria por seção, capacidades e mescla repetidos", () => {
    const h = detectHeaderRow(grid);
    const m = autoMap(TARGETS.suppliers, grid, h);
    m.sectionCategories = { [NO_SECTION]: "Fabricantes terceiristas", "EMBALAGENS / INSUMO": "Fornecedores de embalagens primárias" };
    const recs = mergeDuplicates(buildRecords(TARGETS.suppliers, grid, m));
    expect(recs).toHaveLength(4); // Alfa aparece 2x e é mesclada
    const alfa = recs.find((r) => r.key === "fabrica alfa")!;
    expect(alfa.data.categories).toEqual(["Fabricantes terceiristas", "Fornecedores de embalagens primárias"]);
    expect(alfa.capabilities).toEqual({ Aerossol: "apto", "Batom/corretivo bala": "na" });
    expect(alfa.data.quality_status).toBe("approved");
    expect(alfa.data.quality_evaluated_year).toBe(2019);
    const sem = recs.find((r) => r.key === "sem status")!;
    expect(sem.warnings.length).toBe(2); // status e capacidade não reconhecidos viram aviso, nunca dado inventado
    expect(sem.data.quality_status).toBeUndefined();
  });

  it("normaliza valores", () => {
    expect(capabilityStatus("APTO")).toBe("apto");
    expect(capabilityStatus("x")).toBe("apto");
    expect(capabilityStatus("N/A")).toBe("na");
    expect(capabilityStatus("")).toBeNull();
    expect(qualityStatus("Reprovado condicionalmente")).toBe("rejected_conditional");
    expect(qualityStatus("")).toBeNull();
    expect(qualityStatus("Ótimo")).toBeUndefined();
    expect(matchOption("BASE E CORRETIVO LIQUIDO", ["Base e corretivo líquido"])).toBe("Base e corretivo líquido");
    expect(matchOption("Esmalte vidro e tampa", ["Esmalte"])).toBeNull();
  });
});
