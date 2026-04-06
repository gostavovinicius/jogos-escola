/* Corrida do Saber - Bootstrap */

window.__corridaDoSaberErroExibido = false;
window.exibirErroDeInicializacaoJogo = function (
  mensagem,
  detalheTecnico = "",
) {
  if (window.__corridaDoSaberErroExibido) return;
  window.__corridaDoSaberErroExibido = true;
  const detalheSeguro = detalheTecnico
    ? `<div style="margin:12px 0 0;font-size:0.9rem;line-height:1.5;color:rgba(255,255,255,0.82);">Detalhe tecnico: ${String(
        detalheTecnico,
      )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</div>`
    : "";
  document.body.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(180deg,#163a6b,#08111f);color:white;font-family:'Trebuchet MS','Segoe UI',sans-serif;text-align:center;">
      <div style="max-width:520px;padding:28px;border-radius:20px;background:rgba(7,15,28,0.82);border:1px solid rgba(255,255,255,0.18);box-shadow:0 18px 50px rgba(0,0,0,0.35);">
        <h1 style="margin:0 0 12px;font-size:clamp(1.8rem,4vw,2.4rem);">Corrida do Saber</h1>
        <div style="margin:0;font-size:1rem;line-height:1.6;">${mensagem}</div>
        ${detalheSeguro}
      </div>
    </div>
  `;
};
window.addEventListener(
  "error",
  (evento) => {
    const alvo = evento.target;
    if (alvo && alvo.tagName === "SCRIPT") {
      window.exibirErroDeInicializacaoJogo(
        "Nao foi possivel carregar os arquivos do jogo. Verifique sua conexao e tente recarregar a pagina.",
      );
    }
  },
  true,
);
