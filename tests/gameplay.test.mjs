import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { criarFisica } from "../jogos/meus-jogos/corrida/js/physics.mjs";
import {
  preverInterceptacao,
  criarConsultasJogabilidade,
  pressaoDeCaptura,
  criarControleRampas,
  obterPerfilInteligencia,
  calcularVelocidadePerseguicao,
  limitarAltitudeHelicoptero,
  planejarPerseguicao,
} from "../jogos/meus-jogos/corrida/js/gameplay.mjs";
await RAPIER.init();

test("helicóptero mantém altitude mínima para não tocar o chão", () => {
  assert.equal(limitarAltitudeHelicoptero(0), 28);
  assert.equal(limitarAltitudeHelicoptero(27.5), 28);
  assert.equal(limitarAltitudeHelicoptero(34), 34);
});

test("velocidade policial: cresce com o carro nas três fases finais do grupo", () => {
  const parametros = {
    velocidadeJogador: 50,
    totalFases: 12,
    fatorInicial: 0.88,
    fatorFinal: 1.08,
  };
  const antesDaEscalada = calcularVelocidadePerseguicao({ ...parametros, fase: 8 });
  const inicioEscalada = calcularVelocidadePerseguicao({ ...parametros, fase: 9 });
  const meioEscalada = calcularVelocidadePerseguicao({ ...parametros, fase: 10 });
  const faseFinal = calcularVelocidadePerseguicao({ ...parametros, fase: 11 });
  assert.equal(antesDaEscalada, 44);
  assert.equal(inicioEscalada, 44);
  assert.equal(meioEscalada, 49);
  assert.equal(faseFinal, 54);
  const escaladaComCarroRapido = calcularVelocidadePerseguicao({
    ...parametros,
    velocidadeJogador: 60,
    fase: 11,
  });
  assert.ok(Math.abs(escaladaComCarroRapido - 64.8) < 1e-9);
});

test("táticas: viatura segue, moto aproxima pela lateral, interceptor antecipa e flanqueador cerca", () => {
  const dados = { jogador: { x: 0, z: 0 }, velocidade: { x: 0, z: -20 }, frente: { x: 0, z: -1 }, policial: { x: 0, z: 40 } };
  const planos = Object.fromEntries(["perseguidora", "moto", "interceptadora", "flanqueadora"].map(estrategia =>
    [estrategia, planejarPerseguicao({ ...dados, estrategia })]));
  assert.equal(planos.perseguidora.alvo.x, 0);
  assert.ok(planos.moto.alvo.x > 2);
  assert.ok(planos.interceptadora.alvo.z < planos.perseguidora.alvo.z - 15);
  assert.ok(planos.flanqueadora.alvo.x < -8);
  assert.ok(planos.moto.respostaCurva > planos.perseguidora.respostaCurva);
  for (const estrategia of Object.keys(planos)) {
    const perto = planejarPerseguicao({ ...dados, estrategia, velocidade: { x: 0, z: 0 }, policial: { x: 0, z: 5 } });
    assert.ok(perto.modoCapturaDireta);
    assert.ok(Math.hypot(perto.alvo.x, perto.alvo.z) < 2, "jogador parado não deve ser orbitado fora do cerco");
    const reverso = planejarPerseguicao({ ...dados, estrategia, velocidade: { x: 0, z: 20 } });
    assert.ok(reverso.alvo.z > 0, "adapta a abordagem quando o jogador muda de direção");
  }
});

