/* Beauty Development Studio — painel pessoal.
   Site estático (GitHub Pages). Os dados ficam no navegador (IndexedDB), nunca no GitHub. */
(() => {
"use strict";

/* ===================== vocabulário ===================== */
const STAGES = ["Pesquisa", "Briefing", "Fornecedores", "Amostras", "Testes", "Embalagem e arte", "Regularização", "Produção", "Lançado"];
const ACT_TYPES = ["Tarefa", "Reunião", "Follow-up", "Visita técnica", "Aprovação", "Prazo"];
const QUALITY = ["Aprovado", "Aprovado condicionalmente", "Reprovado condicionalmente", "Reprovado", "Pendente"];
const SUP_CATS = ["Fabricante terceirista", "Embalagens", "Matérias-primas", "Fragrâncias", "Laboratório de testes", "Gráfica e rotulagem", "Serviços regulatórios", "Outros"];
const CAPS = ["Aerossol", "Base e corretivo líquido", "Batom e corretivo bala", "Batom líquido e gloss", "Compactados e sombras", "Esmalte", "Glitters e pigmentos", "Lápis e lapiseiras", "Líquidos", "Máscara e delineador", "Toalha demaquilante", "Caneta delineadora", "Pó solto", "Skincare", "Bodycare", "Haircare", "Perfumaria"];
const CATEGORIES = ["Maquiagem", "Skincare", "Bodycare", "Haircare", "Perfumaria", "Esmaltes", "Autobronzeamento"];
const PK_TYPES = [["Bisnaga","bisnaga"],["Bisnaga com ponteira","bisnaga-ponteira"],["Bisnaga com aplicador","bisnaga-aplicador"],["Frasco pump","frasco-pump"],["Airless","airless"],["Frasco spray","frasco-spray"],["Spray gatilho","spray-gatilho"],["Conta-gotas","conta-gotas"],["Frasco de base","frasco-base"],["Frasco de perfume","frasco-perfume"],["Roll-on","roll-on"],["Stick","stick"],["Pote","pote"],["Pote de vidro","pote-vidro"],["Pó solto","po-solto"],["Compacto","compacto"],["Paleta","paleta"],["Batom bala","batom-bala"],["Balm em stick","balm-stick"],["Frasco de gloss","frasco-gloss"],["Frasco de batom líquido","batom-liquido"],["Máscara de cílios","mascara-cilios"],["Delineador","delineador"],["Lapiseira","lapiseira"],["Frasco","frasco"],["Ampola/monodose","ampola"]];
const PK_IMG = Object.fromEntries(PK_TYPES.map(([l, f]) => [l, `img/embalagens/${f}.webp`]));
const MATERIALS = ["Vidro", "PET", "PETG", "PP", "PE", "PEAD", "ABS", "SAN", "Alumínio", "PCR", "Acrílico"];
const COLS = ["projetos", "atividades", "fornecedores", "clientes", "embalagens"];

/* ===================== utilidades ===================== */
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const TZ = "America/Sao_Paulo";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diff = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 864e5);
const br = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");
const dayLabel = (iso) => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z"));
const money = (n) => (n === "" || n == null || isNaN(n) ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n));
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const parseNum = (v) => { const s = String(v ?? "").trim().replace(/\s|R\$/g, ""); if (!s) return ""; const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : /^[1-9]\d{0,2}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s); return isFinite(n) ? n : ""; };
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3200); }

