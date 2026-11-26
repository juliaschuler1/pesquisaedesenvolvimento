import { describe, expect, it } from "vitest";
import { displayCustomValue, readCustomData, type CustomField } from "@/lib/custom-fields";
import { themeToStyle } from "@/lib/theme";

const base = { id: "x", entity: "clients", section: null, position: 0, required: false, settings: {}, visibility: "internal" as const, archived_at: null, version: 1 };
const f = (o: Partial<CustomField>): CustomField => ({ ...base, key: "k", label: "K", field_type: "short_text", ...o });

describe("campos personalizados", () => {
  it("lê e valida tipos", () => {
    const fd = new FormData();
    fd.set("cf_custo", "1.250,90");
    fd.set("cf_familia", "Floral");
    fd.append("cf_tags", "A");
    fd.append("cf_tags", "Z"); // fora das opções: descartado
    fd.set("cf_site", "marca.com");
    const fields = [
      f({ key: "custo", field_type: "currency" }),
      f({ key: "familia", field_type: "single_select", settings: { choices: ["Floral", "Cítrica"] } }),
      f({ key: "tags", field_type: "multi_select", settings: { choices: ["A", "B"] } }),
      f({ key: "site", field_type: "link" }),
      f({ key: "obrig", required: true }),
    ];
    const { data, errors } = readCustomData(fd, fields, { antigo: "mantido" });
    expect(data).toMatchObject({ custo: 1250.9, familia: "Floral", tags: ["A"], site: "https://marca.com", antigo: "mantido" });
    expect(errors).toEqual({ cf_obrig: "Obrigatório." });
  });

  it("ignora campos arquivados e preserva valores antigos", () => {
    const { data } = readCustomData(new FormData(), [f({ key: "velho", archived_at: "2026-01-01" })], { velho: "valor" });
    expect(data).toEqual({ velho: "valor" });
  });

  it("exibe valores formatados", () => {
    expect(displayCustomValue(f({ field_type: "checkbox" }), true)).toBe("Sim");
    expect(displayCustomValue(f({ field_type: "date" }), "2026-02-03")).toBe("03/02/2026");
    expect(displayCustomValue(f({}), null)).toBe("—");
  });
});

describe("tema personalizável", () => {
  it("aceita apenas cores hexadecimais válidas", () => {
    expect(themeToStyle({ deep: "#AA0000", ink: "red; background:url(x)" })).toEqual({ "--brand-deep": "#AA0000" });
  });
});
