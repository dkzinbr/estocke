/**
 * Sobe DATABASE_URL, JWT_SECRET e APP_URL para Production, Preview e Development na Vercel.
 *
 * Uso (com o projeto já linkado: `pnpm dlx vercel link`):
 *   node scripts/vercel-set-env.mjs
 *   node scripts/vercel-set-env.mjs --project=estocke-adc
 */
import { execFileSync, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const root = process.cwd();
const envPath = path.join(root, ".env");
const eqArg = process.argv.find((a) => a.startsWith("--project="));
const flagIdx = process.argv.indexOf("--project");
const project =
  eqArg?.slice("--project=".length) ||
  (flagIdx >= 0 ? process.argv[flagIdx + 1] : undefined);

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`.env não encontrado em ${filePath}`);
  }
  const map = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

function resolvePnpm() {
  if (process.platform === "win32") {
    return "pnpm.CMD";
  }
  return "pnpm";
}

function vercel(args, input) {
  const pnpmBin = resolvePnpm();
  const full = ["dlx", "vercel", ...args];
  if (project) full.push("--project", project);
  try {
    execFileSync(pnpmBin, full, {
      cwd: root,
      input,
      stdio: input ? ["pipe", "inherit", "inherit"] : "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });
  } catch (err) {
    // Fallback: run via cmd string (Windows PATH quirks)
    const quoted = full
      .map((part) => (/\s/.test(part) ? `"${part}"` : part))
      .join(" ");
    execSync(`pnpm ${quoted}`, {
      cwd: root,
      input,
      stdio: input ? ["pipe", "inherit", "inherit"] : "inherit",
      env: process.env,
      shell: true,
    });
  }
}

function addEnv(name, value, target) {
  vercel(["env", "add", name, target, "--yes"], `${value}\n`);
}

const local = readEnvFile(envPath);
const databaseUrl = local.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL ausente no .env local.");
}

let jwtSecret = local.JWT_SECRET;
if (
  !jwtSecret ||
  /troque|cole-aqui|gere-um|placeholder/i.test(jwtSecret)
) {
  jwtSecret = randomBytes(48).toString("base64url");
  console.log("JWT_SECRET fraco/ausente no .env — gerando um novo para a Vercel.");
}

const appUrl =
  local.APP_URL ||
  (project === "estocke-adc"
    ? "https://estocke-adc.vercel.app"
    : "https://estocke-gamma.vercel.app");

const targets = ["production", "preview", "development"];

console.log(
  `Configurando DATABASE_URL, JWT_SECRET e APP_URL em: ${targets.join(", ")}`,
);
if (project) console.log(`Projeto: ${project}`);

for (const target of targets) {
  console.log(`\n→ ${target}`);
  addEnv("DATABASE_URL", databaseUrl, target);
  addEnv("JWT_SECRET", jwtSecret, target);
  addEnv("APP_URL", appUrl, target);
}

console.log("\nConcluído. Redeploy na Vercel para aplicar.");
vercel(["env", "ls"]);
