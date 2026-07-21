import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";

const secret = randomBytes(48).toString("base64url");
const write = process.argv.includes("--write");
const envPath = path.join(process.cwd(), ".env");

if (write) {
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const line = `JWT_SECRET=${JSON.stringify(secret)}`;
  if (/^JWT_SECRET=/m.test(env)) {
    env = env.replace(/^JWT_SECRET=.*$/m, line);
  } else {
    env = `${env.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(envPath, env.endsWith("\n") ? env : `${env}\n`);
  console.log("JWT_SECRET atualizado em .env (48 bytes, base64url).");
} else {
  console.log(secret);
  console.log("");
  console.log("Copie para o .env:");
  console.log(`JWT_SECRET="${secret}"`);
  console.log("");
  console.log("Ou grave direto: pnpm env:secret -- --write");
}
