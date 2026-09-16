// Rapier owns integration and collision resolution. These reusable state vectors
// are the boundary with the existing gameplay (which edits individual axes).
export function criarFisica(RAPIER, THREE) {
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  const dinamicos = new Set();
  const porCollider = new Map();
  const contatos = [];
  const poolContatos = [];
  let anteriores = new Set();
  let atuais = new Set();
  let acumulador = 0;
  let proximoId = 1;

  function criarCorpo({ mass = 0, collider, position, material = "piso" } = {}) {
    const corpo = {
      id: proximoId++,
      mass,
      material,
      position: new THREE.Vector3().copy(position || { x: 0, y: 0, z: 0 }),
      quaternion: new THREE.Quaternion(),
      velocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      force: new THREE.Vector3(),
      torque: new THREE.Vector3(),
      angularFactor: new THREE.Vector3(1, 1, 1),
      linearDamping: 0.01,
      angularDamping: 0.01,
      allowSleep: false,
      rigidBody: null,
      colliders: [],
      descritores: collider ? [collider] : [],
      aoIniciarContato: null,
      adicionarCollider(descritor, offset) {
        if (this.rigidBody) throw new Error("Adicione os colliders antes do corpo.");
        if (offset) descritor.setTranslation(offset.x, offset.y, offset.z);
        this.descritores.push(descritor);
      },
      aplicarForcaCentral(forca) {
        this.force.add(forca);
      },
      wakeUp() {
        this.rigidBody?.wakeUp();
      },
    };
    return corpo;
  }

  function adicionarCorpo(corpo) {
    const desc = corpo.mass > 0
      ? RAPIER.RigidBodyDesc.dynamic()
      : RAPIER.RigidBodyDesc.fixed();
    desc.setTranslation(corpo.position.x, corpo.position.y, corpo.position.z)
      .setRotation(corpo.quaternion)
      .setCanSleep(corpo.allowSleep);
    const rb = world.createRigidBody(desc);
    corpo.rigidBody = rb;
    corpo.posicaoSincronizada = corpo.position.clone();
    corpo.rotacaoSincronizada = corpo.quaternion.clone();
    if (corpo.mass > 0) {
      rb.setEnabledRotations(
        Boolean(corpo.angularFactor.x),
        Boolean(corpo.angularFactor.y),
        Boolean(corpo.angularFactor.z),
        false,
      );
      dinamicos.add(corpo);
    }
    for (const descCollider of corpo.descritores) {
      // min(0, .08) = 0 on scenery; min(.08, .08) = .08 between cars.
      // .1 * .2 = .02 on scenery; .2 * .2 = .04 between cars.
      // Scenery is fixed, so scenery/scenery restitution has no solver effect.
      descCollider
        .setFriction(corpo.material === "carro" ? 0.08 : 0)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setRestitution(corpo.material === "carro" ? 0.2 : 0.1)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Multiply);
      if (corpo.mass > 0) descCollider.setMass(corpo.mass / corpo.descritores.length);
      const collider = world.createCollider(descCollider, rb);
      corpo.colliders.push(collider);
      porCollider.set(collider.handle, corpo);
    }
    rb.recomputeMassPropertiesFromColliders();
    corpo.descritores.length = 0;
    return corpo;
  }

  function removerCorpo(corpo) {
    if (!corpo.rigidBody) return;
    dinamicos.delete(corpo);
    for (const collider of corpo.colliders) porCollider.delete(collider.handle);
    world.removeRigidBody(corpo.rigidBody);
    corpo.rigidBody = null;
    corpo.colliders.length = 0;
    // Do not leave a removed phase obstacle in ground/ramp/capture queries.
    for (let i = contatos.length - 1; i >= 0; i--) {
      if (contatos[i].a === corpo || contatos[i].b === corpo) contatos.splice(i, 1);
    }
  }

  function enviarEstado(corpo, dt) {
    const rb = corpo.rigidBody;
    if (!corpo.position.equals(corpo.posicaoSincronizada)) rb.setTranslation(corpo.position, false);
    if (!corpo.quaternion.equals(corpo.rotacaoSincronizada)) rb.setRotation(corpo.quaternion, false);
    // The existing handling damps BEFORE integrating force and orientation.
    // Rapier's built-in damping has a different integration order: using it
    // directly changes the steering angle even with an equivalent coefficient.
    corpo.velocity.multiplyScalar(1 / (1 + dt * converterAmortecimento(corpo.linearDamping, dt)));
    corpo.angularVelocity.multiplyScalar(1 / (1 + dt * converterAmortecimento(corpo.angularDamping, dt)));
    rb.setLinvel(corpo.velocity, false);
    rb.setAngvel(corpo.angularVelocity, false);
    rb.setLinearDamping(0);
    rb.setAngularDamping(0);
    rb.resetForces(false);
    rb.resetTorques(false);
    rb.addForce(corpo.force, false);
    rb.addTorque(corpo.torque, false);
  }

  function lerEstado(corpo) {
    // 0.20 accepts reusable targets: no per-frame vector allocation here.
    const rb = corpo.rigidBody;
    rb.translation(corpo.position);
    rb.rotation(corpo.quaternion);
    rb.linvel(corpo.velocity);
    rb.angvel(corpo.angularVelocity);
    corpo.posicaoSincronizada.copy(corpo.position);
    corpo.rotacaoSincronizada.copy(corpo.quaternion);
    corpo.force.set(0, 0, 0);
    corpo.torque.set(0, 0, 0);
    // Rapier retains forces until reset; gameplay supplies them again.
    rb.resetForces(false);
    rb.resetTorques(false);
  }

  let corpoConsulta;
  let colliderConsulta;
  let outroConsulta;
  let chaveConsulta;
  function lerManifold(manifold, flipped) {
    // Narrow phase also contains separated/predicted pairs. They must not
    // count as ground, ramp, or police capture contacts.
    let tocando = false;
    for (let i = 0; i < manifold.numContacts(); i++) {
      if (manifold.contactDist(i) <= 0.001) { tocando = true; break; }
    }
    if (!tocando) return;
    const indice = contatos.length;
    const contato = poolContatos[indice] || (poolContatos[indice] = {
      a: null, b: null, normal: new THREE.Vector3(),
    });
    contato.a = corpoConsulta;
    contato.b = outroConsulta;
    manifold.normal(contato.normal);
    if (flipped) contato.normal.negate();
    contatos.push(contato);
    atuais.add(chaveConsulta);
  }
  function lerPar(outroCollider) {
    const outro = porCollider.get(outroCollider.handle);
    if (!outro || outro === corpoConsulta) return;
    if (outro.mass > 0 && outro.id < corpoConsulta.id) return;
    outroConsulta = outro;
    chaveConsulta = Math.min(corpoConsulta.id, outro.id) + ":" +
      Math.max(corpoConsulta.id, outro.id);
    world.contactPair(colliderConsulta, outroCollider, lerManifold);
  }
  function atualizarContatos() {
    contatos.length = 0;
    atuais.clear();
    for (const corpo of dinamicos) {
      corpoConsulta = corpo;
      for (const collider of corpo.colliders) {
        colliderConsulta = collider;
        world.contactPairsWith(collider, lerPar);
      }
    }
    // One begin event per body pair, not per collider/manifold.
    for (const contato of contatos) {
      const { a, b } = contato;
      const chave = Math.min(a.id, b.id) + ":" + Math.max(a.id, b.id);
      if (anteriores.has(chave)) continue;
      anteriores.add(chave);
      a.aoIniciarContato?.(b);
      b.aoIniciarContato?.(a);
    }
    const troca = anteriores;
    anteriores = atuais;
    atuais = troca;
  }

  function avancar(dt, delta, maxSubsteps) {
    acumulador += Math.max(0, delta);
    let passos = 0;
    while (acumulador + 1e-10 >= dt && passos < maxSubsteps) {
      for (const corpo of dinamicos) enviarEstado(corpo, dt);
      world.timestep = dt;
      world.step();
      for (const corpo of dinamicos) lerEstado(corpo);
      atualizarContatos();
      acumulador = Math.max(0, acumulador - dt);
      passos++;
    }
    // Retain the fractional remainder, discard a long suspension's backlog.
    if (passos === maxSubsteps && acumulador >= dt) acumulador %= dt;
    return passos;
  }

  function dispose() {
    contatos.length = 0;
    poolContatos.length = 0;
    porCollider.clear();
    dinamicos.clear();
    anteriores.clear();
    atuais.clear();
    world.free();
  }
  return { world, criarCorpo, adicionarCorpo, removerCorpo, contatos, avancar, dispose };
}

// Preserve per-second exponential decay under Rapier's 1 / (1 + dt*d) rule.
export function converterAmortecimento(fracao, dt) {
  return Math.expm1(-Math.log1p(-fracao) * dt) / dt;
}
