"use strict";

// PERSONALIZAÇÃO: altere aqui o limite de erros e quando a imagem aparece.
const CONFIG_JOGO = {
  mostrarImagemDesdeInicio: false,
  mostrarImagemAposErros: 2,
  maxErros: 5,
  // Mude para true depois de colocar os GIFs em assets/personagem.
  usarGifsPersonalizados: false,
};

// PERSONALIZAÇÃO: coloque sua chave pública da API do Pixabay em apiKey.
const CONFIG_IMAGENS = {
  usarBancoOnline: true,
  provedor: "pixabay",
  apiKey: "COLOQUE_SUA_CHAVE_AQUI",
  idioma: "pt",
  tipoImagem: "photo",
  safeSearch: true,
};

// PERSONALIZAÇÃO: adicione, remova ou edite palavras neste banco.
// "imagemLocal" é opcional e deve apontar para um arquivo dentro do jogo.
const BANCO_PALAVRAS = [
  { palavra: "GATO", dica: "Animal doméstico que mia.", categoria: "Animais", termoBuscaImagem: "gato animal", imagemLocal: "" },
  { palavra: "CACHORRO", dica: "Animal amigo que late.", categoria: "Animais", termoBuscaImagem: "cachorro animal", imagemLocal: "" },
  { palavra: "PEIXE", dica: "Animal que vive na água e tem nadadeiras.", categoria: "Animais", termoBuscaImagem: "peixe animal", imagemLocal: "" },
  { palavra: "CAVALO", dica: "Animal forte que pode ser montado.", categoria: "Animais", termoBuscaImagem: "cavalo animal", imagemLocal: "" },
  { palavra: "COELHO", dica: "Animal de orelhas compridas que gosta de cenoura.", categoria: "Animais", termoBuscaImagem: "coelho animal", imagemLocal: "" },
  { palavra: "PASSARO", dica: "Animal com penas que costuma voar.", categoria: "Animais", termoBuscaImagem: "pássaro animal", imagemLocal: "" },
  { palavra: "BANANA", dica: "Fruta amarela e comprida.", categoria: "Frutas", termoBuscaImagem: "banana fruta", imagemLocal: "" },
  { palavra: "MACA", dica: "Fruta vermelha, verde ou amarela muito comum no lanche.", categoria: "Frutas", termoBuscaImagem: "maçã fruta", imagemLocal: "" },
  { palavra: "UVA", dica: "Fruta pequena que cresce em cachos.", categoria: "Frutas", termoBuscaImagem: "uva fruta", imagemLocal: "" },
  { palavra: "LARANJA", dica: "Fruta cítrica que também dá nome a uma cor.", categoria: "Frutas", termoBuscaImagem: "laranja fruta", imagemLocal: "" },
  { palavra: "MELANCIA", dica: "Fruta grande, verde por fora e vermelha por dentro.", categoria: "Frutas", termoBuscaImagem: "melancia fruta", imagemLocal: "" },
  { palavra: "ABACAXI", dica: "Fruta com casca áspera e uma coroa de folhas.", categoria: "Frutas", termoBuscaImagem: "abacaxi fruta", imagemLocal: "" },
  { palavra: "LAPIS", dica: "Usado para escrever e pode ser apagado.", categoria: "Escola", termoBuscaImagem: "lápis escolar", imagemLocal: "" },
  { palavra: "CADERNO", dica: "Tem folhas para escrever e desenhar.", categoria: "Escola", termoBuscaImagem: "caderno escolar", imagemLocal: "" },
  { palavra: "BORRACHA", dica: "Usada para apagar o que foi escrito a lápis.", categoria: "Escola", termoBuscaImagem: "borracha escolar", imagemLocal: "" },
  { palavra: "MOCHILA", dica: "Carrega os materiais para a escola.", categoria: "Escola", termoBuscaImagem: "mochila escolar", imagemLocal: "" },
  { palavra: "LIVRO", dica: "Tem páginas cheias de histórias e conhecimentos.", categoria: "Escola", termoBuscaImagem: "livro infantil", imagemLocal: "" },
  { palavra: "TESOURA", dica: "Serve para cortar papel.", categoria: "Escola", termoBuscaImagem: "tesoura escolar", imagemLocal: "" },
  { palavra: "BOLA", dica: "Objeto redondo usado em muitos esportes.", categoria: "Objetos", termoBuscaImagem: "bola brinquedo", imagemLocal: "" },
  { palavra: "CADEIRA", dica: "Objeto usado para sentar.", categoria: "Objetos", termoBuscaImagem: "cadeira objeto", imagemLocal: "" },
  { palavra: "MESA", dica: "Móvel com tampo onde apoiamos objetos.", categoria: "Objetos", termoBuscaImagem: "mesa móvel", imagemLocal: "" },
  { palavra: "RELOGIO", dica: "Objeto que mostra as horas.", categoria: "Objetos", termoBuscaImagem: "relógio objeto", imagemLocal: "" },
  { palavra: "CHAVE", dica: "Objeto pequeno usado para abrir fechaduras.", categoria: "Objetos", termoBuscaImagem: "chave objeto", imagemLocal: "" },
  { palavra: "COPO", dica: "Recipiente usado para beber líquidos.", categoria: "Objetos", termoBuscaImagem: "copo objeto", imagemLocal: "" },
  { palavra: "ARVORE", dica: "Planta grande com tronco, galhos e folhas.", categoria: "Natureza", termoBuscaImagem: "árvore natureza", imagemLocal: "" },
  { palavra: "FLOR", dica: "Parte colorida e perfumada de muitas plantas.", categoria: "Natureza", termoBuscaImagem: "flor natureza", imagemLocal: "" },
  { palavra: "SOL", dica: "Estrela que ilumina e aquece o nosso planeta.", categoria: "Natureza", termoBuscaImagem: "sol céu", imagemLocal: "" },
  { palavra: "LUA", dica: "Pode ser vista brilhando no céu à noite.", categoria: "Natureza", termoBuscaImagem: "lua céu", imagemLocal: "" },
  { palavra: "NUVEM", dica: "Conjunto de gotinhas que vemos no céu.", categoria: "Natureza", termoBuscaImagem: "nuvem céu", imagemLocal: "" },
  { palavra: "RIO", dica: "Curso de água que corre pela natureza.", categoria: "Natureza", termoBuscaImagem: "rio natureza", imagemLocal: "" },
  { palavra: "AZUL", dica: "Cor muito lembrada quando olhamos para o céu.", categoria: "Cores", termoBuscaImagem: "cor azul", imagemLocal: "" },
  { palavra: "VERDE", dica: "Cor comum nas folhas das plantas.", categoria: "Cores", termoBuscaImagem: "cor verde", imagemLocal: "" },
  { palavra: "AMARELO", dica: "Cor alegre que lembra o Sol.", categoria: "Cores", termoBuscaImagem: "cor amarela", imagemLocal: "" },
  { palavra: "BONECA", dica: "Brinquedo que representa uma pessoa.", categoria: "Brinquedos", termoBuscaImagem: "boneca brinquedo", imagemLocal: "" },
  { palavra: "CARRINHO", dica: "Brinquedo com rodas que imita um carro.", categoria: "Brinquedos", termoBuscaImagem: "carrinho brinquedo", imagemLocal: "" },
  { palavra: "PETECA", dica: "Brinquedo com penas lançado com as mãos.", categoria: "Brinquedos", termoBuscaImagem: "peteca brinquedo", imagemLocal: "" },
];