test("IA: fácil, média e difícil usam inteligência e adaptação progressivas", () => {
  assert.equal(obterPerfilInteligencia("facil").nome, "facil");
  assert.equal(obterPerfilInteligencia("media").nome, "media");
  assert.equal(obterPerfilInteligencia("dificil").nome, "dificil");

  const dados = {
    estrategia: "interceptadora",
    jogador: { x: 0, z: 0 },
    velocidade: { x: 0, z: -28 },
    frente: { x: 0, z: -1 },
    policial: { x: 0, z: 42 },
  };
  const facil = planejarPerseguicao({ ...dados, dificuldade: "facil" });
  const media = planejarPerseguicao({ ...dados, dificuldade: "media" });
  const dificil = planejarPerseguicao({ ...dados, dificuldade: "dificil" });
  assert.equal(facil.inteligencia, "inteligente");
  assert.equal(media.inteligencia, "inteligente");
  assert.equal(dificil.inteligencia, "inteligente");
  assert.equal(facil.nivelDificuldade, "facil");
  assert.equal(media.nivelDificuldade, "media");
  assert.equal(dificil.nivelDificuldade, "dificil");
  assert.ok(facil.alvo.z > media.alvo.z && media.alvo.z > dificil.alvo.z,
    "níveis maiores devem antecipar progressivamente a rota");
  assert.ok(facil.respostaCurva < media.respostaCurva);
  assert.ok(media.respostaCurva < dificil.respostaCurva);
  assert.equal(facil.influenciaObjetivo, 0);
  assert.ok(dificil.influenciaObjetivo > media.influenciaObjetivo);
  assert.ok(facil.intervaloReacao > media.intervaloReacao);
  assert.ok(media.intervaloReacao > dificil.intervaloReacao);

  const alvoParado = { ...dados, velocidade: { x: 0, z: 0 }, policial: { x: 0, z: 13 } };
  assert.equal(planejarPerseguicao({ ...alvoParado, dificuldade: "facil" }).modoCerco, false);
  assert.equal(planejarPerseguicao({ ...alvoParado, dificuldade: "dificil" }).modoCerco, true);
});

test("IA individual: cada unidade conserva uma tática distinta em uma mesma dificuldade", () => {
  const dados = {
    dificuldade: "dificil",
    jogador: { x: 0, z: 0 },
    velocidade: { x: 14, z: -22 },
    frente: { x: 0, z: -1 },
    policial: { x: 0, z: 40 },
  };
  const planos = ["perseguidora", "moto", "interceptadora", "flanqueadora"]
    .map(estrategia => planejarPerseguicao({ ...dados, estrategia }));
  assert.deepEqual(
    planos.map(plano => plano.tatica),
    ["pressao", "aproximacao-lateral", "interceptacao", "flanco"],
  );
  assert.deepEqual(
    planos.map(plano => plano.inteligencia),
    ["basica", "media", "inteligente", "inteligente"],
  );
  assert.ok(planos[0].intervaloReacao > planos[1].intervaloReacao);
  assert.ok(planos[1].intervaloReacao > planos[2].intervaloReacao);
  assert.equal(new Set(planos.map(plano => `${plano.alvo.x.toFixed(2)}|${plano.alvo.z.toFixed(2)}`)).size, 4);

  const ida = planejarPerseguicao({ ...dados, estrategia: "interceptadora" });
  const volta = planejarPerseguicao({
    ...dados,
    estrategia: "interceptadora",
    velocidade: { x: -14, z: 22 },
  });
  assert.ok(ida.alvo.z < 0 && volta.alvo.z > 0,
    "a inteligência deve adaptar a interceptação quando o jogador inverte a rota");
});

function cenario(t) {
  const fisica = criarFisica(RAPIER, THREE), coberturas = new Set();
  t.after(() => fisica.dispose());
  const carro = fisica.criarCorpo({ mass: 800, material: "carro", collider: RAPIER.ColliderDesc.cuboid(1.2, 0.6, 2.2), position: new THREE.Vector3(0, 0.6, 0) });
  carro.angularFactor.set(0, 1, 0); fisica.adicionarCorpo(carro);
  const consultas = criarConsultasJogabilidade(RAPIER, THREE, coberturas);
  function caixa(x, y, z, hx = 0.3, hy = 3, hz = 3) {
    const corpo = fisica.criarCorpo({ collider: RAPIER.ColliderDesc.cuboid(hx, hy, hz), position: new THREE.Vector3(x, y, z) });
    fisica.adicionarCorpo(corpo); coberturas.add(corpo); return corpo;
  }
  return { fisica, carro, coberturas, consultas, caixa };
}

