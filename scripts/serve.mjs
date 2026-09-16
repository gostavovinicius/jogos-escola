import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const tipos = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm" };
export function criarServidor() {
  return http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      let arquivo = path.resolve(root, "." + pathname);
      const relativo = path.relative(root, arquivo);
      if (relativo.startsWith("..") || path.isAbsolute(relativo) || pathname.includes("/.git")) {
        res.writeHead(403).end(); return;
      }
      if ((await stat(arquivo)).isDirectory()) arquivo = path.join(arquivo, "index.html");
      res.setHeader("Content-Type", (tipos[path.extname(arquivo)] || "application/octet-stream") + "; charset=utf-8");
      res.end(await readFile(arquivo));
    } catch { res.writeHead(404).end("Arquivo não encontrado"); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  criarServidor().listen(4173, "127.0.0.1", () => console.log("Jogo disponível em http://127.0.0.1:4173/jogos/meus-jogos/corrida.html"));
}
