import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { criarFisica } from "../jogos/meus-jogos/corrida/js/physics.mjs";
import { criarLimiteMapa, distanciaSeguraMontanha } from "../jogos/meus-jogos/corrida/js/boundary.mjs";
await RAPIER.init();

function cenario(t, moto = false) {
  const fisica = criarFisica(RAPIER, THREE);
  t.after(() => fisica.dispose());
  fisica.adicionarCorpo(fisica.criarCorpo({
    collider: new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 })),
  }));
  const limite = criarLimiteMapa(RAPIER, THREE, fisica, 400);
  const h = moto ? new THREE.Vector3(0.7, 0.8, 1.9) : new THREE.Vector3(1.2, 0.6, 2.2);
  const carro = fisica.criarCorpo({
    mass: moto ? 540 : 800, material: "carro",
    collider: RAPIER.ColliderDesc.cuboid(h.x, h.y, h.z),
    position: new THREE.Vector3(0, h.y, 0),
  });
  carro.angularFactor.set(0, 1, 0);
  fisica.adicionarCorpo(carro);
  return { fisica, limite, carro, h };
}

function verificarDentro(carro, h, limite, tolerancia = 1e-7) {
  for (const x of [-h.x, h.x]) for (const y of [-h.y, h.y]) for (const z of [-h.z, h.z]) {
    const vertice = new THREE.Vector3(x, y, z).applyQuaternion(carro.quaternion).add(carro.position);
    assert.ok(Math.abs(vertice.x) <= limite + tolerancia, `x=${vertice.x}`);
    assert.ok(Math.abs(vertice.z) <= limite + tolerancia, `z=${vertice.z}`);
  }
}

for (const moto of [false, true]) for (const dt of [1 / 50, 1 / 60, 1 / 90]) {
  test(`barreira física: quatro lados/cantos, sem subir ou prender (${moto ? "moto" : "carro"}, ${1 / dt} Hz)`, t => {
    const { fisica, limite, carro, h } = cenario(t, moto);
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      carro.position.set(nx * 175, h.y, nz * 175);
      carro.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-nx, -nz));
      carro.velocity.set(nx * 120, 0, nz * 120);
      carro.angularVelocity.set(0, 0, 0);
      for (let i = 0; i < 130; i++) {
        carro.aplicarForcaCentral(new THREE.Vector3(nx * 92000, 0, nz * 92000));
        limite.conter(carro);
        fisica.avancar(dt, dt, 1);
        // The guard resolves any within-step penetration before rendering.
        limite.conter(carro);
        verificarDentro(carro, h, limite.limite);
        assert.ok(Math.abs(carro.position.y - h.y) < 0.035, `altura=${carro.position.y}`);
        for (const c of fisica.contatos) if (limite.paredes.includes(c.b)) {
          assert.ok(Math.abs(c.normal.y) < 1e-6);
        }
      }
      // Reversing is never suppressed by the boundary.
      carro.velocity.set(-nx * 12, 0, -nz * 12);
      const antes = carro.position.clone();
      for (let i = 0; i < 30; i++) { fisica.avancar(dt, dt, 1); limite.conter(carro); }
      assert.ok(antes.distanceTo(carro.position) > 2);
    }
  });
}

test("proteção considera a caixa girada, preserva movimento tangente/retorno e nunca altera altura", t => {
  const { limite, carro, h } = cenario(t);
  for (let i = 0; i < 32; i++) {
    carro.quaternion.setFromEuler(new THREE.Euler(i * 0.1, i * 0.23, i * 0.03));
    carro.position.set(i % 2 ? -205 : 205, 12, 0);
    const retorno = i % 2 ? 17 : -17;
    carro.velocity.set(retorno, -9, 14);
    limite.conter(carro);
    verificarDentro(carro, h, limite.limite);
    assert.equal(carro.position.y, 12);
    assert.equal(carro.velocity.x, retorno);
    assert.equal(carro.velocity.y, -9);
    assert.equal(carro.velocity.z, 14);
  }
  carro.position.set(500, 12, -500); carro.velocity.set(800, 9, -800);
  limite.conter(carro);
  verificarDentro(carro, h, limite.limite);
  assert.equal(carro.velocity.x, 0); assert.equal(carro.velocity.z, 0);
  assert.equal(carro.velocity.y, 9);
});

test("parede acima do antigo topo não sustenta o carro no ar e permite deslizar", t => {
  const { fisica, limite, carro, h } = cenario(t);
  carro.position.set(182, 100, -40); carro.velocity.set(80, 0, 12);
  for (let i = 0; i < 120; i++) {
    carro.aplicarForcaCentral(new THREE.Vector3(52000, 0, 0));
    limite.conter(carro);
    fisica.avancar(1 / 60, 1 / 60, 1); limite.conter(carro);
    verificarDentro(carro, h, limite.limite);
  }
  assert.ok(carro.position.y < 63 && carro.position.y > 57);
  assert.ok(carro.velocity.y < -39);
  assert.ok(carro.position.z > -18);
  for (let i = 0; i < 150; i++) {
    fisica.avancar(1 / 60, 1 / 60, 1); limite.conter(carro);
  }
  assert.ok(Math.abs(carro.position.y - h.y) < 0.035);
});

test("bases das montanhas ficam fora da área jogável em todos os ângulos", () => {
  for (let i = 0; i < 360; i++) {
    const angulo = i * Math.PI / 180;
    for (const raio of [34 * 1.35, 52 * 1.35]) {
      const distancia = distanciaSeguraMontanha(angulo, raio, 187, 246);
      const maiorEixo = Math.max(Math.abs(Math.cos(angulo)), Math.abs(Math.sin(angulo))) * distancia;
      assert.ok(maiorEixo - raio >= 195 - 1e-9);
    }
  }
});

test("as paredes também colidem no Rapier, independentemente da proteção de posição", t => {
  const { fisica, limite, carro, h } = cenario(t);
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    carro.position.set(nx * 175, h.y, nz * 175);
    carro.quaternion.identity(); carro.angularVelocity.set(0, 0, 0);
    carro.velocity.set(nx * 15, 0, nz * 15);
    let contatoParede = false;
    for (let i = 0; i < 180; i++) {
      carro.aplicarForcaCentral(new THREE.Vector3(nx * 20000, 0, nz * 20000));
      fisica.avancar(1 / 60, 1 / 60, 1);
      for (const c of fisica.contatos) if (limite.paredes.includes(c.b)) {
        contatoParede = true;
        assert.ok(Math.abs(c.normal.y) < 1e-6);
      }
    }
    assert.ok(contatoParede);
    verificarDentro(carro, h, limite.limite, 0.025);
    assert.ok(Math.abs(carro.position.y - h.y) < 0.035);
  }
});
