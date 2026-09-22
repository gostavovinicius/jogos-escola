// Shared gameplay rules; no DOM or renderer dependency.
const PERFIS_POLICIA = {
  perseguidora: {
    antecipacao: 0.3, lateral: 0, frente: -1, curva: 1.12,
    agressividade: 0.42, tatica: "pressao", inteligencia: "basica",
    leitura: 0.72, reacao: 0.28,
  },
  moto: {
    antecipacao: 0.65, lateral: 3.2, frente: 1.4, curva: 1.48,
    agressividade: 0.4, tatica: "aproximacao-lateral", inteligencia: "media",
    leitura: 0.94, reacao: 0.16,
  },
  interceptadora: {
    antecipacao: 1.65, lateral: 0, frente: 5, curva: 1.18,
    agressividade: 0.46, tatica: "interceptacao", inteligencia: "inteligente",
    leitura: 1.14, reacao: 0.08,
  },
  flanqueadora: {
    antecipacao: 0.8, lateral: -12, frente: 2.5, curva: 1.28,
    agressividade: 0.44, tatica: "flanco", inteligencia: "inteligente",
    leitura: 1.08, reacao: 0.1,
  },
};

const PERFIS_INTELIGENCIA = {
  facil: {
    nome: "facil", previsao: 0.42, abertura: 0.5, curva: 0.86,
    agressividade: -0.12, bonusVelocidade: -0.08, captura: 9.5,
    cerco: false, influenciaObjetivo: 0, formacao: 0.08, reacao: 1.28,
  },
  media: {
    nome: "media", previsao: 0.78, abertura: 0.82, curva: 0.98,
    agressividade: 0, bonusVelocidade: 0, captura: 11,
    cerco: true, influenciaObjetivo: 0.24, formacao: 0.24, reacao: 1,
  },
  dificil: {
    nome: "dificil", previsao: 1.12, abertura: 1, curva: 1.1,
    agressividade: 0.1, bonusVelocidade: 0.08, captura: 12.5,
    cerco: true, influenciaObjetivo: 0.42, formacao: 0.38, reacao: 0.72,
  },
};

export function obterPerfilInteligencia(dificuldade = "media") {
  return PERFIS_INTELIGENCIA[dificuldade] || PERFIS_INTELIGENCIA.media;
}

export function planejarPerseguicao({ estrategia, dificuldade = "media", jogador, velocidade, frente, policial }) {
  const perfil = PERFIS_POLICIA[estrategia] || PERFIS_POLICIA.perseguidora;
  const inteligencia = obterPerfilInteligencia(dificuldade);
  const distancia = Math.hypot(jogador.x - policial.x, jogador.z - policial.z);
  const rapidez = Math.hypot(velocidade.x, velocidade.z);
  const direcao = rapidez > 1.2 ? { x: velocidade.x / rapidez, z: velocidade.z / rapidez } : frente;
  const captura = distancia < inteligencia.captura;
  // Fade the wide approach into a close position. Stopped targets must not be orbited forever.
  const abertura = Math.max(0, Math.min(1, (distancia - 8) / 22));
  const lateral = perfil.lateral * inteligencia.abertura * (0.12 + 0.88 * abertura);
  const adiante = perfil.frente * (0.25 + 0.75 * abertura);
  const adaptacaoVelocidade = 0.72 + Math.min(0.38, rapidez / 80);
  const horizonte = perfil.antecipacao * perfil.leitura * inteligencia.previsao
    * adaptacaoVelocidade * Math.min(1, distancia / 30);
  return {
    alvo: {
      x: jogador.x + velocidade.x * horizonte + direcao.x * adiante - direcao.z * lateral,
      z: jogador.z + velocidade.z * horizonte + direcao.z * adiante + direcao.x * lateral,
    },
    inteligencia: perfil.inteligencia,
    nivelDificuldade: inteligencia.nome,
    tatica: perfil.tatica,
    agressividade: Math.max(0.12, perfil.agressividade + inteligencia.agressividade),
    respostaCurva: perfil.curva * inteligencia.curva,
    bonusVelocidade: inteligencia.bonusVelocidade,
    amortecimento: 0.992,
    influenciaObjetivo: inteligencia.influenciaObjetivo,
    formacao: inteligencia.formacao,
    intervaloReacao: perfil.reacao * inteligencia.reacao * (captura ? 0.55 : 1),
    modoCerco: inteligencia.cerco && rapidez < 6.5 && distancia < 16,
    modoCapturaDireta: captura,
  };
}

