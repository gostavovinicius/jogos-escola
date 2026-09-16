import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
const root = fileURLToPath(new URL("../", import.meta.url));
const ignorados = new Set([".git", "node_modules", ".pnpm-store", "test-results"]);
let verificados = 0;
async function verificar(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (ignorados.has(item.name)) continue;
    const arquivo = path.join(dir, item.name);
    if (item.isDirectory()) { await verificar(arquivo); continue; }
    if (/\.m?js$/.test(item.name)) {
      const r = spawnSync(process.execPath, ["--check", arquivo], { encoding: "utf8" });
      if (r.status !== 0) throw new Error(r.stderr);
      verificados++;
    }
    if (item.name.endsWith(".html")) {
      const texto = await readFile(arquivo, "utf8");
      for (const script of texto.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        if (script[1].trim()) new vm.Script(script[1], { filename: arquivo });
      }
      for (const ref of texto.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"/gi)) {
        if (/^(https?:|data:|\/\/)/.test(ref[1])) continue;
        await access(path.resolve(dir, ref[1].split("?")[0]));
      }
      verificados++;
    }
  }
}
await verificar(root);
console.log(verificados + " arquivos: sintaxe JavaScript e referências locais de scripts/estilos válidas.");