test("mira: jogador parado e interceptação de movimento real", () => {
  const origem = new THREE.Vector3(220, 29, 0), alvo = new THREE.Vector3(0, 1.6, 0), previsto = new THREE.Vector3();
  preverInterceptacao(origem, alvo, new THREE.Vector3(), 96, previsto);
  assert.ok(previsto.distanceTo(alvo) < 1e-10);
  for (const v of [new THREE.Vector3(0, 0, 42), new THREE.Vector3(78, 0, 0), new THREE.Vector3(20, 8, 35)]) {
    preverInterceptacao(origem, alvo, v, 96, previsto);
    const tempo = origem.distanceTo(previsto) / 96;
    assert.ok(previsto.distanceTo(alvo.clone().addScaledVector(v, tempo)) < 1e-8);
  }
  preverInterceptacao(origem, alvo, new THREE.Vector3(-78, 0, 0), 96, previsto);
  assert.ok(Math.abs(previsto.x + 78 * 5.4) < 1e-8, "Previsão limitada à vida do projétil quando não há interceptação a tempo");
});

test("tiros: detectam cruzamento completo e movimento do jogador entre quadros", t => {
  const { carro, consultas } = cenario(t);
  const hit = consultas.primeiroImpacto(new THREE.Vector3(-12, 1.6, 0), new THREE.Vector3(24, 0, 0), carro, carro.position);
  assert.equal(hit?.tipo, "jogador"); assert.ok(hit.tempo > 0 && hit.tempo < 1);
  carro.position.x = 6;
  const cruzamento = consultas.primeiroImpacto(new THREE.Vector3(0, 1.6, -8), new THREE.Vector3(0, 0, 16), carro, new THREE.Vector3(-6, 0.6, 0));
  assert.equal(cruzamento?.tipo, "jogador");
  carro.position.x = 0;
  assert.equal(consultas.primeiroImpacto(new THREE.Vector3(-12, 1.6, 4.4), new THREE.Vector3(24, 0, 0), carro, carro.position), null);
});

test("tiros: cobertura mais próxima vence; obstáculo atrás não apaga acerto", t => {
  const { carro, consultas, caixa, coberturas, fisica } = cenario(t);
  const bloqueio = caixa(-5, 2, 0);
  const origem = new THREE.Vector3(-12, 1.6, 0), movimento = new THREE.Vector3(24, 0, 0);
  assert.equal(consultas.primeiroImpacto(origem, movimento, carro, carro.position)?.tipo, "cenario");
  bloqueio.rigidBody.setEnabled(false);
  assert.equal(consultas.primeiroImpacto(origem, movimento, carro, carro.position)?.tipo, "jogador");
  coberturas.delete(bloqueio); fisica.removerCorpo(bloqueio);
  caixa(5, 2, 0);
  assert.equal(consultas.primeiroImpacto(origem, movimento, carro, carro.position)?.tipo, "jogador");
});

test("captura: mede carroceria e obstáculos, ignora longe/voo e mantém pressão próxima", t => {
  const { carro, consultas, caixa } = cenario(t);
  const outro = { position: new THREE.Vector3(3.4, 0.6, 0), quaternion: new THREE.Quaternion(), colliders: carro.colliders };
  const distancia = consultas.distanciaCarrocerias(carro, outro);
  assert.ok(Math.abs(distancia - 1) < 1e-5);
  const situacao = { distancia, desnivel: 0, velocidadeRelativa: 0, contato: false, livre: true, noChao: true };
  assert.ok(pressaoDeCaptura(situacao) > 0);
  assert.equal(pressaoDeCaptura({ ...situacao, distancia: 7.6 }), 0);
  assert.equal(pressaoDeCaptura({ ...situacao, noChao: false }), 0);
  assert.equal(pressaoDeCaptura({ ...situacao, desnivel: 2 }), 0);
  assert.ok(consultas.caminhoLivre(carro.position, outro.position));
  caixa(1.7, 1, 0, 0.2, 1, 1);
  const livre = consultas.caminhoLivre(carro.position, outro.position);
  assert.equal(livre, false);
  assert.equal(pressaoDeCaptura({ ...situacao, livre }), 0);
});

