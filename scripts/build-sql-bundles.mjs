#!/usr/bin/env node
/**
 * Gera os arquivos SQL para colar no SQL Editor do Supabase:
 *   supabase/instalacao-completa.sql   → projeto novo (todas as fases)
 *   supabase/atualizacao-fase-N.sql    → só o que a fase N acrescenta, com verificação no final
 * Uso: npm run sql:bundles
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

// Fase de cada migração (pelo prefixo do arquivo)
const PHASES = { 2: ["20261127000003_phase2_suppliers_libraries.sql"] };

const CHECKS = {
  2: {
    tabela: ["suppliers", "supplier_contacts", "supplier_capabilities", "project_suppliers", "import_batches", "packaging_items", "packaging_compat", "library_items"],
    "função": ["seed_phase2_defaults", "undo_import", "load_demo_suppliers", "global_search"],
  },
};

function check(phase) {
  const items = Object.entries(CHECKS[phase]).flatMap(([tipo, nomes]) => nomes.map((n) => `('${tipo}','${n}')`));
  return `
-- ===== Verificação: o resultado aparece embaixo, em Results =====
with esperado(tipo, nome) as (values ${items.join(", ")}),
existe(tipo, nome) as (
  select 'tabela', table_name::text from information_schema.tables where table_schema = 'public'
  union all select 'função', routine_name::text from information_schema.routines where routine_schema = 'public'
)
select case
  when count(*) filter (where x.nome is null) = 0 then '✅ Atualização da Fase ${phase} instalada (' || count(*) || ' itens conferidos)'
  else '⚠️ Faltando: ' || string_agg(e.tipo || ' ' || e.nome, ', ') filter (where x.nome is null)
end as resultado
from esperado e left join (select distinct tipo, nome from existe) x on x.tipo = e.tipo and x.nome = e.nome;
`;
}

const header = (title, lines) => [`-- Beauty Development Studio — ${title}`, ...lines.map((l) => `-- ${l}`), ""].join("\n");
const body = (list) => list.map((f) => `-- ===== ${f} =====\n${readFileSync(join(dir, f), "utf8")}\n`).join("\n");

writeFileSync(
  join(root, "supabase", "instalacao-completa.sql"),
  header("instalação completa (todas as fases)", ["Use APENAS em um projeto Supabase novo, sem tabelas.", "SQL Editor → New query → cole tudo → Run."]) + body(files),
);
for (const [phase, list] of Object.entries(PHASES)) {
  writeFileSync(
    join(root, "supabase", `atualizacao-fase-${phase}.sql`),
    header(`atualização da Fase ${phase}`, ["Rode UMA vez, depois da instalação da Fase 1.", "SQL Editor → New query → cole tudo → Run. No final aparece ✅ ou ⚠️."]) + body(list) + check(Number(phase)),
  );
}
console.log("Arquivos SQL gerados em supabase/.");