// PERSONALIZAÇÃO: coloque seus GIFs nestes caminhos ou troque os nomes abaixo.
// O jogo usa emojis automaticamente quando algum arquivo não existe.
const PERSONAGENS = {
  neutro: { arquivo: "assets/personagem/neutro.gif", emoji: "🙂", rotulo: "Calmo" },
  feliz1: { arquivo: "assets/personagem/feliz1.gif", emoji: "😊", rotulo: "Feliz" },
  feliz2: { arquivo: "assets/personagem/feliz2.gif", emoji: "😄", rotulo: "Muito feliz" },
  feliz3: { arquivo: "assets/personagem/feliz3.gif", emoji: "🤩", rotulo: "Radiante" },
  bravo1: { arquivo: "assets/personagem/bravo1.gif", emoji: "😕", rotulo: "Incomodado" },
  bravo2: { arquivo: "assets/personagem/bravo2.gif", emoji: "😠", rotulo: "Bravo" },
  bravo3: { arquivo: "assets/personagem/bravo3.gif", emoji: "😡", rotulo: "Muito bravo" },
  bravo4: { arquivo: "assets/personagem/bravo4.gif", emoji: "🤬", rotulo: "Furioso" },
  bravo5: { arquivo: "assets/personagem/bravo5.gif", emoji: "🤯", rotulo: "Explodindo de raiva" },
};

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const elementos = {
  shell: document.querySelector("#game-shell"),
  category: document.querySelector("#category"),
  hint: document.querySelector("#hint"),
  word: document.querySelector("#word"),
  feedback: document.querySelector("#feedback"),
  errors: document.querySelector("#errors"),
  usedLetters: document.querySelector("#used-letters"),
  keyboard: document.querySelector("#keyboard"),
  characterStage: document.querySelector("#character-stage"),
  characterImage: document.querySelector("#character-image"),
  characterPlaceholder: document.querySelector("#character-placeholder"),
  emotionLabel: document.querySelector("#emotion-label"),
  characterMessage: document.querySelector("#character-message"),
  imageBox: document.querySelector("#word-image-box"),
  wordImage: document.querySelector("#word-image"),
  imageCredit: document.querySelector("#image-credit"),
  resultCard: document.querySelector("#result-card"),
  resultIcon: document.querySelector("#result-icon"),
  resultTitle: document.querySelector("#result-title"),
  resultText: document.querySelector("#result-text"),
  answer: document.querySelector("#answer"),
  playAgain: document.querySelector("#play-again"),
};