function rampaReal(t) {
  const c = cenario(t);
  const piso = c.fisica.criarCorpo({ collider: new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 })) });
  c.fisica.adicionarCorpo(piso);
  const rampa = c.fisica.criarCorpo({ collider: RAPIER.ColliderDesc.cuboid(6.6, 2.2, 9.2), position: new THREE.Vector3(0, 1.15, 0) });
  rampa.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 8);
  c.fisica.adicionarCorpo(rampa);
  return { ...c, rampa, controle: criarControleRampas(THREE, new WeakSet([rampa])) };
}
const modelo = { impulsoRampa: 38, saltoRampa: 17.5 };

for (const dt of [1 / 50, 1 / 60, 1 / 90]) test(`rampa física: subir e saltar uma vez na saída (${1 / dt} Hz)`, t => {
  const { carro, fisica, controle } = rampaReal(t);
  carro.position.set(0, 0.6, 20); carro.velocity.set(0, 0, -24);
  let saltos = 0, altura = 0, posicaoSalto, velocidadeSalto = 0;
  let menorVelocidadeNoVoo = Infinity, maiorAlcance = 0;
  for (let i = 0; i < Math.round(3 / dt); i++) {
    if (!saltos) carro.aplicarForcaCentral(new THREE.Vector3(0, 0, -24000));
    fisica.avancar(dt, dt, 1);
    if (controle.atualizar(carro, fisica.contatos, dt, modelo)) {
      saltos++;
      posicaoSalto = carro.position.clone();
      velocidadeSalto = Math.hypot(carro.velocity.x, carro.velocity.z);
    } else if (saltos && controle.estaEmVoo(carro)) {
      menorVelocidadeNoVoo = Math.min(
        menorVelocidadeNoVoo,
        Math.hypot(carro.velocity.x, carro.velocity.z),
      );
      maiorAlcance = Math.max(maiorAlcance, Math.abs(carro.position.z - posicaoSalto.z));
    }
    altura = Math.max(altura, carro.position.y);
  }
  assert.equal(saltos, 1, JSON.stringify({ saltos, altura, posicao: carro.position }));
  assert.ok(posicaoSalto.z < -5 && posicaoSalto.y > 5);
  assert.ok(altura > 9);
  assert.ok(velocidadeSalto > 45, `impulso horizontal insuficiente: ${velocidadeSalto}`);
  assert.ok(menorVelocidadeNoVoo >= velocidadeSalto * 0.92,
    JSON.stringify({ velocidadeSalto, menorVelocidadeNoVoo }));
  assert.ok(maiorAlcance > 65, `alcance aéreo insuficiente: ${maiorAlcance}`);
});

test("rampa: impacto aéreo reduz a referência e não reimpulsiona o carro", t => {
  const { carro, fisica, controle } = rampaReal(t);
  carro.position.set(0, 0.6, 20);
  carro.velocity.set(0, 0, -24);
  let lancou = false;
  for (let i = 0; i < 180 && !lancou; i++) {
    carro.aplicarForcaCentral(new THREE.Vector3(0, 0, -24000));
    fisica.avancar(1 / 60, 1 / 60, 1);
    lancou = controle.atualizar(carro, fisica.contatos, 1 / 60, modelo);
  }
  assert.equal(lancou, true);
  carro.velocity.x *= 0.45;
  carro.velocity.z *= 0.45;
  const aposImpacto = Math.hypot(carro.velocity.x, carro.velocity.z);
  controle.atualizar(carro, [], 1 / 60, modelo);
  assert.ok(Math.abs(Math.hypot(carro.velocity.x, carro.velocity.z) - aposImpacto) < 1e-8);
});

for (const caso of ["lateral", "parado no topo", "sentido contrário"]) test(`rampa: ${caso} não dispara impulso`, t => {
  const { carro, fisica, controle } = rampaReal(t);
  if (caso === "lateral") { carro.position.set(-12, 0.6, 0); carro.velocity.x = 24; carro.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); }
  if (caso === "parado no topo") carro.position.set(0, 9, -7);
  if (caso === "sentido contrário") { carro.position.set(0, 0.6, -15); carro.velocity.z = 24; carro.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI); }
  let saltos = 0;
  for (let i = 0; i < 180; i++) {
    fisica.avancar(1 / 60, 1 / 60, 1);
    saltos += Number(controle.atualizar(carro, fisica.contatos, 1 / 60, modelo));
  }
  assert.equal(saltos, 0);
});
