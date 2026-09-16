import test from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { criarFisica, converterAmortecimento } from "../jogos/meus-jogos/corrida/js/physics.mjs";
await RAPIER.init();

function cenario(t) {
  const fisica = criarFisica(RAPIER, THREE);
  t.after(() => fisica.dispose());
  const piso = fisica.criarCorpo({
    collider: new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 })),
  });
  fisica.adicionarCorpo(piso);
  const carro = fisica.criarCorpo({
    mass: 800, material: "carro",
    collider: RAPIER.ColliderDesc.cuboid(1.2, 0.6, 2.2),
    position: new THREE.Vector3(0, 4, 0),
  });
  carro.angularFactor.set(0, 1, 0);
  carro.linearDamping = 0.02;
  carro.angularDamping = 0.9;
  fisica.adicionarCorpo(carro);
  return { fisica, carro, piso };
}
test("massa, gravidade, repouso e contatos reais do chão", t => {
  const { fisica, carro, piso } = cenario(t);
  assert.equal(carro.rigidBody.mass(), 800);
  fisica.avancar(1 / 90, 1 / 90, 10);
  assert.ok(Math.abs(carro.velocity.y + 20 / 90) < 0.005);
  for (let i = 0; i < 300; i++) fisica.avancar(1 / 90, 1 / 90, 10);
  assert.ok(Math.abs(carro.position.y - 0.6) < 0.025, String(carro.position.y));
  assert.ok(fisica.contatos.some(c => c.b === piso && Math.abs(c.normal.y) > 0.99));
  assert.ok(Math.abs(carro.velocity.y) < 0.01);
});
test("força central, reset de forças e amortecimento independente do passo", t => {
  const { fisica, carro } = cenario(t);
  carro.aplicarForcaCentral(new THREE.Vector3(52000, 0, 0));
  fisica.avancar(1 / 90, 1 / 90, 10);
  const v = carro.velocity.x;
  assert.ok(Math.abs(v - 52000 / 800 / 90) < 0.001);
  fisica.avancar(1 / 90, 1 / 90, 10);
  assert.ok(carro.velocity.x <= v);
  for (const dt of [1 / 50, 1 / 60, 1 / 90, 1 / 120]) {
    const damping = converterAmortecimento(0.9, dt);
    assert.ok(Math.abs(Math.pow(1 / (1 + dt * damping), 1 / dt) - 0.1) < 1e-12);
  }
});
test("acumulador preserva força até o primeiro passo e limita atraso", t => {
  const { fisica, carro } = cenario(t);
  carro.aplicarForcaCentral(new THREE.Vector3(52000, 0, 0));
  assert.equal(fisica.avancar(1 / 60, 1 / 120, 3), 0);
  assert.equal(carro.force.x, 52000);
  assert.equal(fisica.avancar(1 / 60, 1 / 120, 3), 1);
  assert.equal(carro.force.x, 0);
  assert.equal(fisica.avancar(1 / 60, 2, 3), 3);
  assert.equal(fisica.avancar(1 / 60, 0, 3), 0);
});
test("contato começa uma vez, termina no salto e volta na aterrissagem", t => {
  const { fisica, carro } = cenario(t);
  let eventos = 0;
  carro.aoIniciarContato = () => eventos++;
  for (let i = 0; i < 300; i++) fisica.avancar(1 / 90, 1 / 90, 10);
  assert.equal(eventos, 1);
  carro.velocity.y = 13.65;
  for (let i = 0; i < 30; i++) fisica.avancar(1 / 90, 1 / 90, 10);
  assert.ok(carro.position.y > 3);
  assert.equal(fisica.contatos.length, 0);
  for (let i = 0; i < 200; i++) fisica.avancar(1 / 90, 1 / 90, 10);
  // Restitution can produce a small second landing. Resting must not spam events.
  assert.ok(eventos >= 2 && eventos <= 3);
  const eventosAoRepousar = eventos;
  for (let i = 0; i < 120; i++) fisica.avancar(1 / 90, 1 / 90, 10);
  assert.equal(eventos, eventosAoRepousar);
});
test("materiais mantêm atrito e restituição carro/chão", t => {
  const { fisica, carro, piso } = cenario(t);
  for (let i = 0; i < 160; i++) fisica.avancar(1 / 90, 1 / 90, 10);
  let encontrado = false;
  fisica.world.contactPair(carro.colliders[0], piso.colliders[0], m => {
    encontrado = true;
    assert.ok(Math.abs(m.friction()) < 1e-6);
    assert.ok(Math.abs(m.restitution() - 0.02) < 1e-6);
  });
  assert.ok(encontrado);
});
test("rampa composta preserva deslocamentos, rotação e remoção", t => {
  const { fisica } = cenario(t);
  const rampa = fisica.criarCorpo({ position: new THREE.Vector3(12, 1, 7) });
  rampa.adicionarCollider(RAPIER.ColliderDesc.cuboid(7.2, 2.8, 10.2));
  rampa.adicionarCollider(RAPIER.ColliderDesc.cuboid(6.1, 1.5, 8.8), new THREE.Vector3(0, -1.75, 0.2));
  rampa.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 8);
  fisica.adicionarCorpo(rampa);
  assert.equal(rampa.colliders.length, 2);
  assert.ok(rampa.colliders[1].translation().y < rampa.position.y);
  const handle = rampa.rigidBody.handle;
  fisica.removerCorpo(rampa);
  assert.equal(fisica.world.getRigidBody(handle), null);
});

test("colisão entre veículos conserva materiais e transmite movimento", t => {
  const { fisica, carro } = cenario(t);
  carro.position.set(-4, 0.6, 0);
  const outro = fisica.criarCorpo({
    mass: 900, material: "carro",
    collider: RAPIER.ColliderDesc.cuboid(1.2, 0.6, 2.2),
    position: new THREE.Vector3(0, 0.6, 0),
  });
  outro.angularFactor.set(0, 1, 0);
  fisica.adicionarCorpo(outro);
  carro.velocity.x = 10;
  let encontrou = false;
  for (let i = 0; i < 50; i++) {
    fisica.avancar(1 / 90, 1 / 90, 10);
    fisica.world.contactPair(carro.colliders[0], outro.colliders[0], m => {
      if (!m.numContacts()) return;
      encontrou = true;
      assert.ok(Math.abs(m.friction() - 0.08) < 1e-6);
      assert.ok(Math.abs(m.restitution() - 0.04) < 1e-6);
    });
  }
  assert.ok(encontrou);
  assert.ok(outro.velocity.x > 1);
  assert.ok(carro.position.x < outro.position.x);
});

test("contato com rampa inclinada é reportado pelo Rapier", t => {
  const { fisica, carro } = cenario(t);
  const rampa = fisica.criarCorpo();
  rampa.adicionarCollider(RAPIER.ColliderDesc.cuboid(7.2, 2.8, 10.2));
  rampa.adicionarCollider(RAPIER.ColliderDesc.cuboid(6.1, 1.5, 8.8), new THREE.Vector3(0, -1.75, 0.2));
  rampa.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 8);
  fisica.adicionarCorpo(rampa);
  carro.position.y = 10;
  let contatoRampa = false;
  for (let i = 0; i < 120; i++) {
    fisica.avancar(1 / 90, 1 / 90, 10);
    if (fisica.contatos.some(c => c.b === rampa && Math.abs(c.normal.y) > 0.15)) {
      contatoRampa = true; break;
    }
  }
  assert.ok(contatoRampa);
  assert.ok(carro.position.y > 2.8);
});