export function preverInterceptacao(origem, alvo, velocidade, rapidez, destino, vida = 5.4) {
  const x = alvo.x - origem.x, y = alvo.y - origem.y, z = alvo.z - origem.z;
  const a = velocidade.lengthSq() - rapidez * rapidez;
  const b = 2 * (x * velocidade.x + y * velocidade.y + z * velocidade.z);
  const c = x * x + y * y + z * z;
  let tempo = Math.sqrt(c) / rapidez;
  if (Math.abs(a) < 1e-8) {
    if (b < -1e-8) tempo = -c / b;
  } else {
    const discriminante = b * b - 4 * a * c;
    if (discriminante >= 0) {
      const raiz = Math.sqrt(discriminante);
      const tempos = [(-b - raiz) / (2 * a), (-b + raiz) / (2 * a)].filter(t => t >= 0);
      if (tempos.length) tempo = Math.min(...tempos);
    }
  }
  return destino.copy(alvo).addScaledVector(velocidade, Math.min(vida, Math.max(0, tempo)));
}

export function criarConsultasJogabilidade(RAPIER, THREE, coberturas) {
  const bola = new RAPIER.Ball(0.48);
  const zero = new THREE.Vector3(), identidade = new THREE.Quaternion();
  const deslocamento = new THREE.Vector3(), movimentoAlvo = new THREE.Vector3();
  const inicioAlvo = new THREE.Vector3(), origemRaio = new THREE.Vector3(), direcaoRaio = new THREE.Vector3();
  // Include the visible cabin as well as the physical chassis. No distant hit sphere.
  const carroAlvo = new RAPIER.Cuboid(1.38, 1.3, 2.38);
  const raio = new RAPIER.Ray(origemRaio, direcaoRaio);

  function tempoObstaculo(origem, movimento, maximo = 1, espessura = true) {
    let primeiro = Infinity;
    for (const corpo of coberturas) {
      if (!corpo.rigidBody?.isEnabled()) continue;
      for (const collider of corpo.colliders) {
        if (!collider.isEnabled()) continue;
        let tempo;
        if (espessura) {
          const hit = collider.castShape(zero, bola, origem, identidade, movimento, 0, Math.min(maximo, primeiro), true);
          tempo = hit?.time_of_impact ?? -1;
        } else {
          origemRaio.copy(origem); direcaoRaio.copy(movimento);
          tempo = collider.castRay(raio, Math.min(maximo, primeiro), true);
        }
        if (Number.isFinite(tempo) && tempo >= 0 && tempo <= maximo) primeiro = Math.min(primeiro, tempo);
      }
    }
    return primeiro;
  }

  function caminhoLivre(a, b) {
    deslocamento.subVectors(b, a);
    return tempoObstaculo(a, deslocamento, 1, false) === Infinity;
  }

  function primeiroImpacto(origem, movimento, corpo, inicioJogador) {
    inicioAlvo.copy(inicioJogador); inicioAlvo.y += 0.5;
    movimentoAlvo.subVectors(corpo.position, inicioJogador);
    const hit = bola.castShape(origem, identidade, movimento, carroAlvo, inicioAlvo,
      corpo.quaternion, movimentoAlvo, 0, 1, true);
    const tempoJogador = hit?.time_of_impact ?? Infinity;
    const tempoCenario = tempoObstaculo(origem, movimento, Math.min(1, tempoJogador));
    if (tempoCenario <= tempoJogador && tempoCenario !== Infinity) return { tipo: "cenario", tempo: tempoCenario };
    if (tempoJogador <= 1) return { tipo: "jogador", tempo: tempoJogador };
    return null;
  }

  function distanciaCarrocerias(a, b, maximo = 1.6) {
    const contato = a.colliders[0].shape.contactShape(a.position, a.quaternion,
      b.colliders[0].shape, b.position, b.quaternion, maximo);
    return contato ? Math.max(0, contato.distance) : Infinity;
  }
  return { caminhoLivre, primeiroImpacto, distanciaCarrocerias };
}

export function pressaoDeCaptura({ distancia, desnivel, velocidadeRelativa, contato, livre, noChao }) {
  if (!livre || !noChao || desnivel > 1.25 || distancia >= 1.6) return 0;
  const proximidade = Math.max(0, 1 - distancia / 1.6);
  const sincronia = Math.max(0, 1 - velocidadeRelativa / 12);
  return proximidade * (0.75 + 0.25 * sincronia) + (contato ? 0.5 : 0);
}

