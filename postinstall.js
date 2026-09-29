// Postinstall: installeert app\ op een Windows-vriendelijke manier.
// Bewust GEEN `npm --prefix`-keten (kan op Windows in een recursie-storm
// vastlopen waarbij npm zichzelf herhaalt tot 'npm' niet meer gevonden
// wordt) én een BMS_POST-vangnet tegen herhaling.
"use strict";

if (process.env.BMS_POST) process.exit(0); // recursie-vangnet
process.env.BMS_POST = "1";

const { spawnSync } = require("child_process");
const path = require("path");

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const appDir = path.join(__dirname, "app");

console.log("[BlockyMod] app wordt geïnstalleerd (eerste keer: even geduld)...");
const r = spawnSync(npmCmd, ["install", "--no-audit", "--no-fund"], {
  cwd: appDir,
  stdio: "inherit",
  env: process.env,
  shell: true
});

if (r.status !== 0) {
  console.error("\n[BlockyMod] npm install in app\\ is mislukt.");
  console.error("  Probeer handmatig:");
  console.error("    cd app");
  console.error("    npm install");
  console.error("  Blijft 'EPERM'/vergrendeld terugkomen? Sluit alle BlockyMod-");
  console.error("  vensters, doe in app:  rmdir /s /q node_modules  en probeer opnieuw.");
  console.error("  Alternatief: OpenInBrowser.bat (de app werkt ook in je browser).");
  process.exit(r.status === null ? 1 : r.status);
}

console.log("[BlockyMod] app geïnstalleerd ✔  Starten met:  npm start");