const estado = {
  palavraAtual: null,
  letrasUsadas: new Set(),
  erros: 0,
  acertosSeguidos: 0,
  finalizado: false,
  ultimoIndice: -1,
  imagemCarregada: false,
};

function escolherPalavra() {
  let indice = Math.floor(Math.random() * BANCO_PALAVRAS.length);
  if (BANCO_PALAVRAS.length > 1 && indice === estado.ultimoIndice) {
    indice = (indice + 1) % BANCO_PALAVRAS.length;
  }
  estado.ultimoIndice = indice;
  return BANCO_PALAVRAS[indice];
}

function renderizarPalavra(revelarTudo = false) {
  elementos.word.replaceChildren();
  [...estado.palavraAtual.palavra].forEach((letra) => {
    const slot = document.createElement("span");
    const revelada = revelarTudo || estado.letrasUsadas.has(letra);
    slot.className = `letter-slot${revelada ? " revealed" : ""}`;
    slot.textContent = revelada ? letra : "";
    slot.setAttribute("aria-label", revelada ? `Letra ${letra}` : "Letra escondida");
    elementos.word.append(slot);
  });
}

function criarTeclado() {
  elementos.keyboard.replaceChildren();
  ALFABETO.forEach((letra) => {
    const botao = document.createElement("button");
    botao.className = "key";
    botao.type = "button";
    botao.textContent = letra;
    botao.dataset.letra = letra;
    botao.setAttribute("aria-label", `Escolher a letra ${letra}`);
    botao.addEventListener("click", () => verificarLetra(letra));
    elementos.keyboard.append(botao);
  });
}

function definirFeedback(mensagem, tipo = "") {
  elementos.feedback.textContent = mensagem;
  elementos.feedback.className = `feedback${tipo ? ` ${tipo}` : ""}`;
}

function atualizarLetrasUsadas() {
  const letras = [...estado.letrasUsadas];
  elementos.usedLetters.textContent = letras.length ? letras.join(" · ") : "Nenhuma";
}

function definirPersonagem(chave, escala = 1, mensagem = "") {
  const personagem = PERSONAGENS[chave] || PERSONAGENS.neutro;
  elementos.characterStage.style.setProperty("--character-scale", escala);
  elementos.emotionLabel.textContent = personagem.rotulo;
  elementos.characterMessage.textContent = mensagem || "Estou torcendo por você!";
  elementos.characterPlaceholder.textContent = personagem.emoji;
  elementos.characterPlaceholder.setAttribute(
    "aria-label",
    `Personagem ${personagem.rotulo.toLowerCase()}`,
  );

  elementos.characterImage.onload = null;
  elementos.characterImage.onerror = null;
  elementos.characterImage.hidden = true;
  elementos.characterPlaceholder.hidden = false;
  elementos.characterImage.alt = `Personagem ${personagem.rotulo.toLowerCase()}`;

  if (!CONFIG_JOGO.usarGifsPersonalizados) {
    elementos.characterImage.removeAttribute("src");
    return;
  }

  elementos.characterImage.onload = () => {
    elementos.characterImage.hidden = false;
    elementos.characterPlaceholder.hidden = true;
  };
  elementos.characterImage.onerror = () => {
    elementos.characterImage.hidden = true;
    elementos.characterPlaceholder.hidden = false;
  };
  elementos.characterImage.src = personagem.arquivo;
}

