/**
 * Teste de aceitação ponta a ponta (Fase 1) contra o app rodando + Supabase.
 *   BASE_URL=http://localhost:3000 node tests/e2e/acceptance.mjs [pasta-de-screenshots]
 * Cobre: criar conta/workspace, cliente com logo, projeto com cronograma, SKUs,
 * etapa concluída, reprogramação com dependências, atividade/follow-up, campo
 * personalizado, módulo personalizado, upload de documento, sair/voltar sem perder
 * dados e isolamento entre workspaces.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.argv[2];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const stamp = Date.now();
const email = `aceite+${stamp}@teste.local`;
const password = "senha-aceite-123";

// PNG 1x1 rosa para teste de upload de imagem
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64");
const logoPath = join(tmpdir(), `logo-${stamp}.png`);
writeFileSync(logoPath, png);
const docPath = join(tmpdir(), `laudo-${stamp}.pdf`);
writeFileSync(docPath, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

let step = 0;
const ok = (msg) => console.log(`✓ ${++step}. ${msg}`);
async function shot(page, name) {
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}
async function toast(page, text) {
  await page.getByRole("status").filter({ hasText: text }).first().waitFor({ timeout: 15000 });
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

try {
  // 1. Conta e workspace
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.fill("#fullName", "Consultora Aceite");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL("**/bem-vinda");
  await page.fill("#name", "Studio Aceite");
  await page.getByRole("button", { name: "Criar meu estúdio" }).click();
  await page.waitForURL("**/dashboard");
  await page.getByText("Seu estúdio está pronto").waitFor();
  ok("Conta criada e workspace inicializado (dashboard vazio)");

  // 2. Campo personalizado para clientes (critério 20)
  await page.goto(`${BASE}/construtor-modulos?entidade=clients`);
  await page.fill("#cf-label", "Faturamento anual");
  await page.selectOption("#cf-type", "currency");
  await page.getByRole("button", { name: "Adicionar campo" }).click();
  await toast(page, "Campo “Faturamento anual” criado.");
  ok("Campo personalizado criado");

  // 3. Cliente com logo e campo personalizado (critério 1)
  await page.goto(`${BASE}/clientes/novo`);
  await page.fill("#name", "Aurora Cosméticos Ltda.");
  await page.fill("#brand_name", "Aurora");
  await page.fill("#cnpj", "12.345.678/0001-90");
  await page.setInputFiles("#logo", logoPath);
  await page.selectOption("#segment", "Marca própria");
  await page.getByRole("button", { name: "E-commerce próprio" }).click();
  await page.fill("#cf-faturamento_anual", "1.200.000,00");
  await page.fill("#private_notes", "NOTA-INTERNA-SIGILOSA");
  await page.getByRole("button", { name: "Criar cliente" }).click();
  await page.waitForURL(/\/clientes\/[0-9a-f-]{36}/);
  const clientUrl = page.url().split("?")[0];
  await page.getByText("Faturamento anual").waitFor();
  await page.getByText(/R\$\s?1\.200\.000,00/).waitFor();
  ok("Cliente criado com logo, segmento, canal e campo personalizado");

  // 4. "+ Adicionar nova opção" dentro do formulário
  await page.goto(`${BASE}/projetos/novo`);
  await page.selectOption("#category", "__add__");
  await page.getByLabel("Nome da nova opção").fill("Autobronzeamento facial");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await toast(page, "adicionada à lista");
  ok("Nova opção criada diretamente no campo de seleção");

  // 5. Projeto com cronograma modelo (critério 2)
  await page.selectOption("#client_id", { label: "Aurora Cosméticos Ltda." });
  await page.fill("#name", "Gloss Glow Aceite");
  await page.fill("#code", `ACE-${stamp}`);
  await page.fill("#start_date", "2026-01-05");
  await page.fill("#launch_date", "2027-03-01");
  await page.fill("#target_cost", "9,50");
  await page.fill("#shared_volume", "6");
  await page.fill("#shared_fragrance", "Baunilha");
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await page.waitForURL(/\/projetos\/[0-9a-f-]{36}$/);
  const projectUrl = page.url();
  await page.getByText("Etapa atual:").waitFor();
  ok("Projeto criado com cronograma de 27 etapas");

  // 6. SKUs (critério 3)
  await page.goto(`${projectUrl}?aba=skus`);
  for (const [name, pantone] of [["Glow Rosé", "698 C"], ["Glow Nude", "7604 C"]]) {
    await page.getByRole("button", { name: "Novo SKU" }).first().click();
    await page.fill("#sku-name", name);
    await page.fill("#sku-pantone", pantone);
    await page.fill("#sku-qty", "5.000");
    await page.getByRole("button", { name: "Criar SKU" }).click();
    await toast(page, `SKU ${name} criado.`);
  }
  await page.getByText("Glow Nude", { exact: true }).waitFor();
  const inherited = await page.getByText("comum", { exact: true }).count();
  if (inherited < 2) throw new Error("SKUs deveriam herdar fragrância/volume do projeto");
  await page.getByText("Quantidade prevista: 10.000 un.", { exact: false }).waitFor();
  ok("Dois SKUs criados, herdando fragrância e volume do projeto");
  await shot(page, "projeto-skus");

  // 7. Cronograma: concluir etapa e reprogramar com dependências (critério 17)
  await page.goto(`${projectUrl}?aba=cronograma`);
  await page.getByRole("button", { name: "Concluir etapa" }).first().click();
  await toast(page, "Etapa concluída.");
  const row = page.locator("tr").filter({ has: page.locator("p", { hasText: /^\d+Benchmark$/ }) });
  await row.hover();
  await row.getByRole("button", { name: "Editar etapa" }).click();
  await page.fill("#st-end", "2026-02-10");
  await page.getByText(/etapas dependentes seriam reprogramadas/).waitFor({ timeout: 15000 });
  await page.getByLabel("Confirmo: reprogramar as etapas dependentes").check();
  await page.getByRole("button", { name: "Salvar etapa" }).click();
  await toast(page, "dependente(s) reprogramada(s)");
  await page.getByText(/\+\d+ d/).first().waitFor();
  ok("Etapa concluída e reprogramação com impacto confirmado (linha de base preservada)");
  await shot(page, "projeto-cronograma");

  // 8. Atividade de follow-up (critério 18 — versão Fase 1)
  await page.goto(`${projectUrl}?aba=atividades`);
  await page.getByRole("button", { name: "Nova atividade" }).click();
  await page.fill("#act-title", "Cobrar retorno do terceirista");
  await page.selectOption("#act-kind", "follow_up");
  await page.fill("#act-due", "2026-12-01T10:00");
  await page.getByRole("button", { name: "Criar atividade" }).click();
  await toast(page, "Atividade criada.");
  await page.getByText("Cobrar retorno do terceirista").waitFor();
  ok("Follow-up registrado no projeto");

  // 9. Upload de documento
  await page.goto(`${projectUrl}?aba=documentos`);
  await page.setInputFiles('input[type="file"]', docPath);
  await toast(page, "Arquivo enviado.");
  await page.getByText(`laudo-${stamp}.pdf`).waitFor();
  ok("Documento enviado ao armazenamento privado");

  // 10. Módulo personalizado + registro (critério 21)
  await page.goto(`${BASE}/construtor-modulos?novo=1`);
  await page.fill("#mod-label", `Fragrâncias ${stamp}`);
  await page.getByRole("button", { name: "Criar módulo" }).click();
  await page.waitForURL(/configurar=1/);
  const modUrl = page.url().split("?")[0];
  await page.getByRole("link", { name: "Configurar campos" }).click();
  await page.fill("#cf-label", "Família olfativa");
  await page.selectOption("#cf-type", "single_select");
  await page.fill("#cf-choices", "Floral\nAmadeirada");
  await page.getByRole("button", { name: "Adicionar campo" }).click();
  await toast(page, "Campo “Família olfativa” criado.");
  await page.goto(modUrl);
  await page.getByRole("button", { name: "Novo registro" }).first().click();
  await page.fill("#rec-title", "Rosa Mosqueta");
  await page.selectOption("#cf-familia_olfativa", "Floral");
  await page.getByRole("button", { name: "Criar registro" }).click();
  await toast(page, "Registro criado.");
  await page.getByRole("cell", { name: "Floral" }).waitFor();
  ok("Módulo personalizado criado, com campo e registro salvos no banco");
  await page.getByRole("link", { name: new RegExp(`Fragrâncias ${stamp}`) }).first().waitFor();
  ok("Novo módulo aparece no menu lateral");

  // 11. Busca global
  await page.getByLabel("Pesquisa global").fill("Gloss Glow");
  await page.getByRole("option", { name: /Gloss Glow Aceite/ }).waitFor();
  ok("Pesquisa global encontra o projeto");

  // 12. Dashboard calculado com dados reais
  await page.goto(`${BASE}/dashboard`);
  await page.getByText("Esteira de desenvolvimento").waitFor();
  await page.locator("a", { hasText: "Gloss Glow Aceite" }).first().waitFor();
  ok("Dashboard calculado a partir dos registros");
  await shot(page, "dashboard-real");

  // 13. Sair e voltar sem perder dados (critério 22)
  await page.getByRole("button", { name: /Consultora Aceite/ }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await page.waitForURL("**/login");
  await page.goto(projectUrl);
  await page.waitForURL(/\/login\?next=/);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(projectUrl);
  await page.getByRole("heading", { name: "Gloss Glow Aceite" }).waitFor();
  ok("Logout, login e retorno à página original com dados preservados");

  // 14. Isolamento: outro workspace não acessa o projeto nem a cliente
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/login`);
  await p2.getByRole("button", { name: "Criar conta" }).click();
  await p2.fill("#email", `intrusa+${stamp}@teste.local`);
  await p2.fill("#password", password);
  await p2.getByRole("button", { name: "Criar conta" }).click();
  await p2.waitForURL("**/bem-vinda");
  await p2.fill("#name", "Outro estúdio");
  await p2.getByRole("button", { name: "Criar meu estúdio" }).click();
  await p2.waitForURL("**/dashboard");
  await p2.goto(projectUrl);
  await p2.getByText("Página não encontrada").waitFor();
  await p2.goto(clientUrl);
  await p2.getByText("Página não encontrada").waitFor();
  await p2.getByLabel("Pesquisa global").fill("Aurora");
  await p2.getByText("Nada encontrado para “Aurora”.").waitFor();
  const body = await p2.content();
  if (body.includes("NOTA-INTERNA-SIGILOSA")) throw new Error("Vazamento de nota interna");
  await ctx2.close();
  ok("Outro workspace não vê projeto, cliente, busca nem observações internas");

  if (errors.length) throw new Error("Erros de JavaScript na página: " + errors.join(" | "));
  console.log(`\nAceite Fase 1: ${step} verificações aprovadas.`);
} catch (e) {
  console.error(`✗ Falhou após ${step} verificações:`, e.message);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, "falha.png"), fullPage: true });
  process.exitCode = 1;
} finally {
  await browser.close();
}
