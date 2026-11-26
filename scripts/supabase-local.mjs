#!/usr/bin/env node
/**
 * Gerencia o Supabase local (somente desenvolvimento/testes).
 *
 *   npm run supabase:local -- setup    gera senhas/chaves e cria .env.local
 *   npm run supabase:local -- start    sobe os containers
 *   npm run supabase:local -- migrate  aplica supabase/migrations/*.sql
 *   npm run supabase:local -- stop     para os containers (dados preservados)
 *   npm run supabase:local -- reset    APAGA os dados locais e recomeça
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localDir = join(root, "supabase", "local");
const envFile = join(localDir, ".env");
const appEnvFile = join(root, ".env.local");
const compose = `docker compose -f "${join(localDir, "docker-compose.yml")}" --env-file "${envFile}"`;

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", cwd: root, ...opts });
}

function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function sign(secret, role) {
  return new SignJWT({ role, iss: "supabase-local" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("10y")
    .sign(new TextEncoder().encode(secret));
}

async function setup() {
  if (existsSync(envFile)) {
    console.log("supabase/local/.env já existe — mantendo as chaves atuais.");
  } else {
    const JWT_SECRET = randomBytes(32).toString("hex");
    const POSTGRES_PASSWORD = randomBytes(16).toString("hex");
    const ANON_KEY = await sign(JWT_SECRET, "anon");
    const SERVICE_ROLE_KEY = await sign(JWT_SECRET, "service_role");
    writeFileSync(
      envFile,
      [
        `JWT_SECRET=${JWT_SECRET}`,
        `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
        `ANON_KEY=${ANON_KEY}`,
        `SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}`,
        "",
      ].join("\n"),
      { mode: 0o600 },
    );
    console.log("Chaves locais geradas em supabase/local/.env");
  }
  const env = readEnv(envFile);
  if (!existsSync(appEnvFile)) {
    writeFileSync(
      appEnvFile,
      [
        "# Ambiente LOCAL (gerado por scripts/supabase-local.mjs)",
        "NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321",
        `NEXT_PUBLIC_SUPABASE_ANON_KEY=${env.ANON_KEY}`,
        `SUPABASE_SERVICE_ROLE_KEY=${env.SERVICE_ROLE_KEY}`,
        "# ANTHROPIC_API_KEY=  (opcional — habilita os recursos de IA)",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );
    console.log(".env.local criado para o app.");
  } else {
    console.log(".env.local já existe — não foi alterado.");
  }
}

function psql(user) {
  const pw = readEnv(envFile).POSTGRES_PASSWORD;
  return `${compose} exec -T -e PGPASSWORD=${pw} db psql -h localhost -U ${user} -d postgres`;
}

function waitForDb() {
  for (let i = 0; i < 60; i++) {
    try {
      execSync(`${compose} exec -T db pg_isready -U postgres -h localhost`, { stdio: "ignore" });
      // auth e storage aplicam as próprias migrações ao iniciar; esperamos que terminem
      const out = execSync(
        `${psql("supabase_admin")} -tAc "select exists(select 1 from information_schema.columns where table_schema='storage' and table_name='buckets' and column_name='public') and exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='is_anonymous')"`,
      ).toString().trim();
      if (out === "t") return;
    } catch {}
    execSync("sleep 2");
  }
  throw new Error("O banco local não ficou pronto a tempo.");
}

function migrate() {
  waitForDb();
  const dir = join(root, "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  execSync(
    `${psql("supabase_admin")} -v ON_ERROR_STOP=1 -c "create schema if not exists _local; create table if not exists _local.migrations (name text primary key, applied_at timestamptz default now())"`,
    { stdio: "ignore" },
  );
  for (const f of files) {
    const done = execSync(
      `${psql("supabase_admin")} -tAc "select 1 from _local.migrations where name='${f}'"`,
    ).toString().trim();
    if (done === "1") continue;
    console.log(`→ aplicando ${f}`);
    // Executa como "postgres", o mesmo papel usado pelo SQL Editor do Supabase hospedado.
    sh(`${psql("postgres")} -v ON_ERROR_STOP=1 -1 -f - < "${join(dir, f)}"`);
    execSync(
      `${psql("supabase_admin")} -c "insert into _local.migrations(name) values ('${f}')"`,
      { stdio: "ignore" },
    );
  }
  // recarrega o cache de schema do PostgREST
  execSync(`${psql("supabase_admin")} -c "notify pgrst, 'reload schema'"`, { stdio: "ignore" });
  console.log("Migrações aplicadas.");
}

const cmd = process.argv[2];
if (cmd === "setup") await setup();
else if (cmd === "start") {
  if (!existsSync(envFile)) await setup();
  sh(`${compose} up -d`);
  migrate();
} else if (cmd === "migrate") migrate();
else if (cmd === "stop") sh(`${compose} stop`);
else if (cmd === "reset") {
  sh(`${compose} down -v`);
  sh(`${compose} up -d`);
  migrate();
} else {
  console.log("Uso: npm run supabase:local -- <setup|start|migrate|stop|reset>");
  process.exit(1);
}