function atualizarPersonagem(tipo = "neutro") {
  if (tipo === "vitoria") {
    definirPersonagem("feliz3", 1.2, "Você conseguiu! Que alegria!");
    return;
  }
  if (tipo === "acerto") {
    const nivel = Math.min(3, Math.max(1, estado.acertosSeguidos));
    definirPersonagem(`feliz${nivel}`, 1 + nivel * 0.04, "Muito bem! Continue assim!");
    return;
  }
  if (tipo === "erro" || tipo === "derrota") {
    const nivel = Math.min(CONFIG_JOGO.maxErros, Math.max(1, estado.erros));
    definirPersonagem(
      `bravo${nivel}`,
      tipo === "derrota" ? 1.65 : 1 + nivel * 0.1,
      tipo === "derrota" ? "Agora eu fiquei muito bravo!" : "Cuidado, estou ficando bravo!",
    );
    return;
  }
  definirPersonagem("neutro", 1, "Estou torcendo por você!");
}

function verificarLetra(letra) {
  if (estado.finalizado || estado.letrasUsadas.has(letra)) return;
  estado.letrasUsadas.add(letra);

  const botao = elementos.keyboard.querySelector(`[data-letra="${letra}"]`);
  botao.disabled = true;

  if (estado.palavraAtual.palavra.includes(letra)) {
    botao.classList.add("correct");
    registrarAcerto(letra);
  } else {
    botao.classList.add("wrong");
    registrarErro(letra);
  }
  atualizarLetrasUsadas();
}

function registrarAcerto() {
  estado.acertosSeguidos += 1;
  renderizarPalavra();
  definirFeedback("Muito bem! Você acertou uma letra!", "positive");
  atualizarPersonagem("acerto");
  verificarVitoria();
}

function registrarErro() {
  estado.erros += 1;
  estado.acertosSeguidos = 0;
  elementos.errors.textContent = `Erros: ${estado.erros}/${CONFIG_JOGO.maxErros}`;
  definirFeedback("Ops! Essa letra não aparece na palavra.", "negative");
  atualizarPersonagem("erro");
  carregarImagemDaPalavra(estado.palavraAtual);
  verificarDerrota();
}

function palavraCompleta() {
  return [...estado.palavraAtual.palavra].every((letra) =>
    estado.letrasUsadas.has(letra),
  );
}

function verificarVitoria() {
  if (palavraCompleta()) finalizarJogo("vitoria");
}

function verificarDerrota() {
  if (estado.erros >= CONFIG_JOGO.maxErros) finalizarJogo("derrota");
}

function desativarTeclado() {
  elementos.keyboard.querySelectorAll("button").forEach((botao) => {
    botao.disabled = true;
  });
}

function finalizarJogo(resultado) {
  estado.finalizado = true;
  desativarTeclado();
  renderizarPalavra(true);
  elementos.answer.textContent = `A palavra era: ${estado.palavraAtual.palavra}`;
  elementos.resultCard.hidden = false;
  elementos.shell.classList.toggle("game-over-loss", resultado === "derrota");

  if (resultado === "vitoria") {
    atualizarPersonagem("vitoria");
    elementos.resultIcon.textContent = "⭐";
    elementos.resultTitle.textContent = "Parabéns!";
    elementos.resultText.textContent = "Você descobriu a palavra!";
  } else {
    atualizarPersonagem("derrota");
    elementos.resultIcon.textContent = "💥";
    elementos.resultTitle.textContent = "Fim de jogo!";
    elementos.resultText.textContent = "O personagem ficou muito bravo!";
  }
  elementos.playAgain.focus();
}

function chavePixabayConfigurada() {
  const chave = CONFIG_IMAGENS.apiKey.trim();
  return Boolean(chave && chave !== "COLOQUE_SUA_CHAVE_AQUI");
}

