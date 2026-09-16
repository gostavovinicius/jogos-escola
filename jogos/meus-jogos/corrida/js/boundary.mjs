// Four vertical half-spaces: no top, seams, slopes or hidden mountain surfaces.
// The playable square keeps the former walls' inner face at +/-187.
export function criarLimiteMapa(RAPIER, THREE, fisica, tamanhoMapa) {
  const limite = tamanhoMapa / 2 - 13;
  const folga = 0.025;
  const paredes = [];
  for (const eixo of ["x", "z"]) {
    for (const sinal of [-1, 1]) {
      const normal = new THREE.Vector3();
      const position = new THREE.Vector3();
      normal[eixo] = -sinal;
      position[eixo] = sinal * limite;
      const parede = fisica.criarCorpo({
        collider: new RAPIER.ColliderDesc(new RAPIER.HalfSpace(normal)),
        position,
      });
      fisica.adicionarCorpo(parede);
      // No friction or bounce that could hold a jumping vehicle against a wall.
      parede.colliders[0].setFriction(0);
      parede.colliders[0].setRestitution(0);
      paredes.push(parede);
    }
  }

  function conter(corpo) {
    // All game vehicles use one centered cuboid, including the police bike.
    const h = corpo.colliders[0]?.shape.halfExtents;
    if (!h) return;
    const { x, y, z, w } = corpo.quaternion;
    // Project the rotated physical box, not just its center, onto each wall.
    const alcanceX = Math.abs(1 - 2 * (y * y + z * z)) * h.x
      + Math.abs(2 * (x * y - z * w)) * h.y
      + Math.abs(2 * (x * z + y * w)) * h.z;
    const alcanceZ = Math.abs(2 * (x * z - y * w)) * h.x
      + Math.abs(2 * (y * z + x * w)) * h.y
      + Math.abs(1 - 2 * (x * x + y * y)) * h.z;
    conterEixo(corpo, "x", limite - alcanceX - folga);
    conterEixo(corpo, "z", limite - alcanceZ - folga);
    // Intentionally preserve height, vertical speed and inward/tangent motion.
  }

  function conterEixo(corpo, eixo, maximo) {
    const sinal = Math.sign(corpo.position[eixo]);
    if (Math.abs(corpo.position[eixo]) <= maximo) return;
    corpo.position[eixo] = sinal * maximo;
    if (corpo.velocity[eixo] * sinal > 0) corpo.velocity[eixo] = 0;
  }

  return { limite, paredes, conter };
}

// Keep the entire mountain base outside the square, including diagonal corners.
export function distanciaSeguraMontanha(angulo, raioVisual, limite, distanciaOriginal) {
  const direcaoMaior = Math.max(Math.abs(Math.cos(angulo)), Math.abs(Math.sin(angulo)));
  return Math.max(distanciaOriginal, (limite + raioVisual + 8) / direcaoMaior);
}
