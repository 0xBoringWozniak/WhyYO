import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const standaloneRoot = path.join(root, ".next", "standalone", "apps", "web");
const standaloneNext = path.join(standaloneRoot, ".next");
const sourceStatic = path.join(root, ".next", "static");
const targetStatic = path.join(standaloneNext, "static");
const sourcePublic = path.join(root, "public");
const targetPublic = path.join(standaloneRoot, "public");
const serverEntrypoint = path.join(standaloneRoot, "server.js");

mkdirSync(standaloneNext, { recursive: true });

if (existsSync(sourceStatic) && !existsSync(targetStatic)) {
  cpSync(sourceStatic, targetStatic, { recursive: true });
}

if (existsSync(sourcePublic) && !existsSync(targetPublic)) {
  cpSync(sourcePublic, targetPublic, { recursive: true });
}

process.env.HOSTNAME ||= "0.0.0.0";
process.env.PORT ||= "3000";

const child = spawn(process.execPath, [serverEntrypoint], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