export function criarControleRampas(THREE, rampas) {
  const estados = new WeakMap();
  const local = new THREE.Vector3(), frente = new THREE.Vector3(), subida = new THREE.Vector3();
  const normalTopo = new THREE.Vector3(), normalContato = new THREE.Vector3();
  const inversa = new THREE.Quaternion(), cima = new THREE.Vector3();

  function atualizar(corpo, contatos, delta, modelo, fator = 0.78) {
    let estado = estados.get(corpo);
    if (!estado) {
      estado = {
        rampa: null, armado: false, disparou: false, ausencia: 0, cooldown: 0,
        vooRestante: 0, velocidadeLancamento: 0,
      };
      estados.set(corpo, estado);
    }
    estado.cooldown = Math.max(0, estado.cooldown - delta);
    let topo = null;
    let apoioForaDaRampa = false;
    for (const contato of contatos) {
      const outro = contato.a === corpo ? contato.b : contato.b === corpo ? contato.a : null;
      if (!outro) continue;
      normalContato.copy(contato.normal).multiplyScalar(contato.a === corpo ? -1 : 1);
      if (!rampas.has(outro)) {
        if (normalContato.y > 0.58) apoioForaDaRampa = true;
        continue;
      }
      normalTopo.set(0, 1, 0).applyQuaternion(outro.quaternion);
      if (normalContato.dot(normalTopo) > 0.85) topo = outro;
    }
    if (apoioForaDaRampa) estado.vooRestante = 0;
    if (estado.vooRestante > 0 && !topo && !apoioForaDaRampa) {
      estado.vooRestante = Math.max(0, estado.vooRestante - delta);
      const horizontal = Math.hypot(corpo.velocity.x, corpo.velocity.z);
      // Queda brusca significa impacto lateral, não arrasto: adota a nova
      // referência para nunca reimpulsionar o carro contra um obstáculo.
      if (horizontal < estado.velocidadeLancamento * 0.94) {
        estado.velocidadeLancamento = horizontal;
      }
      // A correção por quadro é limitada ao arrasto esperado.
      if (horizontal > 0.01 && horizontal < estado.velocidadeLancamento) {
        const escala = Math.min(
          estado.velocidadeLancamento / horizontal,
          1 + Math.min(0.012, delta * 0.72),
        );
        corpo.velocity.x *= escala;
        corpo.velocity.z *= escala;
      }
    }
    if (topo) {
      if (estado.rampa !== topo) Object.assign(estado, { rampa: topo, armado: false, disparou: false });
      estado.ausencia = 0;
    } else estado.ausencia += delta;
    const rampa = estado.rampa;
    if (!rampa || !rampa.rigidBody || estado.ausencia > 0.12) {
      estado.rampa = null; estado.armado = false; return false;
    }
    inversa.copy(rampa.quaternion).invert();
    local.copy(corpo.position).sub(rampa.position).applyQuaternion(inversa);
    subida.set(0, 0, -1).applyQuaternion(rampa.quaternion); subida.y = 0; subida.normalize();
    frente.set(0, 0, -1).applyQuaternion(corpo.quaternion);
    cima.set(0, 1, 0).applyQuaternion(corpo.quaternion);
    const velocidade = corpo.velocity.x * subida.x + corpo.velocity.z * subida.z;
    const valido = cima.y > 0.72 && frente.dot(subida) > 0.65 && velocidade >= 6
      && Math.abs(local.x) < 5.6 && local.z >= -11.5 && local.z <= 10.5 && local.y > 2.2;
    // Entry must be on the lower half. Landing on the lip cannot arm another jump.
    if (topo && valido && local.z > 0) estado.armado = true;
    if (!valido) { estado.armado = false; return false; }
    if (!estado.armado || estado.disparou || estado.cooldown > 0 || local.z > -7.3) return false;
    corpo.velocity.x += subida.x * modelo.impulsoRampa * fator;
    corpo.velocity.z += subida.z * modelo.impulsoRampa * fator;
    corpo.velocity.y = Math.max(corpo.velocity.y, modelo.saltoRampa * fator);
    estado.velocidadeLancamento = Math.hypot(corpo.velocity.x, corpo.velocity.z);
    estado.vooRestante = 3.2;
    estado.disparou = true; estado.cooldown = 1.1;
    return true;
  }
  return {
    atualizar,
    estaEmVoo: corpo => (estados.get(corpo)?.vooRestante || 0) > 0,
    resetar: corpo => estados.delete(corpo),
  };
}
