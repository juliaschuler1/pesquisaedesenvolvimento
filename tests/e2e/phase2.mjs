/**
 * Aceitação da Fase 2 (fornecedores, importação, embalagens, bibliotecas).
 *   BASE_URL=http://localhost:3000 node tests/e2e/phase2.mjs [pasta-de-screenshots] [planilha-real.xlsx]
 * Sem a planilha real, gera uma planilha sintética no mesmo formato (matriz fornecedor × tipo de produto).
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import writeXlsxFile from "write-excel-file/node";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.argv[2];
const REAL = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const stamp = Date.now();
const password = "senha-aceite-123";

const H = ["FORNECEDOR", "AVALIAÇÃO QUALIDADE\n2018", "AEROSSOL", "BASE E CORRETIVO LIQUIDO", "BATOM LÍQUIDO E GLOSS"];
const c = (v) => (v === null ? null : { value: v });
const rows = [
  [c("CONTROLE DE FORNECEDORES"), null, null, null, null],
  [null, null, null, null, null],
  H.map(c),
  [c("Fábrica Alfa"), c("Aprovado"), c("Apto"), c("Apto"), null],
  [c("Fábrica Beta"), c("Aprovado Condicionalmente"), null, c("Em avaliação"), c("Apto")],
  [c("EMBALAGENS / INSUMO"), null, null, null, null],
  H.map(c),
  [c("Embalagens Gama"), c("Pendente"), null, null, c("Apto")],
];
const sheetPath = join(tmpdir(), `fornecedores-${stamp}.xlsx`);
await writeXlsxFile(rows).toFile(sheetPath);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64");
const photoPath = join(tmpdir(), `frasco-${stamp}.png`);
writeFileSync(photoPath, png);

let step = 0;
const ok = (m) => console.log(`✓ ${++step}. ${m}`);
const shot = async (p, n) => SHOTS && p.screenshot({ path: join(SHOTS, `${n}.png`), fullPage: true });
const toast = (p, t) => p.getByRole("status").filter({ hasText: t }).first().waitFor({ timeout: 20000 });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, timezoneId: "America/Sao_Paulo" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

try {
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.fill("#fullName", "Consultora Fase Dois");
  await page.fill("#email", `fase2+${stamp}@teste.local`);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL("**/bem-vinda");
  await page.fill("#name", "Studio Fase 2");
  await page.getByRole("button", { name: "Criar meu estúdio" }).click();
  await page.waitForURL("**/dashboard");
  ok("Workspace criado");

  // Fornecedor manual que coincide com a planilha (testa atualização sem sobrescrever)
  await page.goto(`${BASE}/fornecedores/novo`);
  await page.fill("#name", "Fábrica Alfa");
  await page.fill("#city", "Diadema");
  await page.fill("#internal_notes", "NEGOCIACAO-CONFIDENCIAL");
  await page.getByRole("button", { name: "Criar fornecedor" }).click();
  await page.waitForURL(/\/fornecedores\/[0-9a-f-]{36}$/);
  const alfaUrl = page.url();
  ok("Fornecedor cadastrado manualmente");

  // Importação (critério 4)
  await page.goto(`${BASE}/importacao`);
  await page.waitForLoadState("networkidle");
  await page.setInputFiles('input[aria-label="Arquivo da planilha"]', REAL ?? sheetPath);
  await page.getByText(/2\. Conferir a leitura/).waitFor();
  await page.locator("span", { hasText: /^EMBALAGENS \/ INSUMO$/ }).waitFor();
  if (!REAL) {
    await page.getByLabel("Destino da coluna AEROSSOL").waitFor();
    const v = await page.getByLabel("Destino da coluna AEROSSOL").inputValue();
    if (v !== "capability") throw new Error("Coluna AEROSSOL deveria ser capacidade, veio " + v);
  }
  await shot(page, "importacao-mapeamento");
  await page.getByRole("button", { name: "Pré-visualizar" }).click();
  await page.getByText("3. Pré-visualização").waitFor();
  await page.getByText(/já cadastrado como “Fábrica Alfa”/).first().waitFor();
  await shot(page, "importacao-previa");
  await page.getByRole("button", { name: /^Importar \d+ registros$/ }).click();
  await page.getByText("Importação concluída").waitFor({ timeout: 30000 });
  ok("Planilha em matriz importada (seções, avaliação e capacidades)");

  // Alfa: cidade preservada, aptidão adicionada, nota interna intacta
  await page.goto(alfaUrl);
  await page.getByText("Diadema").first().waitFor();
  await page.getByText("NEGOCIACAO-CONFIDENCIAL").waitFor();
  await page.getByText("Aerossol", { exact: true }).waitFor();
  await page.getByText(/Qualidade: Aprovado/).waitFor();
  ok("Registro existente atualizado sem sobrescrever dados");

  // Filtro por aptidão
  await page.goto(`${BASE}/terceiristas?capacidade=${encodeURIComponent("Batom líquido e gloss")}`);
  await page.getByRole("heading", { name: "Fábrica Beta" }).waitFor();
  if (await page.getByRole("heading", { name: "Embalagens Gama" }).count()) throw new Error("Gama é de embalagens, não deveria aparecer em terceiristas");
  ok("Filtro de terceiristas por aptidão");
  await shot(page, "terceiristas");

  // Desfazer importação
  await page.goto(`${BASE}/importacao`);
  await page.getByRole("button", { name: "Desfazer" }).first().click();
  await page.getByRole("button", { name: "Desfazer importação" }).click();
  await toast(page, "Importação desfeita");
  await page.goto(`${BASE}/fornecedores`);
  await page.getByRole("heading", { name: "Fábrica Alfa" }).waitFor();
  if (await page.getByRole("heading", { name: "Fábrica Beta" }).count()) throw new Error("Beta deveria ter sido removida ao desfazer");
  await page.goto(alfaUrl);
  if (await page.getByText(/Qualidade: Aprovado/).count()) throw new Error("Status de qualidade deveria ter voltado ao anterior");
  ok("Importação desfeita: criados removidos e existente restaurado");

  // Reimporta para seguir
  await page.goto(`${BASE}/importacao`);
  await page.waitForLoadState("networkidle");
  await page.setInputFiles('input[aria-label="Arquivo da planilha"]', REAL ?? sheetPath);
  await page.getByRole("button", { name: "Pré-visualizar" }).click();
  await page.getByRole("button", { name: /^Importar \d+ registros$/ }).click();
  await page.getByText("Importação concluída").waitFor({ timeout: 30000 });

  // Embalagem com foto (critério 5)
  await page.goto(`${BASE}/embalagens/novo`);
  await page.getByRole("radio", { name: "Frasco de gloss" }).click();
  await page.fill("#name", "Frasco gloss 6 ml");
  await page.fill("#code", `GL-${stamp}`);
  await page.selectOption("#supplier_id", { label: "Embalagens Gama" });
  await page.selectOption("#material", "PETG");
  await page.fill("#capacity", "6");
  await page.fill("#unit_cost", "1,35");
  await page.waitForLoadState("networkidle");
  await page.setInputFiles("#photo", photoPath);
  await page.getByRole("button", { name: "Criar embalagem" }).click();
  await page.waitForURL(/\/embalagens\/[0-9a-f-]{36}$/);
  await page.getByRole("heading", { name: "Frasco gloss 6 ml" }).waitFor();
  await page.getByText("R$ 1,35").first().waitFor();
  if (await page.getByText(/Imagem ilustrativa do tipo/).count()) throw new Error("Com foto real não deve mostrar imagem ilustrativa");
  ok("Embalagem cadastrada com foto real, tipo visual e fornecedor");
  await shot(page, "embalagem");

  await page.goto(`${BASE}/embalagens?tipo=${encodeURIComponent("Frasco de gloss")}`);
  await page.getByText("Frasco gloss 6 ml").waitFor();
  await shot(page, "biblioteca-embalagens");
  ok("Biblioteca filtrada pelo tipo visual");

  // Biblioteca técnica
  await page.goto(`${BASE}/ativos`);
  await page.getByRole("button", { name: "Adicionar" }).first().click();
  await page.fill("#li-name", "Niacinamida");
  await page.selectOption("#li-cat", "Seborregulador");
  await page.fill("#li-src", "Ficha técnica");
  await page.locator("dialog[open]").getByRole("button", { name: "Adicionar", exact: true }).click();
  await toast(page, "Item adicionado à biblioteca.");
  await page.getByRole("heading", { name: "Niacinamida" }).waitFor();
  ok("Item de biblioteca técnica criado");

  // Busca global encontra fornecedor e embalagem
  await page.getByLabel("Pesquisa global").fill("Gama");
  await page.getByRole("option", { name: /Embalagens Gama/ }).waitFor();
  ok("Busca global inclui fornecedores");

  // Isolamento
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/login`);
  await p2.getByRole("button", { name: "Criar conta" }).click();
  await p2.fill("#email", `intrusa2+${stamp}@teste.local`);
  await p2.fill("#password", password);
  await p2.getByRole("button", { name: "Criar conta" }).click();
  await p2.waitForURL("**/bem-vinda");
  await p2.fill("#name", "Outro");
  await p2.getByRole("button", { name: "Criar meu estúdio" }).click();
  await p2.waitForURL("**/dashboard");
  await p2.goto(alfaUrl);
  await p2.getByText("Página não encontrada").waitFor();
  await p2.goto(`${BASE}/fornecedores`);
  await p2.getByText("Nenhum fornecedor ainda").waitFor();
  if ((await p2.content()).includes("NEGOCIACAO-CONFIDENCIAL")) throw new Error("Vazamento de nota interna");
  await ctx2.close();
  ok("Outro workspace não vê fornecedores nem negociações");

  if (errors.length) throw new Error("Erros de JavaScript: " + errors.join(" | "));
  console.log(`\nAceite Fase 2: ${step} verificações aprovadas.`);
} catch (e) {
  console.error(`✗ Falhou após ${step} verificações:`, e.message);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, "falha-f2.png"), fullPage: true });
  process.exitCode = 1;
} finally {
  await browser.close();
}