async function buscarImagemOnline(termoBusca) {
  if (
    !CONFIG_IMAGENS.usarBancoOnline ||
    CONFIG_IMAGENS.provedor !== "pixabay" ||
    !chavePixabayConfigurada()
  ) {
    return null;
  }

  const parametros = new URLSearchParams({
    key: CONFIG_IMAGENS.apiKey,
    q: termoBusca,
    lang: CONFIG_IMAGENS.idioma,
    image_type: CONFIG_IMAGENS.tipoImagem,
    safesearch: String(CONFIG_IMAGENS.safeSearch),
    per_page: "3",
  });

  try {
    const resposta = await fetch(`https://pixabay.com/api/?${parametros}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    const imagem = dados.hits?.[0];
    if (!imagem?.webformatURL) return null;
    return {
      url: imagem.webformatURL,
      credito: imagem.user
        ? `Imagem de ${imagem.user} no Pixabay`
        : "Imagem do Pixabay",
      pagina: imagem.pageURL || "https://pixabay.com/",
    };
  } catch {
    return null;
  }
}

function mostrarImagemDaPalavra(urlImagem, credito = "", pagina = "") {
  elementos.wordImage.onload = () => {
    elementos.imageBox.hidden = false;
    estado.imagemCarregada = true;
  };
  elementos.wordImage.onerror = esconderImagemDaPalavra;
  elementos.wordImage.src = urlImagem;
  elementos.wordImage.alt = `Ajuda visual da categoria ${estado.palavraAtual.categoria}`;
  elementos.imageCredit.replaceChildren();
  if (credito) {
    const link = document.createElement("a");
    link.textContent = credito;
    link.href = pagina || "https://pixabay.com/";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    elementos.imageCredit.append(link);
  }
}

function esconderImagemDaPalavra() {
  elementos.imageBox.hidden = true;
  elementos.wordImage.removeAttribute("src");
  elementos.imageCredit.replaceChildren();
  estado.imagemCarregada = false;
}

async function carregarImagemDaPalavra(palavraAtual) {
  const podeMostrar =
    CONFIG_JOGO.mostrarImagemDesdeInicio ||
    estado.erros >= CONFIG_JOGO.mostrarImagemAposErros;
  if (!podeMostrar || estado.imagemCarregada) return;

  const imagemOnline = await buscarImagemOnline(palavraAtual.termoBuscaImagem);
  if (imagemOnline && estado.palavraAtual === palavraAtual) {
    mostrarImagemDaPalavra(
      imagemOnline.url,
      imagemOnline.credito,
      imagemOnline.pagina,
    );
    return;
  }

  if (palavraAtual.imagemLocal && estado.palavraAtual === palavraAtual) {
    mostrarImagemDaPalavra(palavraAtual.imagemLocal);
  } else {
    esconderImagemDaPalavra();
  }
}

function iniciarJogo() {
  estado.palavraAtual = escolherPalavra();
  estado.letrasUsadas = new Set();
  estado.erros = 0;
  estado.acertosSeguidos = 0;
  estado.finalizado = false;
  estado.imagemCarregada = false;

  elementos.shell.classList.remove("game-over-loss");
  elementos.resultCard.hidden = true;
  elementos.category.textContent = estado.palavraAtual.categoria;
  elementos.hint.textContent = estado.palavraAtual.dica;
  elementos.errors.textContent = `Erros: 0/${CONFIG_JOGO.maxErros}`;
  atualizarLetrasUsadas();
  esconderImagemDaPalavra();
  renderizarPalavra();
  criarTeclado();
  definirFeedback("Escolha uma letra para começar.");
  atualizarPersonagem();
  carregarImagemDaPalavra(estado.palavraAtual);
}

function reiniciarJogo() {
  iniciarJogo();
}

document.querySelector("#restart-top").addEventListener("click", reiniciarJogo);
document.querySelector("#restart-bottom").addEventListener("click", reiniciarJogo);
elementos.playAgain.addEventListener("click", reiniciarJogo);

document.addEventListener("keydown", (evento) => {
  const letra = evento.key.toUpperCase();
  if (ALFABETO.includes(letra)) verificarLetra(letra);
});

iniciarJogo();
