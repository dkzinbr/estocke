import { randomBytes } from "crypto";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const raw = execSync("pnpm dlx create-db@latest --region us-east-1 --json", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

const start = raw.indexOf("{");
const end = raw.lastIndexOf("}");
if (start < 0 || end < 0) {
  console.error("Could not parse create-db output.");
  console.error(raw);
  process.exit(1);
}

const data = JSON.parse(raw.slice(start, end + 1));
if (!data.connectionString) {
  console.error("No connectionString in create-db response.");
  process.exit(1);
}

const envPath = path.join(process.cwd(), ".env");
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

function setEnv(key, value) {
  const line = `${key}=${JSON.stringify(value)}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(env)) {
    env = env.replace(re, line);
  } else {
    env = `${env.trimEnd()}\n${line}\n`;
  }
}

setEnv("DATABASE_URL", data.connectionString);
setEnv("CLAIM_URL", data.claimUrl || "");

if (!/^JWT_SECRET=/m.test(env)) {
  setEnv("JWT_SECRET", randomBytes(32).toString("hex"));
}
if (!/^APP_URL=/m.test(env)) {
  setEnv("APP_URL", "http://localhost:3000");
}

fs.writeFileSync(envPath, env.endsWith("\n") ? env : `${env}\n`);
fs.writeFileSync(
  path.join(process.cwd(), ".claim-url.txt"),
  `${data.claimUrl || ""}\n`,
);

console.log("DB_READY");
console.log(`region: ${data.region || "us-east-1"}`);
console.log(`expires: ${data.deletionDate || "unknown"}`);
console.log("claim URL saved to .claim-url.txt");