/* ===================== armazenamento (IndexedDB) ===================== */
const DB_NAME = "beauty-dev-studio", KEY = "estado-v1";
const S = { projetos: [], atividades: [], fornecedores: [], clientes: [], embalagens: [], meta: {} };
function idb() {
  return new Promise((res, rej) => { const r = indexedDB.open(DB_NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function load() {
  try {
    const db = await idb();
    const v = await new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(KEY); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    if (v) for (const k of [...COLS, "meta"]) S[k] = v[k] ?? S[k];
  } catch { toast("Não foi possível abrir os dados deste navegador."); }
}
let saving = Promise.resolve();
function save() {
  const snap = JSON.parse(JSON.stringify(S));
  saving = saving.then(async () => {
    try { const db = await idb(); await new Promise((res, rej) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(snap, KEY); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
    catch { toast("Atenção: não foi possível salvar. Faça um backup em Dados e backup."); }
  });
  return saving;
}
const byId = (c, id) => S[c].find((x) => x.id === id);

/* ===================== regras ===================== */
const stageIdx = (p) => Math.max(0, STAGES.indexOf(p.etapa));
const progress = (p) => (p.etapa === "Lançado" || p.status === "Concluído" ? 100 : Math.round((stageIdx(p) / (STAGES.length - 1)) * 100));
const isOpen = (p) => p.status !== "Concluído" && p.status !== "Cancelado";
const isLate = (p, t) => isOpen(p) && p.status !== "Pausado" && p.etapa !== "Lançado" && p.lancamento && p.lancamento < t;
const actOpen = (a) => !a.feita;

/* ===================== navegação ===================== */
const NAV = [
  ["Visão geral", [["", "Dashboard", "◆"], ["agenda", "Agenda", "◷"], ["atividades", "Atividades", "✓"]]],
  ["Gestão", [["projetos", "Projetos", "❖", "projetos"], ["clientes", "Clientes", "☺", "clientes"]]],
  ["Banco de conhecimento", [["fornecedores", "Fornecedores", "✦", "fornecedores"], ["embalagens", "Embalagens", "❀", "embalagens"]]],
  ["Ajustes", [["dados", "Dados e backup", "⇩"]]],
];
function renderNav(route) {
  $("#nav").innerHTML = NAV.map(([g, items]) => `<div class="grp">${g}</div>` + items.map(([r, l, ic, col]) => `<a href="#/${r}" ${route === r ? 'aria-current="page"' : ""}><span class="ic" aria-hidden="true">${ic}</span>${l}${col ? `<span class="count">${S[col].length || ""}</span>` : ""}</a>`).join("")).join("");
}
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  const [r, id] = h.split("/");
  renderNav(r === "projeto" ? "projetos" : r || "");
  const v = $("#view");
  const views = { "": viewDashboard, agenda: viewAgenda, atividades: viewAtividades, projetos: viewProjetos, projeto: () => viewProjeto(id), clientes: viewClientes, fornecedores: viewFornecedores, embalagens: viewEmbalagens, dados: viewDados };
  v.innerHTML = (views[r] ?? viewDashboard)();
  $("#side").classList.remove("open"); $("#scrim").hidden = true;
  if (v.dataset.r !== h) { v.dataset.r = h; window.scrollTo(0, 0); }
}
window.addEventListener("hashchange", route);
const rerender = () => route();

/* ===================== componentes ===================== */
function pipeline(list, t) {
  if (!list.length) return `<div class="empty"><h3>Nenhum projeto em aberto</h3><p>Cadastre um projeto e acompanhe cada etapa até o lançamento.</p><button class="btn" data-new="projetos">Novo projeto</button></div>`;
  return `<ul class="pipe">${list.map((p) => {
    const i = stageIdx(p), c = byId("clientes", p.clienteId), lt = isLate(p, t);
    const segs = STAGES.map((s, k) => `<span class="${p.etapa === "Lançado" || k < i ? "s-done" : k === i ? "s-now" : "s-todo"}" title="${esc(s)}"></span>`).join("");
    return `<li data-go="#/projeto/${esc(p.id)}" tabindex="0"><div><div class="nm">${esc(p.nome)}</div><div class="mt">${esc(c?.nome || "Sem cliente")}${p.status && p.status !== "Em andamento" ? " · " + esc(p.status) : ""}</div></div>
      <div class="bar"><div class="strip" role="img" aria-label="Etapa ${i + 1} de ${STAGES.length}">${segs}</div><div class="mt">${esc(p.etapa || STAGES[0])}${p.proximo ? " · próximo: " + esc(p.proximo) : ""}</div></div>
      <div class="when"><b class="${lt ? "late" : ""}">${br(p.lancamento)}</b>${lt ? '<span class="late">atrasado</span>' : "lançamento"}</div></li>`;
  }).join("")}</ul>`;
}
function acts(list, t, grouped) {
  if (!list.length) return `<p class="muted small" style="padding:6px 20px 18px">Nada por aqui.</p>`;
  const sorted = [...list].sort((a, b) => ((a.data || "9") + (a.hora || "")).localeCompare((b.data || "9") + (b.hora || "")));
  let last = null, out = "";
  for (const a of sorted) {
    if (grouped && a.data !== last) { out += `<li class="dayhead">${a.data ? (a.data === t ? "Hoje" : a.data === addDays(t, 1) ? "Amanhã" : dayLabel(a.data)) : "Sem data"}</li>`; last = a.data; }
    const p = byId("projetos", a.projetoId), late = !a.feita && a.data && a.data < t;
    out += `<li class="${a.feita ? "done" : ""}"><input type="checkbox" data-toggle="${esc(a.id)}" ${a.feita ? "checked" : ""} aria-label="Concluir ${esc(a.titulo)}"><div class="t" data-edit="atividades" data-id="${esc(a.id)}"><span>${esc(a.titulo)}</span><small>${esc(a.tipo || "Tarefa")}${!grouped && a.data ? " · " + br(a.data) : ""}${a.hora ? " · " + esc(a.hora) : ""}${p ? " · " + esc(p.nome) : ""}${late ? ` · <b class="late">vencida</b>` : ""}</small></div></li>`;
  }
  return `<ul class="acts">${out}</ul>`;
}
function hbars(data, empty) {
  if (!data.length) return `<p class="muted small" style="padding:6px 20px 18px">${empty}</p>`;
  const max = Math.max(...data.map((d) => d[1]), 1);
  return `<ul class="hbars">${data.map(([l, v]) => `<li title="${esc(l)}: ${v}"><span>${esc(l)}</span><span class="tr"><span style="width:${Math.max(4, (v / max) * 100)}%"></span></span><b>${v}</b></li>`).join("")}</ul>`;
}
const countBy = (arr, f) => Object.entries(arr.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
function cover(seed) {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = (n) => ((h >>> (n * 3)) % 100) / 100, tones = ["#F4C2D7", "#E9A8C2", "#D98BAA", "#FCE4EC", "#B76E8C"];
  return `<svg viewBox="0 0 320 112" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${[0, 1, 2, 3].map((i) => `<circle cx="${40 + r(i) * 260}" cy="${16 + r(i + 4) * 90}" r="${24 + r(i + 2) * 36}" fill="${tones[(h + i) % 5]}" opacity="${0.55 - i * 0.08}"/>`).join("")}</svg>`;
}

/* ===================== telas ===================== */
function viewDashboard() {
  const t = today(), open = S.projetos.filter(isOpen), late = open.filter((p) => isLate(p, t));
  const week = S.atividades.filter((a) => actOpen(a) && a.data && a.data >= t && a.data <= addDays(t, 7));
  const overdue = S.atividades.filter((a) => actOpen(a) && a.data && a.data < t);
  const crit = [...overdue, ...week.filter((a) => a.tipo === "Prazo" || a.tipo === "Aprovação")];
  const launches = open.filter((p) => p.lancamento && p.lancamento >= t && p.lancamento <= addDays(t, 90)).sort((a, b) => a.lancamento.localeCompare(b.lancamento));
  const fu = S.atividades.filter((a) => actOpen(a) && a.tipo === "Follow-up").length;
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const hi = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const order = [...open].sort((a, b) => isLate(b, t) - isLate(a, t) || (a.lancamento || "9").localeCompare(b.lancamento || "9"));
  const kpi = (n, l, href, alert) => `<a href="${href}" class="${alert ? "alert" : ""}"><b>${n}</b><span>${l}</span></a>`;
  return `<div class="page-head"><div><p class="muted" style="margin:0 0 4px">${new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date())}</p><h1>${hi}.</h1></div>
    <div class="actions"><button class="btn ghost sm" data-new="clientes">Novo cliente</button><button class="btn ghost sm" data-new="projetos">Novo projeto</button><button class="btn ghost sm" data-new="atividades">Nova atividade</button><button class="btn ghost sm" data-new="atividades" data-tipo="Follow-up">Novo follow-up</button></div></div>
  <section class="card kpis" aria-label="Indicadores">
    ${kpi(S.clientes.length, "Clientes", "#/clientes")}${kpi(open.filter((p) => p.status !== "Pausado").length, "Projetos ativos", "#/projetos")}${kpi(late.length, "Projetos atrasados", "#/projetos", late.length)}
    ${kpi(launches.length, "Lançamentos em 90 dias", "#/projetos")}${kpi(week.length, "Atividades nos próximos 7 dias", "#/agenda")}${kpi(fu, "Follow-ups pendentes", "#/atividades")}${kpi(S.fornecedores.length, "Fornecedores", "#/fornecedores")}
  </section>
  <div class="grid-main" style="margin-top:20px">
    <section class="card"><div class="head"><div><h2>Esteira de desenvolvimento</h2><p>Cada faixa mostra as 9 etapas do projeto, da pesquisa ao lançamento.</p></div><div class="legend"><span><i class="s-done"></i>concluída</span><span><i class="s-now"></i>etapa atual</span><span><i class="s-todo"></i>a fazer</span></div></div>${pipeline(order, t)}</section>
    <div class="stack">
      <section class="card"><div class="head"><div><h2>Prazos críticos</h2><p>Vencidos, aprovações e prazos da semana</p></div></div>${acts(crit, t, false)}</section>
      <section class="card"><div class="head"><div><h2>Esta semana</h2><p>Reuniões, visitas e entregas</p></div><a class="small" href="#/agenda">Agenda</a></div>${acts(week, t, true)}</section>
    </div>
  </div>
  <div class="grid-3" style="margin-top:20px">
    <section class="card"><div class="head"><h2>Projetos por etapa</h2></div>${hbars(countBy(open, (p) => p.etapa || STAGES[0]), "Sem projetos em aberto.")}</section>
    <section class="card"><div class="head"><h2>Projetos por categoria</h2></div>${hbars(countBy(S.projetos, (p) => p.categoria || "Sem categoria"), "Sem projetos.")}</section>
    <section class="card"><div class="head"><h2>Próximos lançamentos</h2></div>${launches.length ? `<ul class="acts">${launches.slice(0, 6).map((p) => `<li><div class="t" data-go="#/projeto/${esc(p.id)}"><span>${esc(p.nome)}</span><small>${br(p.lancamento)} · em ${diff(t, p.lancamento)} dias${byId("clientes", p.clienteId) ? " · " + esc(byId("clientes", p.clienteId).nome) : ""}</small></div></li>`).join("")}</ul>` : `<p class="muted small" style="padding:6px 20px 18px">Nenhum lançamento nos próximos 90 dias.</p>`}</section>
  </div>`;
}

let agendaMonth = null;
function viewAgenda() {
  const t = today();
  const [y, m] = (agendaMonth || t.slice(0, 7)).split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)), off = (first.getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(Date.UTC(y, m - 1, 1 - off + i)).toISOString().slice(0, 10));
  const ev = {};
  for (const a of S.atividades) if (a.data) (ev[a.data] ||= []).push({ txt: (a.hora ? a.hora + " " : "") + a.titulo, cls: a.feita ? "done" : "", edit: `data-edit="atividades" data-id="${esc(a.id)}"` });
  for (const p of S.projetos) if (p.lancamento) (ev[p.lancamento] ||= []).push({ txt: "Lançamento: " + p.nome, cls: "launch", edit: `data-go="#/projeto/${esc(p.id)}"` });
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  return `<div class="page-head"><div><h1>Agenda</h1><p>Reuniões, visitas técnicas, prazos e lançamentos.</p></div><div class="actions"><button class="btn" data-new="atividades" data-tipo="Reunião">Agendar</button></div></div>
  <section class="card"><div class="head"><h2 style="text-transform:capitalize">${label}</h2><div class="actions"><button class="btn ghost sm" data-month="${prev}">‹ Anterior</button><button class="btn ghost sm" data-month="">Hoje</button><button class="btn ghost sm" data-month="${next}">Próximo ›</button></div></div>
    <div class="cal">${["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => `<div class="wd">${d}</div>`).join("")}
    ${days.map((d) => `<div class="d ${Number(d.slice(5, 7)) !== m ? "out" : ""} ${d === t ? "today" : ""}"><span class="n">${Number(d.slice(8))}</span>${(ev[d] || []).slice(0, 4).map((e) => `<span class="ev ${e.cls}" ${e.edit} title="${esc(e.txt)}">${esc(e.txt)}</span>`).join("")}${(ev[d] || []).length > 4 ? `<span class="small muted">+${ev[d].length - 4}</span>` : ""}</div>`).join("")}</div></section>`;
}

function viewAtividades() {
  const t = today(), open = S.atividades.filter(actOpen), done = S.atividades.filter((a) => a.feita).sort((a, b) => (b.data || "").localeCompare(a.data || "")).slice(0, 30);
  return `<div class="page-head"><div><h1>Atividades</h1><p>Tarefas, reuniões, follow-ups, aprovações e prazos de todos os projetos.</p></div><div class="actions"><button class="btn" data-new="atividades">Nova atividade</button></div></div>
  <div class="grid-main"><section class="card"><div class="head"><h2>Em aberto · ${open.length}</h2></div>${open.length ? acts(open, t, true) : `<div class="empty"><h3>Tudo em dia</h3><p>Registre a próxima reunião, follow-up ou prazo.</p></div>`}</section>
  <section class="card"><div class="head"><h2>Concluídas recentes</h2></div>${acts(done, t, false)}</section></div>`;
}

function viewProjetos() {
  const t = today();
  const list = [...S.projetos].sort((a, b) => !isOpen(a) - !isOpen(b) || (a.lancamento || "9").localeCompare(b.lancamento || "9"));
  return `<div class="page-head"><div><h1>Projetos</h1><p>Progresso calculado pela etapa atual de cada projeto.</p></div><div class="actions"><button class="btn" data-new="projetos">Novo projeto</button></div></div>
  ${list.length ? `<div class="cards">${list.map((p) => {
    const lt = isLate(p, t), c = byId("clientes", p.clienteId);
    return `<article class="card pcard" data-go="#/projeto/${esc(p.id)}" tabindex="0"><div class="pcover">${cover(p.nome)}<div class="badges"><span class="badge ${p.status === "Concluído" ? "ok" : p.status === "Pausado" ? "warn" : ""}">${esc(p.status || "Em andamento")}</span>${lt ? '<span class="badge late">Atrasado</span>' : ""}</div></div>
      <div class="pbody"><span class="small muted">${esc([p.codigo, p.categoria].filter(Boolean).join(" · ") || "Sem categoria")}</span><h3>${esc(p.nome)}</h3><span class="small muted">${esc(c?.nome || "")}</span>
      <div style="margin-top:auto;padding-top:14px"><div class="small" style="display:flex;justify-content:space-between"><span class="muted">${esc(p.etapa || STAGES[0])}</span><b>${progress(p)}%</b></div><div class="prog ${lt ? "lt" : ""}"><span style="width:${progress(p)}%"></span></div>
      <div class="small muted" style="margin-top:8px">${p.lancamento ? "Lança " + br(p.lancamento) : "Sem data de lançamento"}</div></div></div></article>`;
  }).join("")}</div>` : `<section class="card"><div class="empty"><h3>Nenhum projeto ainda</h3><p>Cada projeto ganha uma esteira com as etapas do desenvolvimento.</p><button class="btn" data-new="projetos">Novo projeto</button></div></section>`}`;
}

function viewProjeto(id) {
  const p = byId("projetos", id);
  if (!p) return `<section class="card"><div class="empty"><h3>Projeto não encontrado</h3><a class="btn" href="#/projetos">Voltar aos projetos</a></div></section>`;
  const t = today(), c = byId("clientes", p.clienteId), i = stageIdx(p), lt = isLate(p, t);
  const its = S.atividades.filter((a) => a.projetoId === id), sups = (p.fornecedores || []).map((fid) => byId("fornecedores", fid)).filter(Boolean);
  const pk = (p.embalagens || []).map((eid) => byId("embalagens", eid)).filter(Boolean);
  return `<a href="#/projetos" class="small" style="text-decoration:none">‹ Projetos</a>
  <section class="card" style="margin-top:10px"><div class="pad">
    <div class="page-head" style="margin:0"><div><p class="small muted" style="margin:0">${esc([c?.nome, p.codigo, p.categoria, p.tipo].filter(Boolean).join(" · "))}</p><h1>${esc(p.nome)}</h1>
      <div class="actions" style="margin-top:8px"><span class="badge">${esc(p.status || "Em andamento")}</span>${p.prioridade && p.prioridade !== "Normal" ? `<span class="badge warn">Prioridade ${esc(p.prioridade.toLowerCase())}</span>` : ""}${lt ? '<span class="badge late">Atrasado</span>' : ""}</div></div>
      <div class="actions"><button class="btn ghost" data-edit="projetos" data-id="${esc(id)}">Editar</button><button class="btn" data-new="atividades" data-projeto="${esc(id)}">Nova atividade</button></div></div>
    <div class="stages" role="list" aria-label="Etapas — clique para mudar a etapa atual">${STAGES.map((s, k) => `<button role="listitem" data-stage="${k}" ${k === i ? 'aria-current="step"' : ""} title="Definir como etapa atual"><span class="${p.etapa === "Lançado" || k < i ? "s-done" : k === i ? "s-now" : "s-todo"}"></span>${esc(s)}</button>`).join("")}</div>
    <p class="small muted" style="margin:12px 0 0">${progress(p)}% concluído · início ${br(p.inicio)} · lançamento <b class="${lt ? "late" : ""}">${br(p.lancamento)}</b>${p.lancamento ? ` (${diff(t, p.lancamento) >= 0 ? "em " + diff(t, p.lancamento) + " dias" : "há " + -diff(t, p.lancamento) + " dias"})` : ""}</p>
  </div></section>
  <div class="grid-main" style="margin-top:20px">
    <div class="stack">
      <section class="card"><div class="head"><h2>Conceito e estratégia</h2></div><dl class="info"><div><dt>Conceito</dt><dd>${esc(p.conceito) || "—"}</dd></div><div><dt>Objetivo</dt><dd>${esc(p.objetivo) || "—"}</dd></div><div><dt>Próximo passo</dt><dd>${esc(p.proximo) || "—"}</dd></div><div><dt>Custo-alvo unitário</dt><dd>${money(p.custoAlvo)}</dd></div><div><dt>Volume / SKUs</dt><dd>${esc(p.skus) || "—"}</dd></div><div><dt>Observações</dt><dd>${esc(p.obs) || "—"}</dd></div></dl></section>
      <section class="card"><div class="head"><h2>Atividades do projeto</h2></div>${acts(its, t, false)}</section>
    </div>
    <div class="stack">
      <section class="card"><div class="head"><h2>Fornecedores</h2><button class="btn soft sm" data-edit="projetos" data-id="${esc(id)}">Vincular</button></div>${sups.length ? `<ul class="acts">${sups.map((f) => `<li><div class="t" data-edit="fornecedores" data-id="${esc(f.id)}"><span>${esc(f.nome)}</span><small>${esc(f.categoria || "")}</small></div></li>`).join("")}</ul>` : `<p class="muted small" style="padding:6px 20px 18px">Nenhum fornecedor vinculado.</p>`}</section>
      <section class="card"><div class="head"><h2>Embalagens</h2></div>${pk.length ? `<ul class="acts">${pk.map((e) => `<li><div class="t" data-edit="embalagens" data-id="${esc(e.id)}"><span>${esc(e.nome)}</span><small>${esc([e.tipo, e.material, e.capacidade].filter(Boolean).join(" · "))}</small></div></li>`).join("")}</ul>` : `<p class="muted small" style="padding:6px 20px 18px">Nenhuma embalagem vinculada.</p>`}</section>
    </div>
  </div>`;
}

function viewClientes() {
  const list = [...S.clientes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return `<div class="page-head"><div><h1>Clientes</h1><p>Marcas atendidas, contatos e projetos de cada uma.</p></div><div class="actions"><button class="btn" data-new="clientes">Novo cliente</button></div></div>
  ${list.length ? `<div class="cards">${list.map((c) => { const ps = S.projetos.filter((p) => p.clienteId === c.id); return `<article class="card pcard" data-edit="clientes" data-id="${esc(c.id)}" tabindex="0"><div class="pbody"><span class="small muted">${esc(c.segmento || "")}</span><h3>${esc(c.nome)}</h3><span class="small muted">${esc(c.marca || "")}</span>
    <p class="small" style="margin:12px 0 0">${ps.length ? ps.map((p) => `<a href="#/projeto/${esc(p.id)}" data-stop>${esc(p.nome)}</a>`).join(" · ") : '<span class="muted">Nenhum projeto</span>'}</p><p class="small muted" style="margin:8px 0 0">${esc([c.contato, c.email, c.telefone].filter(Boolean).join(" · "))}</p></div></article>`; }).join("")}</div>`
    : `<section class="card"><div class="empty"><h3>Nenhum cliente ainda</h3><p>Cadastre a primeira cliente para ligar os projetos a ela.</p><button class="btn" data-new="clientes">Novo cliente</button></div></section>`}`;
}

const FF = { q: "", cat: "", cap: "", qual: "" };
function viewFornecedores() {
  const caps = [...new Set([...CAPS, ...S.fornecedores.flatMap((x) => [...(x.aptidao || []), ...(x.emAvaliacao || [])])])];
  const cats = [...new Set([...SUP_CATS, ...S.fornecedores.map((x) => x.categoria).filter(Boolean)])];
  const q = norm(FF.q);
  const list = S.fornecedores.filter((x) => (!q || norm([x.nome, x.contato, x.email, x.cidade, x.obs].join(" ")).includes(q)) && (!FF.cat || x.categoria === FF.cat) && (!FF.cap || (x.aptidao || []).includes(FF.cap)) && (!FF.qual || x.qualidade === FF.qual)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const qb = (v) => v === "Aprovado" ? "ok" : v?.startsWith("Reprovado") ? "late" : v === "Aprovado condicionalmente" ? "info" : "neutral";
  return `<div class="page-head"><div><h1>Fornecedores</h1><p>Fabricantes, embalagens, matérias-primas e serviços. Filtre por aptidão para encontrar quem faz cada tipo de produto.</p></div>
    <div class="actions"><label class="btn ghost" style="cursor:pointer">Importar planilha<input type="file" id="xlsx" accept=".xlsx" hidden></label><button class="btn ghost" id="csvSup">Exportar CSV</button><button class="btn" data-new="fornecedores">Novo fornecedor</button></div></div>
  <section class="card"><div class="tools"><input type="search" id="fq" placeholder="Buscar por nome, contato, cidade…" value="${esc(FF.q)}" aria-label="Buscar fornecedor">
    <select id="fcat" aria-label="Categoria"><option value="">Todas as categorias</option>${cats.map((c) => `<option ${c === FF.cat ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
    <select id="fcap" aria-label="Apto a"><option value="">Apto a qualquer produto</option>${caps.map((c) => `<option ${c === FF.cap ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
    <select id="fqual" aria-label="Qualidade"><option value="">Qualquer avaliação</option>${QUALITY.map((c) => `<option ${c === FF.qual ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
    <span class="small muted">${list.length} de ${S.fornecedores.length}</span></div>
  ${list.length ? `<div class="scroll"><table><thead><tr><th>Fornecedor</th><th>Categoria</th><th>Apto a</th><th>Qualidade</th><th>Contato</th></tr></thead><tbody>${list.map((x) => `<tr data-edit="fornecedores" data-id="${esc(x.id)}"><td><b>${esc(x.nome)}</b>${x.cidade ? `<div class="small muted">${esc(x.cidade)}</div>` : ""}</td><td>${esc(x.categoria || "—")}</td><td>${(x.aptidao || []).map((c) => `<span class="chip">${esc(c)}</span>`).join("")}${(x.emAvaliacao || []).map((c) => `<span class="chip ev" title="Em avaliação">${esc(c)} · em avaliação</span>`).join("") || ((x.aptidao || []).length ? "" : "—")}</td><td>${x.qualidade ? `<span class="badge ${qb(x.qualidade)}">${esc(x.qualidade)}${x.ano ? " · " + esc(x.ano) : ""}</span>` : "—"}</td><td class="small">${esc([x.contato, x.email, x.telefone].filter(Boolean).join(" · ") || "—")}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty"><h3>${S.fornecedores.length ? "Nenhum fornecedor com esses filtros" : "Nenhum fornecedor ainda"}</h3><p>${S.fornecedores.length ? "Ajuste os filtros." : "Importe a sua planilha de fornecedores (botão acima) ou cadastre um por um."}</p></div>`}</section>`;
}

const EF = { tipo: "", q: "" };
function viewEmbalagens() {
  const q = norm(EF.q);
  const list = S.embalagens.filter((e) => (!EF.tipo || e.tipo === EF.tipo) && (!q || norm([e.nome, e.codigo, e.material, e.cor].join(" ")).includes(q))).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return `<div class="page-head"><div><h1>Biblioteca de embalagens</h1><p>Frascos, potes, bisnagas e componentes, com ficha técnica, fornecedor e custo. As imagens de tipo são ilustrativas.</p></div><div class="actions"><button class="btn" data-new="embalagens">Nova embalagem</button></div></div>
  <div class="types" role="group" aria-label="Filtrar por tipo">${PK_TYPES.map(([l]) => `<button data-ptype="${esc(l)}" aria-pressed="${EF.tipo === l}"><img src="${PK_IMG[l]}" alt="" loading="lazy">${esc(l)}</button>`).join("")}</div>
  <div class="tools" style="padding:0 0 14px"><input type="search" id="eq" placeholder="Buscar por nome, código, material ou cor" value="${esc(EF.q)}" aria-label="Buscar embalagem">${EF.tipo ? `<button class="btn ghost sm" data-ptype="">Limpar tipo: ${esc(EF.tipo)}</button>` : ""}<span class="small muted">${list.length} de ${S.embalagens.length}</span></div>
  ${list.length ? `<div class="cards">${list.map((e) => { const img = e.foto || PK_IMG[e.tipo]; const sup = byId("fornecedores", e.fornecedorId); return `<article class="card pk" data-edit="embalagens" data-id="${esc(e.id)}" tabindex="0"><div class="ph">${img ? `<img src="${esc(img)}" alt="" class="${e.foto ? "" : "illu"}">${e.foto ? "" : '<span class="tag">imagem ilustrativa do tipo</span>'}` : '<span class="muted">sem imagem</span>'}</div><div class="info"><span class="small muted">${esc([e.componente, e.tipo].filter(Boolean).join(" · "))}</span><b>${esc(e.nome)}</b><span class="small muted">${esc([e.material, e.capacidade, e.acabamento].filter(Boolean).join(" · "))}</span><div class="small" style="margin-top:6px">${[sup ? esc(sup.nome) : "", e.custo !== "" && e.custo != null ? `<b>${money(e.custo)}</b>` : ""].filter(Boolean).join(" · ")}</div></div></article>`; }).join("")}</div>`
    : `<section class="card"><div class="empty"><h3>${S.embalagens.length ? "Nenhuma embalagem com esse filtro" : "Biblioteca vazia"}</h3><p>Cadastre embalagens com foto, ficha técnica e fornecedor.</p><button class="btn" data-new="embalagens">Nova embalagem</button></div></section>`}`;
}

function viewDados() {
  const last = S.meta.lastBackup ? new Date(S.meta.lastBackup).toLocaleString("pt-BR", { timeZone: TZ }) : "nunca";
  return `<div class="page-head"><div><h1>Dados e backup</h1><p>Tudo o que você cadastra fica guardado neste navegador, neste aparelho. Nada vai para o GitHub nem para outro servidor.</p></div></div>
  <div class="grid-3">
    <section class="card"><div class="head"><h2>Fazer backup</h2></div><div class="pad"><p class="small">Baixa um arquivo com todos os seus dados. Guarde no seu computador ou no Google Drive. Último backup: <b>${esc(last)}</b>.</p><button class="btn" id="exportAll">Baixar backup</button></div></section>
    <section class="card"><div class="head"><h2>Restaurar backup</h2></div><div class="pad"><p class="small">Use para recuperar seus dados ou levá-los para outro computador ou celular. Substitui os dados atuais deste navegador.</p><label class="btn ghost" style="cursor:pointer">Escolher arquivo de backup<input type="file" id="importAll" accept=".json,application/json" hidden></label></div></section>
    <section class="card"><div class="head"><h2>Importar planilha de fornecedores</h2></div><div class="pad"><p class="small">Excel (.xlsx) no formato da sua planilha de controle: fornecedor, avaliação de qualidade e colunas de produto com “Apto”. Quem já existe é atualizado, sem apagar nada.</p><label class="btn ghost" style="cursor:pointer">Escolher planilha<input type="file" id="xlsx" accept=".xlsx" hidden></label>${S.meta.undo ? `<p class="small" style="margin-top:12px"><button class="btn soft sm" id="undoImport">Desfazer a última importação</button></p>` : ""}</div></section>
  </div>
  <section class="card" style="margin-top:20px"><div class="head"><h2>O que está guardado</h2></div><dl class="info">${COLS.map((c) => `<div><dt>${c[0].toUpperCase() + c.slice(1)}</dt><dd>${S[c].length}</dd></div>`).join("")}</dl>
  <div class="pad" style="border-top:1px solid var(--line)"><p class="small muted">Limpar os dados de navegação deste site apaga o que está aqui. Por isso, faça backup com frequência.</p><button class="btn ghost sm" id="wipe">Apagar todos os dados deste navegador</button></div></section>`;
}

/* ===================== formulários ===================== */
const FORMS = {
  projetos: ["Projeto", [["nome", "Nome do projeto", "text", 1], ["clienteId", "Cliente", "rel:clientes"], ["codigo", "Código interno"], ["categoria", "Categoria", "list", 0, CATEGORIES], ["tipo", "Tipo de produto"], ["etapa", "Etapa atual", "select", 0, STAGES], ["status", "Status", "select", 0, ["Em andamento", "Planejamento", "Pausado", "Concluído", "Cancelado"]], ["prioridade", "Prioridade", "select", 0, ["Normal", "Alta", "Crítica", "Baixa"]], ["inicio", "Início", "date"], ["lancamento", "Previsão de lançamento", "date"], ["custoAlvo", "Custo-alvo unitário (R$)", "money"], ["skus", "Volume / SKUs", "text"], ["proximo", "Próximo passo", "text", 0, null, 1], ["conceito", "Conceito", "textarea"], ["objetivo", "Objetivo", "textarea"], ["fornecedores", "Fornecedores do projeto", "multi:fornecedores"], ["embalagens", "Embalagens do projeto", "multi:embalagens"], ["obs", "Observações", "textarea"]]],
  atividades: ["Atividade", [["titulo", "O que fazer", "text", 1, null, 1], ["tipo", "Tipo", "select", 0, ACT_TYPES], ["projetoId", "Projeto", "rel:projetos"], ["data", "Data", "date"], ["hora", "Hora", "time"], ["obs", "Observações", "textarea"]]],
  clientes: ["Cliente", [["nome", "Nome", "text", 1], ["marca", "Marca"], ["segmento", "Segmento"], ["contato", "Contato principal"], ["email", "E-mail", "email"], ["telefone", "Telefone / WhatsApp"], ["obs", "Observações", "textarea"]]],
  fornecedores: ["Fornecedor", [["nome", "Nome", "text", 1], ["categoria", "Categoria", "list", 0, SUP_CATS], ["qualidade", "Avaliação de qualidade", "select", 0, QUALITY], ["ano", "Ano da avaliação"], ["contato", "Contato"], ["email", "E-mail", "email"], ["telefone", "Telefone / WhatsApp"], ["cidade", "Cidade / país"], ["moq", "MOQ"], ["leadTime", "Lead time"], ["aptidao", "Aptidão por tipo de produto", "caps"], ["obs", "Observações internas", "textarea"]]],
  embalagens: ["Embalagem", [["tipo", "Tipo", "ptype"], ["nome", "Nome", "text", 1], ["codigo", "Código"], ["componente", "Componente", "select", 0, ["Frasco", "Pote", "Bisnaga", "Tampa", "Válvula", "Pump", "Spray", "Aplicador", "Retentor", "Compacto", "Cartucho", "Rótulo", "Sleeve", "Outro"]], ["fornecedorId", "Fornecedor", "rel:fornecedores"], ["material", "Material", "list", 0, MATERIALS], ["capacidade", "Capacidade (ex.: 6 ml)"], ["dimensoes", "Dimensões"], ["acabamento", "Acabamento"], ["cor", "Cor / Pantone"], ["fechamento", "Fechamento / rosca"], ["aplicador", "Aplicador / válvula"], ["moq", "MOQ"], ["leadTime", "Lead time"], ["custo", "Custo unitário (R$)", "money"], ["foto", "Foto do modelo real", "photo"], ["obs", "Observações", "textarea"]]],
};
function openForm(col, id, preset = {}) {
  const [title, fields] = FORMS[col], item = id ? byId(col, id) : null, d = item || { status: "Em andamento", etapa: STAGES[0], prioridade: "Normal", tipo: col === "atividades" ? "Tarefa" : "", ...preset };
  let armed = false, photo = d.foto || "";
  const f = $("#frm");
  const field = ([k, label, type = "text", req, opts, wide]) => {
    const v = d[k] ?? "", w = ["textarea", "caps", "ptype", "photo"].includes(type) || type.startsWith("multi:") || wide ? ' class="w"' : "";
    if (type === "textarea") return `<label${w}>${label}<textarea name="${k}">${esc(v)}</textarea></label>`;
    if (type === "select" || type.startsWith("rel:")) {
      const list = type === "select" ? opts.map((o) => [o, o]) : S[type.slice(4)].filter((x) => type !== "rel:projetos" || isOpen(x) || x.id === v).map((x) => [x.id, x.nome]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
      return `<label${w}>${label}<select name="${k}"><option value="">—</option>${list.map(([val, txt]) => `<option value="${esc(val)}" ${val === v ? "selected" : ""}>${esc(txt)}</option>`).join("")}</select></label>`;
    }
    if (type === "list") return `<label${w}>${label}<input name="${k}" list="dl-${k}" value="${esc(v)}" autocomplete="off"><datalist id="dl-${k}">${opts.map((o) => `<option value="${esc(o)}">`).join("")}</datalist></label>`;
    if (type === "caps") { const st = (c) => (d.aptidao || []).includes(c) ? "apto" : (d.emAvaliacao || []).includes(c) ? "em_avaliacao" : ""; const all = [...new Set([...CAPS, ...(d.aptidao || []), ...(d.emAvaliacao || [])])]; return `<div class="w"><div class="picklabel">${label} <span class="muted small">(1 clique: apto · 2 cliques: em avaliação · 3: limpar)</span></div><div class="pick" id="caps">${all.map((c) => `<button type="button" data-s="${st(c)}">${esc(c)}</button>`).join("")}</div></div>`; }
    if (type.startsWith("multi:")) { const src = S[type.slice(6)]; if (!src.length) return ""; return `<div class="w"><div class="picklabel">${label}</div><div class="pick" data-multi="${k}">${[...src].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((x) => `<button type="button" data-v="${esc(x.id)}" aria-pressed="${(d[k] || []).includes(x.id)}">${esc(x.nome)}</button>`).join("")}</div></div>`; }
    if (type === "ptype") return `<div class="w"><div class="picklabel">${label} <span class="muted small">(imagens ilustrativas)</span></div><input type="hidden" name="tipo" value="${esc(v)}"><div class="typegrid">${PK_TYPES.map(([l]) => `<button type="button" data-pt="${esc(l)}" aria-pressed="${v === l}"><img src="${PK_IMG[l]}" alt="" loading="lazy">${esc(l)}</button>`).join("")}</div></div>`;
    if (type === "photo") return `<label class="w">${label}<input type="file" id="photo" accept="image/*"><span class="small muted" id="photoInfo">${photo ? "Foto salva. Escolha outra para trocar." : "Opcional. A foto fica guardada só neste navegador."}</span></label>`;
    if (type === "money") return `<label${w}>${label}<input name="${k}" inputmode="decimal" value="${v === "" ? "" : esc(String(v).replace(".", ","))}"></label>`;
    return `<label${w}>${label}<input name="${k}" type="${type}" value="${esc(v)}" ${req ? "required" : ""} autocomplete="off"></label>`;
  };
  f.innerHTML = `<h2>${item ? "Editar" : "Novo"}: ${title.toLowerCase()}</h2><div class="fgrid">${fields.map(field).join("")}</div>
    <div class="dlg-actions">${item ? '<button type="button" class="btn ghost" id="del">Excluir</button>' : ""}${item && col === "projetos" ? `<a class="btn ghost" href="#/projeto/${esc(id)}" id="openP">Abrir projeto</a>` : ""}<span class="sp"></span><button type="button" class="btn ghost" id="cancel">Cancelar</button><button class="btn">Salvar</button></div>`;
  f.onclick = (e) => {
    const c = e.target.closest("#caps button"); if (c) { const n = { "": "apto", apto: "em_avaliacao", em_avaliacao: "" }; c.dataset.s = n[c.dataset.s || ""]; }
    const m = e.target.closest("[data-multi] button"); if (m) m.setAttribute("aria-pressed", String(m.getAttribute("aria-pressed") !== "true"));
    const pt = e.target.closest("[data-pt]"); if (pt) { f.querySelectorAll("[data-pt]").forEach((b) => b.setAttribute("aria-pressed", String(b === pt && pt.getAttribute("aria-pressed") !== "true"))); f.elements.tipo.value = pt.getAttribute("aria-pressed") === "true" ? pt.dataset.pt : ""; }
  };
  const ph = $("#photo", f);
  if (ph) ph.onchange = async () => { const file = ph.files[0]; if (!file) return; try { photo = await shrink(file); $("#photoInfo").textContent = "Foto pronta para salvar."; } catch { $("#photoInfo").textContent = "Não foi possível ler essa imagem."; } };
  $("#cancel").onclick = () => $("#dlg").close();
  $("#openP")?.addEventListener("click", () => $("#dlg").close());
  if (item) $("#del").onclick = async () => {
    if (!armed) { armed = true; $("#del").textContent = "Confirmar exclusão"; $("#del").className = "btn danger"; return; }
    S[col] = S[col].filter((x) => x.id !== id);
    if (col === "projetos") S.atividades = S.atividades.filter((a) => a.projetoId !== id);
    await save(); $("#dlg").close(); toast("Excluído."); if (col === "projetos" && location.hash.includes(id)) location.hash = "#/projetos"; else rerender();
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const body = { ...(item || {}), id: item?.id || uid() };
    for (const [k, , type = "text"] of fields) {
      if (type === "caps") { body.aptidao = [...f.querySelectorAll("#caps [data-s=apto]")].map((b) => b.textContent); body.emAvaliacao = [...f.querySelectorAll("#caps [data-s=em_avaliacao]")].map((b) => b.textContent); }
      else if (type.startsWith("multi:")) { const box = f.querySelector(`[data-multi="${k}"]`); body[k] = box ? [...box.querySelectorAll("[aria-pressed=true]")].map((b) => b.dataset.v) : body[k] || []; }
      else if (type === "photo") body.foto = photo;
      else if (type === "money") body[k] = parseNum(f.elements[k].value);
      else body[k] = (f.elements[k]?.value ?? "").trim();
    }
    if (col === "atividades" && !item) body.feita = false;
    if (item) S[col] = S[col].map((x) => (x.id === item.id ? body : x)); else S[col].push(body);
    await save(); $("#dlg").close(); toast(item ? "Alterações salvas." : `${title} criado.`); rerender();
  };
  $("#dlg").showModal();
  f.querySelector("input:not([type=hidden]):not([type=file]),select")?.focus();
}
function shrink(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, 720 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.82)); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
}

/* ===================== importação da planilha (formato em matriz) ===================== */
const CAP_STAT = (v) => { const s = norm(v); if (!s) return null; if (["apto", "apta", "sim", "x", "ok"].includes(s)) return "apto"; if (s.startsWith("em avaliac")) return "em_avaliacao"; if (s.startsWith("suspens")) return "suspenso"; if (["n a", "na", "nao"].includes(s)) return "na"; return null; };
const QUAL = { aprovado: "Aprovado", "aprovado condicionalmente": "Aprovado condicionalmente", "reprovado condicionalmente": "Reprovado condicionalmente", reprovado: "Reprovado", pendente: "Pendente" };
const tok = (s) => norm(s).split(" ").filter((t) => t && !["e", "de", "da", "do", "a", "o"].includes(t)).join(" ");
const capName = (h) => { const want = tok(h); const hit = CAPS.find((c) => tok(c) === want) || CAPS.find((c) => want.startsWith(tok(c) + " ")); if (hit) return hit; const t = String(h).replace(/\s+/g, " ").trim().toLowerCase(); return t[0].toUpperCase() + t.slice(1); };
function parseSupplierSheet(rows) {
  const txt = (c) => (c == null ? "" : String(c).replace(/\s+/g, " ").trim());
  let hi = 0, best = -1;
  rows.slice(0, 30).forEach((r, i) => { const n = (r || []).filter((c) => typeof c === "string" && c.trim()).length; if (n > best) { best = n; hi = i; } });
  const header = (rows[hi] || []).map(txt);
  const nameCol = header.findIndex((h) => /^(fornecedor|nome|empresa|fabricante)/i.test(norm(h)));
  if (nameCol < 0) throw new Error("Não encontrei a coluna com o nome do fornecedor (ex.: “FORNECEDOR”).");
  const qualCol = header.findIndex((h) => norm(h).includes("qualidade") || norm(h).includes("avaliacao"));
  const year = (header[qualCol] || "").match(/(19|20)\d{2}/)?.[0] || "";
  const pick = (re) => header.findIndex((h) => re.test(norm(h)));
  const extra = { email: pick(/e ?mail/), telefone: pick(/telefone|whats|celular|fone/), contato: pick(/^contato|responsavel/), cidade: pick(/cidade|pais|estado|uf/) };
  const capCols = header.map((h, i) => ({ h, i })).filter(({ h, i }) => h && i !== nameCol && i !== qualCol && !Object.values(extra).includes(i) && rows.slice(hi + 1).some((r) => CAP_STAT(r?.[i])));
  let cat = "Fabricante terceirista";
  const out = [];
  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r] || [], name = txt(row[nameCol]);
    if (!name) continue;
    if (norm(name) === norm(header[nameCol])) continue; // cabeçalho repetido
    const others = row.filter((c, i) => i !== nameCol && txt(c)).length;
    if (!others && (name === name.toUpperCase() || name.includes("/"))) { cat = norm(name).includes("embalag") ? "Embalagens" : name[0] + name.slice(1).toLowerCase(); continue; } // seção
    const s = { nome: name, categoria: cat, aptidao: [], emAvaliacao: [] };
    const q = QUAL[norm(row[qualCol])]; if (q) { s.qualidade = q; if (year) s.ano = year; }
    for (const [k, i] of Object.entries(extra)) if (i >= 0 && txt(row[i])) s[k] = txt(row[i]);
    for (const { h, i } of capCols) { const st = CAP_STAT(row[i]); const n = capName(h); if (st === "apto" && !s.aptidao.includes(n)) s.aptidao.push(n); if (st === "em_avaliacao" && !s.emAvaliacao.includes(n)) s.emAvaliacao.push(n); }
    out.push(s);
  }
  return out;
}
async function importXlsx(file) {
  if (typeof window.readXlsxFile !== "function") return toast("O leitor de planilhas não carregou. Recarregue a página.");
  try {
    const res = await window.readXlsxFile(file);
    // versões novas devolvem [{sheet, data}] (todas as abas); usamos a aba com mais linhas
    const rows = Array.isArray(res?.[0]) ? res : (res || []).reduce((a, sh) => ((sh.data?.length || 0) > a.length ? sh.data : a), []);
    const list = parseSupplierSheet(rows);
    if (!list.length) return toast("Nenhum fornecedor encontrado na planilha.");
    const byName = new Map(S.fornecedores.map((x) => [norm(x.nome), x]));
    const novos = list.filter((s) => !byName.has(norm(s.nome))).length;
    if (!confirmBox(`Encontrei ${list.length} fornecedores: ${novos} novos e ${list.length - novos} já cadastrados (serão completados, sem apagar nada). Importar?`)) return;
    S.meta.undo = JSON.parse(JSON.stringify(S.fornecedores));
    for (const s of list) {
      const cur = byName.get(norm(s.nome));
      if (!cur) { S.fornecedores.push({ id: uid(), ...s }); continue; }
      for (const [k, v] of Object.entries(s)) {
        if (Array.isArray(v)) cur[k] = [...new Set([...(cur[k] || []), ...v])];
        else if (!cur[k]) cur[k] = v;
      }
    }
    await save(); toast(`${list.length} fornecedores importados.`); location.hash = "#/fornecedores"; rerender();
  } catch (e) { toast(e?.message?.startsWith("Não encontrei") ? e.message : "Não foi possível ler a planilha. Confira se é um arquivo .xlsx."); }
}
function confirmBox(msg) { return window.confirm(msg); }

/* ===================== backup ===================== */
function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
async function exportAll() { S.meta.lastBackup = new Date().toISOString(); await save(); download(`backup-beauty-studio-${today()}.json`, JSON.stringify({ app: "beauty-development-studio", versao: 1, exportadoEm: S.meta.lastBackup, dados: Object.fromEntries(COLS.map((c) => [c, S[c]])) }, null, 1), "application/json"); toast("Backup baixado."); rerender(); }
async function importAll(file) {
  try {
    const j = JSON.parse(await file.text());
    if (j.app !== "beauty-development-studio" || !j.dados) throw 0;
    if (!confirmBox("Restaurar este backup? Os dados atuais deste navegador serão substituídos.")) return;
    for (const c of COLS) S[c] = Array.isArray(j.dados[c]) ? j.dados[c] : [];
    await save(); toast("Backup restaurado."); rerender();
  } catch { toast("Esse arquivo não é um backup deste painel."); }
}
function exportCsv() {
  const cols = [["nome", "Fornecedor"], ["categoria", "Categoria"], ["qualidade", "Qualidade"], ["ano", "Ano"], ["aptidao", "Apto a"], ["contato", "Contato"], ["email", "E-mail"], ["telefone", "Telefone"], ["cidade", "Cidade"]];
  const q = (v) => `"${String(Array.isArray(v) ? v.join(", ") : v ?? "").replace(/"/g, '""')}"`;
  download(`fornecedores-${today()}.csv`, "﻿" + [cols.map((c) => q(c[1])).join(";"), ...S.fornecedores.map((s) => cols.map(([k]) => q(s[k])).join(";"))].join("\n"), "text/csv");
}

/* ===================== eventos ===================== */
document.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.closest("[data-stop]")) return;
  const nw = t.closest("[data-new]");
  if (nw) { $("#createMenu").hidden = true; return openForm(nw.dataset.new, null, { ...(nw.dataset.tipo ? { tipo: nw.dataset.tipo } : {}), ...(nw.dataset.projeto ? { projetoId: nw.dataset.projeto } : {}) }); }
  const tg = t.closest("[data-toggle]");
  if (tg) { const a = byId("atividades", tg.dataset.toggle); if (a) { a.feita = tg.checked; await save(); toast(a.feita ? "Atividade concluída." : "Atividade reaberta."); rerender(); } return; }
  const ed = t.closest("[data-edit]"); if (ed) return openForm(ed.dataset.edit, ed.dataset.id);
  const go = t.closest("[data-go]"); if (go) { location.hash = go.dataset.go; return; }
  const st = t.closest("[data-stage]");
  if (st) { const id = location.hash.split("/")[2], p = byId("projetos", id); if (p) { p.etapa = STAGES[Number(st.dataset.stage)]; if (p.etapa === "Lançado" && p.status === "Em andamento") p.status = "Concluído"; await save(); toast(`Etapa atual: ${p.etapa}.`); rerender(); } return; }
  const mo = t.closest("[data-month]"); if (mo) { agendaMonth = mo.dataset.month || null; return rerender(); }
  const pt = t.closest("[data-ptype]"); if (pt) { EF.tipo = EF.tipo === pt.dataset.ptype ? "" : pt.dataset.ptype; return rerender(); }
  if (t.id === "exportAll") return exportAll();
  if (t.id === "csvSup") return exportCsv();
  if (t.id === "undoImport") { if (S.meta.undo) { S.fornecedores = S.meta.undo; delete S.meta.undo; await save(); toast("Importação desfeita."); rerender(); } return; }
  if (t.id === "wipe") { if (confirmBox("Apagar TODOS os dados deste navegador? Faça um backup antes.")) { for (const c of COLS) S[c] = []; S.meta = {}; await save(); toast("Dados apagados."); rerender(); } return; }
  if (t.id === "createBtn") { const m = $("#createMenu"); m.hidden = !m.hidden; t.setAttribute("aria-expanded", String(!m.hidden)); return; }
  if (!t.closest(".create")) $("#createMenu").hidden = true;
  if (t.id === "menuBtn") { $("#side").classList.add("open"); $("#scrim").hidden = false; }
  if (t.id === "scrim") { $("#side").classList.remove("open"); $("#scrim").hidden = true; }
});
document.addEventListener("keydown", (e) => { const g = e.target.closest?.("[data-go],[data-edit]"); if (g && e.key === "Enter" && !["INPUT", "BUTTON"].includes(e.target.tagName)) g.click(); });
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "xlsx" && t.files[0]) importXlsx(t.files[0]);
  if (t.id === "importAll" && t.files[0]) importAll(t.files[0]);
  if (t.id === "fcat") { FF.cat = t.value; rerender(); }
  if (t.id === "fcap") { FF.cap = t.value; rerender(); }
  if (t.id === "fqual") { FF.qual = t.value; rerender(); }
});
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.id === "fq" || t.id === "eq") { (t.id === "fq" ? FF : EF).q = t.value; const pos = t.selectionStart; rerender(); const n = $("#" + t.id); n.focus(); n.setSelectionRange(pos, pos); }
  if (t.id === "gsearch") {
    const q = norm(t.value), box = $("#gresults");
    if (q.length < 2) { box.hidden = true; return; }
    const hits = [
      ...S.projetos.filter((x) => norm(x.nome + " " + (x.codigo || "")).includes(q)).map((x) => [`#/projeto/${x.id}`, x.nome, "Projeto"]),
      ...S.fornecedores.filter((x) => norm(x.nome).includes(q)).map((x) => [`#/fornecedores`, x.nome, "Fornecedor", "fornecedores", x.id]),
      ...S.clientes.filter((x) => norm(x.nome + " " + (x.marca || "")).includes(q)).map((x) => [`#/clientes`, x.nome, "Cliente", "clientes", x.id]),
      ...S.embalagens.filter((x) => norm(x.nome + " " + (x.codigo || "")).includes(q)).map((x) => [`#/embalagens`, x.nome, "Embalagem", "embalagens", x.id]),
      ...S.atividades.filter((x) => norm(x.titulo).includes(q)).map((x) => [`#/atividades`, x.titulo, "Atividade", "atividades", x.id]),
    ].slice(0, 12);
    box.innerHTML = hits.length ? hits.map(([h, n, k, c, id]) => `<a href="${esc(h)}" ${c ? `data-open="${c}" data-oid="${esc(id)}"` : ""}>${esc(n)}<small>${k}</small></a>`).join("") : `<p class="small muted" style="padding:8px 12px;margin:0">Nada encontrado.</p>`;
    box.hidden = false;
  }
});
$("#gresults").addEventListener("click", (e) => { const a = e.target.closest("a"); if (!a) return; $("#gresults").hidden = true; $("#gsearch").value = ""; if (a.dataset.open) setTimeout(() => openForm(a.dataset.open, a.dataset.oid), 50); });
document.addEventListener("click", (e) => { if (!e.target.closest(".search")) $("#gresults").hidden = true; });

/* ===================== início ===================== */
load().then(() => { route(); navigator.storage?.persist?.().catch(() => {}); });
})();
