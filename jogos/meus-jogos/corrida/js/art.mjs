// Procedural art only. No physics, scoring, input, or gameplay randomness here.
export function criarArteCorrida(THREE, renderer, cena, perfil) {
  const simples = perfil.pcFraco || perfil.firefoxEconomia || !window.graphicsCapabilities.supportsWebGL2;
  const segmentos = simples ? 12 : 20;
  let seed = 9137;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
  const cor = value => new THREE.Color(value).convertSRGBToLinear();
  const texturas = new Set();
  function textura(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(simples ? 2 : 8, renderer.capabilities.getMaxAnisotropy());
    texturas.add(t);
    return t;
  }
  function canvas(w, h = w) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
  }
  let reflexos = null;
  if (!simples) {
    // Small painted studio/sky cubemap: reflections work even on WebGL 1.
    const faces = Array.from({ length: 6 }, (_, i) => {
      const c = canvas(128), ctx = c.getContext("2d");
      const g = ctx.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, "#668db6"); g.addColorStop(0.48, "#e0f1f5");
      g.addColorStop(0.53, "#c6d4bc"); g.addColorStop(1, "#445c42");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = i === 2 ? "#f7faf5" : "rgba(255,255,255,.48)";
      ctx.fillRect(14, 12, 18, 42); ctx.fillRect(66, 18, 46, 14);
      return c;
    });
    reflexos = new THREE.CubeTexture(faces);
    reflexos.colorSpace = THREE.SRGBColorSpace; reflexos.needsUpdate = true;
    texturas.add(reflexos);
  }
  function material(color, brilho = 0) {
    if (simples) return new THREE.MeshLambertMaterial({ color: cor(color) });
    return new THREE.MeshPhongMaterial({
      color: cor(color), shininess: brilho ? 95 : 12,
      specular: cor(brilho ? 0xaac4dd : 0x28313a),
      envMap: brilho ? reflexos : null, reflectivity: brilho ? 0.2 : 0,
    });
  }
  function basico(color) { return new THREE.MeshBasicMaterial({ color: cor(color) }); }
  function paleta(pintura = 0xe24c44, detalhe = 0xf4c95b) {
    return {
      tinta: material(pintura, 1), vidro: material(0x234c66, 1),
      borracha: material(0x19232c), metal: material(0xb8c9d2, 1),
      escuro: material(0x243341), detalhe: material(detalhe, 1),
      branco: material(0xe9eef1, 1), farol: basico(0xe3f7ff),
      lanterna: new THREE.MeshBasicMaterial({ color: 0xe82730 }),
    };
  }
  function mesh(grupo, geo, mat, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; grupo.add(m); return m;
  }
  function caixa(grupo, mat, w, h, d, x = 0, y = 0, z = 0, arredondar = 0) {
    let geo;
    if (arredondar) {
      const r = Math.min(arredondar, w / 4, h / 4, d / 4);
      const sx = w / 2 - r, sy = h / 2 - r, canto = Math.min(r, sx / 2, sy / 2);
      const shape = new THREE.Shape();
      shape.moveTo(-sx + canto, -sy); shape.lineTo(sx - canto, -sy);
      shape.quadraticCurveTo(sx, -sy, sx, -sy + canto); shape.lineTo(sx, sy - canto);
      shape.quadraticCurveTo(sx, sy, sx - canto, sy); shape.lineTo(-sx + canto, sy);
      shape.quadraticCurveTo(-sx, sy, -sx, sy - canto); shape.lineTo(-sx, -sy + canto);
      shape.quadraticCurveTo(-sx, -sy, -sx + canto, -sy); shape.closePath();
      geo = new THREE.ExtrudeGeometry(shape, {
        depth: d - r * 2, bevelEnabled: true, bevelSize: r, bevelThickness: r,
        bevelSegments: simples ? 1 : 3, steps: 1, curveSegments: simples ? 2 : 4,
      });
      geo.translate(0, 0, -d / 2 + r);
    } else geo = new THREE.BoxGeometry(w, h, d);
    return mesh(grupo, geo, mat, x, y, z);
  }
  function esfera(grupo, mat, x, y, z, sx, sy = sx, sz = sx) {
    const m = mesh(grupo, new THREE.SphereGeometry(1, segmentos, simples ? 8 : 12), mat, x, y, z);
    m.scale.set(sx, sy, sz); return m;
  }
  function haste(grupo, mat, a, b, raio = 0.05) {
    const pa = new THREE.Vector3(...a), pb = new THREE.Vector3(...b);
    const m = mesh(grupo, new THREE.CylinderGeometry(raio, raio, pa.distanceTo(pb), 8), mat);
    m.position.copy(pa).add(pb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pb.sub(pa).normalize());
    return m;
  }
  // Bake rigid decorative parts by material, keeping wheels/rotors separate.
  function compactar(grupo) {
    const lotes = new Map();
    grupo.updateMatrixWorld(true);
    for (const child of [...grupo.children]) {
      if (!child.isMesh || Array.isArray(child.material)) continue;
      const geo = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
      child.updateMatrix(); geo.applyMatrix4(child.matrix);
      if (!lotes.has(child.material)) lotes.set(child.material, []);
      lotes.get(child.material).push(geo);
      child.geometry.dispose(); grupo.remove(child);
    }
    for (const [mat, geos] of lotes) {
      const geo = new THREE.BufferGeometry();
      for (const nome of ["position", "normal", "uv"]) {
        if (!geos.every(g => g.getAttribute(nome))) continue;
        const arrays = geos.map(g => g.getAttribute(nome).array);
        const data = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
        let offset = 0;
        for (const a of arrays) { data.set(a, offset); offset += a.length; }
        geo.setAttribute(nome, new THREE.BufferAttribute(data, nome === "uv" ? 2 : 3));
      }
      for (const g of geos) g.dispose();
      geo.computeBoundingSphere(); mesh(grupo, geo, mat);
    }
  }
  function etiqueta(texto, fundo = "#18364b", tinta = "#ffffff") {
    const c = canvas(256, 64), ctx = c.getContext("2d");
    ctx.fillStyle = fundo; ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = tinta; ctx.lineWidth = 3; ctx.strokeRect(5, 5, 246, 54);
    ctx.font = "bold 34px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = tinta; ctx.fillText(texto, 128, 34);
    return new THREE.MeshBasicMaterial({ map: textura(c), side: THREE.DoubleSide });
  }
  function placa(grupo, mat, w, h, x, y, z, ry = 0) {
    const m = mesh(grupo, new THREE.PlaneGeometry(w, h), mat, x, y, z);
    m.rotation.y = ry; m.castShadow = false; return m;
  }
  function roda(grupo, p, x, y, z, raio = 0.54, largura = 0.32, frente = false) {
    const direcao = new THREE.Group(), giro = new THREE.Group();
    direcao.position.set(x, y, z); direcao.add(giro); grupo.add(direcao);
    const pneu = mesh(giro, new THREE.CylinderGeometry(raio, raio, largura, segmentos), p.borracha);
    pneu.rotation.z = Math.PI / 2;
    for (const lado of [-1, 1]) {
      const face = lado * (largura / 2 + 0.008);
      const aro = mesh(giro, new THREE.TorusGeometry(raio * 0.72, raio * 0.055, 6, segmentos), p.metal, face, 0, 0);
      aro.rotation.y = Math.PI / 2;
      const disco = mesh(giro, new THREE.CylinderGeometry(raio * 0.53, raio * 0.53, 0.018, segmentos), p.escuro, face, 0, 0);
      disco.rotation.z = Math.PI / 2;
      const n = simples ? 3 : 7;
      for (let i = 0; i < n; i++) {
        const a = i * Math.PI * 2 / n;
        const spoke = caixa(giro, p.metal, 0.04, raio * 0.62, 0.065,
          face + lado * 0.012, Math.cos(a) * raio * 0.34, Math.sin(a) * raio * 0.34);
        spoke.rotation.x = a;
      }
      esfera(giro, p.detalhe, face + lado * 0.024, 0, 0, 0.045, raio * 0.14, raio * 0.14);
    }
    compactar(giro);
    (grupo.userData.rodas ||= []).push({ direcao, giro, frente, raio });
  }
  function sombra(grupo, w = 3.2, d = 5.4) {
    const c = canvas(64), ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, "rgba(10,24,30,.45)"); g.addColorStop(1, "rgba(10,24,30,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const mat = new THREE.MeshBasicMaterial({ map: textura(c), transparent: true, depthWrite: false, toneMapped: false });
    const s = mesh(grupo, new THREE.PlaneGeometry(w, d), mat, 0, -0.57, 0);
    s.rotation.x = -Math.PI / 2; s.castShadow = false;
    grupo.userData.sombra = s;
  }
  function acabamentoCarro(g, p, baixo = false) {
    const y = baixo ? 0.19 : 0.35;
    caixa(g, p.escuro, 2.1, 0.16, 0.18, 0, -0.06, -2.12, 0.04);
    caixa(g, p.escuro, 1.04, 0.23, 0.06, 0, y, -2.21, 0.03);
    for (let n = 0; n < 5; n++) caixa(g, p.metal, 0.78, 0.018, 0.03, 0, y - 0.08 + n * 0.04, -2.25);
    for (const lado of [-1, 1]) {
      caixa(g, p.escuro, 0.59, 0.27, 0.1, lado * 0.82, y, -2.13, 0.06);
      caixa(g, p.farol, 0.43, 0.095, 0.025, lado * 0.82, y + 0.025, -2.195, 0.02);
      caixa(g, p.lanterna, 0.59, 0.13, 0.04, lado * 0.8, y, 2.205, 0.03);
      caixa(g, p.metal, 0.31, 0.05, 0.05, lado * 1.195, y + 0.28, 0.28, 0.012);
      caixa(g, p.escuro, 0.09, 0.12, 3.25, lado * 1.19, -0.1, 0);
      caixa(g, p.tinta, 0.3, 0.16, 0.2, lado * 1.33, y + 0.37, -0.65, 0.05);
      caixa(g, p.vidro, 0.23, 0.105, 0.025, lado * 1.33, y + 0.37, -0.53);
      const exhaust = mesh(g, new THREE.CylinderGeometry(0.085, 0.085, 0.24, 10), p.metal, lado * 0.73, -0.13, 2.2);
      exhaust.rotation.x = Math.PI / 2;
    }
    const t = etiqueta("SABER", "#edf5fa", "#193044");
    placa(g, t, 0.55, 0.14, 0, 0.12, 2.227);
  }
  function cabine(g, p, w, h, d, y, z) {
    // Tapered roof and sloped windshields, instead of a rectangular glass box.
    const pontos = [
      [-w / 2, y, z - d / 2], [w / 2, y, z - d / 2],
      [w / 2, y, z + d / 2], [-w / 2, y, z + d / 2],
      [-w * 0.41, y + h, z - d * 0.28], [w * 0.41, y + h, z - d * 0.28],
      [w * 0.41, y + h, z + d * 0.34], [-w * 0.41, y + h, z + d * 0.34],
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pontos.flat(), 3));
    geo.setIndex([0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,7,6,4,6,5,0,1,2,0,2,3]);
    geo.computeVertexNormals();
    mesh(g, geo, p.vidro);
    caixa(g, p.tinta, w * 0.85, 0.115, d * 0.65, 0, y + h + 0.022, z + d * 0.03, 0.045);
    for (let i = 0; i < 4; i++) haste(g, p.tinta, pontos[i], pontos[i + 4], 0.043);
    for (const lado of [-1, 1]) {
      haste(g, p.tinta, [lado * w / 2, y, z + 0.12], [lado * w * 0.41, y + h, z + 0.12], 0.04);
      haste(g, p.metal, [lado * w / 2, y + 0.02, z - d * 0.42], [lado * w / 2, y + 0.02, z + d * 0.42], 0.018);
    }
  }
  function montarCarro(grupo, modelo, policial = false) {
    limpar(grupo);
    const tipo = modelo.visual;
    if (tipo.startsWith("moto")) { montarMoto(grupo, modelo, policial); return; }
    const p = paleta(modelo.carroceria, modelo.detalhe);
    grupo.userData.lanternas = p.lanterna;
    const g = new THREE.Group(); grupo.add(g);
    const baixo = ["f1", "hiper", "esportivo"].includes(tipo);
    const alto = ["pickup", "turbovan", "rally"].includes(tipo);
    caixa(g, p.escuro, 2.12, 0.2, 4.1, 0, -0.15, 0, 0.065);
    caixa(g, p.tinta, tipo === "f1" ? 1.02 : 2.36, baixo ? 0.52 : 0.74, 4.35, 0, baixo ? 0.16 : 0.28, 0, 0.17);
    if (tipo === "f1") {
      for (const lado of [-1, 1]) {
        caixa(g, p.tinta, 0.57, 0.45, 1.95, lado * 0.86, 0.16, 0.5, 0.12);
        for (const z of [-1.39, 1.43]) {
          haste(g, p.escuro, [lado * 0.4, 0, z - 0.25], [lado * 1.12, -0.05, z], 0.045);
          haste(g, p.escuro, [lado * 0.4, 0, z + 0.25], [lado * 1.12, -0.05, z], 0.045);
        }
      }
      caixa(g, p.escuro, 2.34, 0.09, 0.58, 0, 0.01, -2.25, 0.04);
      caixa(g, p.tinta, 0.58, 0.36, 2.3, 0, 0.51, -0.83, 0.14);
      caixa(g, p.escuro, 0.86, 0.12, 1.05, 0, 0.53, 0.34, 0.12);
      esfera(g, p.detalhe, 0, 0.89, 0.43, 0.3, 0.32, 0.32);
      haste(g, p.metal, [-0.43, 0.69, -0.1], [0, 1.05, 0.75], 0.06);
      haste(g, p.metal, [0.43, 0.69, -0.1], [0, 1.05, 0.75], 0.06);
    } else if (tipo === "pickup") {
      cabine(g, p, 1.93, 0.78, 1.78, 0.65, -0.48);
      caixa(g, p.escuro, 1.77, 0.18, 1.5, 0, 0.69, 1.32, 0.05);
      for (const lado of [-1, 1]) caixa(g, p.tinta, 0.18, 0.38, 1.72, lado * 1.08, 0.83, 1.25, 0.045);
      caixa(g, p.tinta, 2.18, 0.4, 0.15, 0, 0.83, 2.07, 0.04);
      haste(g, p.metal, [-0.88, 0.9, 0.59], [-0.88, 1.57, 0.59], 0.075);
      haste(g, p.metal, [0.88, 0.9, 0.59], [0.88, 1.57, 0.59], 0.075);
      haste(g, p.metal, [-0.88, 1.57, 0.59], [0.88, 1.57, 0.59], 0.075);
    } else {
      const h = tipo === "turbovan" ? 1.15 : tipo === "hiper" ? 0.4 : baixo ? 0.57 : 0.73;
      const d = tipo === "turbovan" ? 3.0 : baixo ? 2.25 : 2.05;
      cabine(g, p, baixo ? 1.86 : 1.98, h, d, 0.64, 0.18);
    }
    if (baixo || tipo === "rally") {
      const altura = tipo === "f1" ? 1.01 : 0.95;
      for (const lado of [-1, 1]) caixa(g, p.escuro, 0.07, 0.46, 0.16, lado * 0.79, altura - 0.23, 1.91);
      caixa(g, p.detalhe, 2.48, 0.1, 0.43, 0, altura, 1.96, 0.035);
    }
    // Painted hood stripes and visible panel seams.
    for (const lado of [-1, 1]) {
      caixa(g, p.detalhe, 0.17, 0.014, 1.17, lado * 0.3, baixo ? 0.429 : 0.659, -1.35);
      caixa(g, p.escuro, 0.016, 0.37, 0.028, lado * 1.187, 0.32, 0.63);
    }
    acabamentoCarro(g, p, baixo);
    if (tipo === "rally") for (const x of [-0.46, 0, 0.46]) esfera(g, p.farol, x, 0.47, -2.23, 0.16, 0.16, 0.07);
    if (policial) {
      for (const lado of [-1, 1]) {
        caixa(g, p.escuro, 0.025, 0.3, 2.45, lado * 1.193, 0.36, 0.03);
        placa(g, etiqueta("POLICIA"), 1.28, 0.31, lado * 1.216, 0.4, 0.02, lado * Math.PI / 2);
      }
      caixa(g, p.escuro, 1.6, 0.1, 0.45, 0, 1.51, 0.16, 0.04);
      haste(g, p.escuro, [0.65, 1.43, 0.85], [0.65, 2.12, 0.99], 0.018);
      caixa(g, p.metal, 1.75, 0.1, 0.14, 0, 0.01, -2.31);
    }
    compactar(g);
    for (const x of [-1.13, 1.13]) for (const z of [-1.39, 1.43])
      roda(grupo, p, x, alto ? 0.02 : -0.05, z, alto ? 0.59 : 0.54, 0.36, z < 0);
    sombra(grupo);
  }
  function montarMoto(grupo, modelo, policial = false) {
    const p = paleta(modelo.carroceria, modelo.detalhe);
    grupo.userData.lanternas = p.lanterna;
    const g = new THREE.Group(); grupo.add(g);
    const trilha = modelo.visual === "moto-trilha";
    const raio = policial ? 0.71 : 0.55;
    const yRoda = policial ? -0.07 : -0.04;
    const zFrente = policial ? -1.6 : -1.43, zTras = policial ? 1.5 : 1.43;
    roda(grupo, p, 0, yRoda, zFrente, raio, 0.3, true);
    roda(grupo, p, 0, yRoda, zTras, raio, 0.38);
    caixa(g, p.metal, 0.59, 0.55, 0.76, 0, 0.29, 0.18, 0.08);
    for (let i = 0; i < 5; i++) caixa(g, p.escuro, 0.64, 0.025, 0.8, 0, 0.12 + i * 0.08, 0.18);
    esfera(g, p.tinta, 0, 0.82, -0.26, 0.42, 0.39, 0.61);
    caixa(g, p.escuro, 0.65, 0.17, 1.18, 0, 0.9, 0.67, 0.07);
    caixa(g, p.tinta, 0.64, 0.18, 0.6, 0, 0.77, 1.3, 0.07);
    for (const lado of [-1, 1]) {
      haste(g, p.metal, [lado * 0.21, 1.08, -0.82], [lado * 0.21, yRoda, zFrente], 0.055);
      haste(g, p.escuro, [lado * 0.27, 0.7, -0.5], [lado * 0.24, yRoda, zTras], 0.055);
      haste(g, p.escuro, [lado * 0.23, 0.98, 0.59], [lado * 0.24, 0.05, 0.2], 0.09);
      haste(g, p.escuro, [lado * 0.26, 1.58, 0.25], [lado * 0.47, 1.2, -0.9], 0.105);
      esfera(g, p.escuro, lado * 0.29, 0.2, 0.34, 0.16, 0.13, 0.28);
    }
    haste(g, p.metal, [-0.55, 1.17, -0.91], [0.55, 1.17, -0.91], 0.052);
    haste(g, p.metal, [0.42, 0.18, 0.36], [0.42, 0.34, 1.45], 0.105);
    esfera(g, p.farol, 0, 0.97, -1.13, 0.28, 0.2, 0.08);
    const tela = caixa(g, p.vidro, 0.57, policial ? 0.71 : 0.38, 0.06, 0, 1.25, -0.98, 0.025);
    tela.rotation.x = -0.24;
    caixa(g, p.lanterna, 0.41, 0.11, 0.07, 0, 0.82, 1.61, 0.025);
    // Rider silhouette: jacket, articulated limbs, helmet and curved dark visor.
    const torso = caixa(g, policial ? p.escuro : p.tinta, 0.67, 0.67, 0.45, 0, 1.42, 0.31, 0.14);
    torso.rotation.x = -0.16;
    esfera(g, policial ? p.branco : p.detalhe, 0, 2.0, 0.16, 0.36, 0.39, 0.36);
    esfera(g, p.vidro, 0, 2.015, -0.02, 0.315, 0.19, 0.24);
    if (trilha) caixa(g, p.detalhe, 0.67, 0.055, 0.44, 0, 2.2, -0.1, 0.02);
    if (policial) {
      for (const lado of [-1, 1]) {
        caixa(g, p.branco, 0.44, 0.6, 0.94, lado * 0.53, 0.49, 1.0, 0.08);
        placa(g, etiqueta("POLICIA"), 0.75, 0.2, lado * 0.76, 0.51, 1.0, lado * Math.PI / 2);
        haste(g, p.metal, [lado * 0.49, 1.12, -0.9], [lado * 0.6, 1.58, -0.95], 0.02);
        esfera(g, p.vidro, lado * 0.6, 1.6, -0.95, 0.11, 0.065, 0.035);
      }
    }
    compactar(g); sombra(grupo, 2.4, 4.6);
  }
  function policia(opcoes, moto = false) {
    const visual = new THREE.Group();
    const modelo = { visual: moto ? "moto-urbana" : "classico", carroceria: opcoes.corBase, detalhe: moto ? opcoes.corDetalhe : opcoes.corCapo };
    if (moto) montarMoto(visual, modelo, true); else montarCarro(visual, modelo, true);
    function sirene(color, x) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      return caixa(visual, mat, moto ? 0.15 : 0.59, 0.17, 0.28, x, moto ? 1.35 : 1.65, moto ? -0.94 : 0.16, 0.055);
    }
    const sireneA = sirene(opcoes.corSireneA, moto ? -0.3 : -0.45);
    const sireneB = sirene(opcoes.corSireneB, moto ? 0.3 : 0.45);
    function luz(color, x) {
      if (simples || perfil.firefox) return null;
      const l = new THREE.PointLight(color, 0, moto ? 11 : 14, 2);
      l.position.set(x, moto ? 1.5 : 1.8, moto ? -0.94 : 0.16);
      visual.add(l); return l;
    }
    return { visual, sireneA, sireneB,
      luzSireneA: luz(opcoes.corSireneA, -0.45), luzSireneB: luz(opcoes.corSireneB, 0.45) };
  }
  function helicoptero() {
    const grupo = new THREE.Group(), g = new THREE.Group(), p = paleta(0x223f54, 0xefc75b);
    grupo.add(g);
    esfera(g, p.tinta, 0, 0, 0, 1.37, 1.27, 2.38);
    esfera(g, p.vidro, 0, 0.21, 1.42, 1.25, 0.91, 1.27);
    haste(g, p.metal, [0, -0.3, 2.65], [0, 0.9, 1.57], 0.055);
    for (const lado of [-1, 1]) {
      caixa(g, p.vidro, 0.045, 0.74, 1.17, lado * 1.32, 0.3, -0.14, 0.04);
      caixa(g, p.detalhe, 0.025, 0.16, 2.16, lado * 1.345, -0.28, -0.08);
      placa(g, etiqueta("POLICIA"), 1.67, 0.32, lado * 1.38, -0.55, -0.03, lado * Math.PI / 2);
      haste(g, p.metal, [lado * 0.72, -0.78, 1.17], [lado * 1.35, -1.65, 1.17], 0.09);
      haste(g, p.metal, [lado * 0.72, -0.78, -1.14], [lado * 1.35, -1.65, -1.14], 0.09);
      haste(g, p.metal, [lado * 1.35, -1.65, -2], [lado * 1.35, -1.65, 1.9], 0.1);
      haste(g, p.metal, [lado * 1.35, -1.65, 1.9], [lado * 1.35, -1.44, 2.25], 0.1);
      esfera(g, p.escuro, lado * 0.48, 1.06, -0.7, 0.4, 0.4, 0.94);
    }
    const cauda = mesh(g, new THREE.CylinderGeometry(0.22, 0.63, 4.5, 10), p.tinta, 0, 0.18, -4.02);
    cauda.rotation.x = -Math.PI / 2;
    const leme = caixa(g, p.tinta, 0.13, 1.87, 1.12, 0, 0.85, -6.14, 0.05);
    leme.rotation.x = -0.28;
    caixa(g, p.detalhe, 0.145, 0.18, 0.85, 0, 1.5, -6.33);
    caixa(g, p.tinta, 2.5, 0.1, 0.63, 0, 0.32, -5.48, 0.04);
    haste(g, p.metal, [0, 1.05, 0], [0, 1.94, 0], 0.11);
    esfera(g, p.escuro, 0, -1.17, 1.38, 0.31);
    esfera(g, p.farol, 0, -1.25, 1.59, 0.22, 0.19, 0.09);
    compactar(g);
    const rotorPrincipal = new THREE.Group(); rotorPrincipal.position.y = 1.91;
    esfera(rotorPrincipal, p.metal, 0, 0, 0, 0.34, 0.14, 0.34);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const blade = caixa(rotorPrincipal, p.escuro, 0.34, 0.06, 5, Math.sin(a) * 2.65, 0, Math.cos(a) * 2.65);
      blade.rotation.y = a;
      const tip = caixa(rotorPrincipal, p.detalhe, 0.34, 0.065, 0.38, Math.sin(a) * 4.96, 0, Math.cos(a) * 4.96);
      tip.rotation.y = a;
    }
    compactar(rotorPrincipal);
    const rotorCauda = new THREE.Group(); rotorCauda.position.set(0.26, 0.7, -6.2);
    for (const a of [0, Math.PI / 2]) {
      const blade = caixa(rotorCauda, p.escuro, 0.08, 1.84, 0.16);
      blade.rotation.x = a;
    }
    compactar(rotorCauda); grupo.add(rotorPrincipal, rotorCauda);
    grupo.userData = { rotorPrincipal, rotorCauda }; grupo.visible = false;
    grupo.traverse(o => { if (o.isMesh) o.castShadow = !simples; });
    return grupo;
  }
  function arvore(x, z) {
    const g = new THREE.Group(), tronco = material(0x78563d);
    mesh(g, new THREE.CylinderGeometry(0.4, 0.74, 5.7, 7), tronco, 0, 2.85, 0);
    for (const lado of [-1, 1]) haste(g, tronco, [0, 3.1, 0], [lado * 1.4, 5.5, 0.3], 0.2);
    const cores = [0x326948, 0x458356, 0x619658];
    for (let i = 0; i < 3; i++) {
      const m = mesh(g, new THREE.ConeGeometry(3.5 - i * 0.65, 4.5 - i * 0.35, simples ? 7 : 10), material(cores[i]), 0, 4.8 + i * 1.65, 0);
      m.rotation.y = i * 0.7 + x;
    }
    compactar(g); g.position.set(x, 0, z); return g;
  }
  function decorar(tipo, objeto) {
    const p = objeto.geometry?.parameters || {};
    const g = new THREE.Group();
    const matClaro = material(0xe5dfbd), matEscuro = material(0x34414b);
    if (tipo === "rampa") {
      objeto.material.color.copy(cor(0x536574));
      for (const x of [-5.9, 5.9]) caixa(g, matClaro, 0.35, 0.035, 17.8, x, 2.215, 0);
      for (let z = -7; z <= 7; z += 2.8) {
        for (const lado of [-1, 1]) {
          const seta = caixa(g, matClaro, 3.5, 0.04, 0.5, lado * 1.1, 2.23, z);
          seta.rotation.y = lado * -0.48;
        }
      }
      for (let z = -8; z <= 8; z += 1.2) caixa(g, matEscuro, 11, 0.025, 0.055, 0, 2.225, z);
    } else if (tipo === "cone") {
      const r = p.radius, h = p.height;
      caixa(g, matEscuro, r * 1.8, 0.18, r * 1.8, 0, -h / 2 + 0.09, 0, 0.06);
      for (const t of [0.42, 0.66]) mesh(g,
        new THREE.CylinderGeometry(r * (1 - t - 0.07) + 0.025, r * (1 - t + 0.07) + 0.025, h * 0.14, objeto.geometry.parameters.radialSegments),
        matClaro, 0, h * (t - 0.5), 0);
    } else if (tipo === "caixa") {
      const { width: w, height: h, depth: d } = p;
      const madeira = material(0x8b6743);
      for (const x of [-w * 0.38, w * 0.38]) caixa(g, madeira, w * 0.1, h + 0.05, d + 0.05, x, 0, 0);
      for (const y of [-h * 0.38, h * 0.38]) caixa(g, madeira, w + 0.06, h * 0.1, d + 0.08, 0, y, 0);
      for (let i = 1; i < 5; i++) caixa(g, matEscuro, w - 0.16, 0.025, 0.018, 0, h * (i / 5 - 0.5), d / 2 + 0.005);
    } else if (tipo === "pedra") {
      objeto.material.color.copy(cor(0x91a096));
      const r = p.radius;
      const musgo = mesh(g, new THREE.DodecahedronGeometry(r * 0.48), material(0x718557), r * 0.15, r * 0.57, -r * 0.1);
      musgo.scale.y = 0.45;
    } else if (tipo === "arbusto") {
      objeto.material.color.copy(cor(0x3c7353));
      const r = p.radius;
      for (let i = 0; i < 3; i++) {
        const a = i * 2.1;
        const m = mesh(g, new THREE.DodecahedronGeometry(r * 0.58), material(i % 2 ? 0x78945d : 0x58895b),
          Math.cos(a) * r * 0.5, r * 0.32, Math.sin(a) * r * 0.5);
        m.scale.y = 0.65;
      }
    }
    compactar(g);
    if (!g.children.length) { matClaro.dispose(); matEscuro.dispose(); }
    objeto.add(g);
  }
  function materialChao(extensao = 1) {
    const c = canvas(simples ? 512 : 1024), ctx = c.getContext("2d"), n = c.width;
    ctx.fillStyle = "#7d9959"; ctx.fillRect(0, 0, n, n);
    for (let i = 0; i < 18000; i++) {
      ctx.fillStyle = random() > 0.5 ? "rgba(45,81,45,.055)" : "rgba(202,201,135,.065)";
      ctx.beginPath(); ctx.arc(random() * n, random() * n, 2 + random() * 18, 0, Math.PI * 2); ctx.fill();
    }
    // A traversable dirt trail: purely painted, with no invisible boundaries.
    ctx.save(); ctx.translate(n / 2, n / 2); ctx.scale(1 / extensao, 1 / extensao);
    ctx.strokeStyle = "rgba(164,148,106,.58)"; ctx.lineWidth = n * 0.027;
    ctx.beginPath(); ctx.ellipse(0, 0, n * 0.32, n * 0.26, -0.2, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(194,177,127,.4)"; ctx.lineWidth = n * 0.014; ctx.stroke();
    ctx.restore();
    const t = textura(c);
    const mat = material(0xffffff); mat.map = t;
    if (!simples) {
      const micro = canvas(128), m = micro.getContext("2d"), data = m.createImageData(128, 128);
      for (let i = 0; i < data.data.length; i += 4) {
        const v = 100 + Math.floor(random() * 60); data.data.set([v, v, v, 255], i);
      }
      m.putImageData(data, 0, 0);
      const bump = new THREE.CanvasTexture(micro); bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
      bump.repeat.set(90 * extensao, 90 * extensao); texturas.add(bump); mat.bumpMap = bump; mat.bumpScale = 0.13;
    }
    return mat;
  }
  function ambiente() {
    cena.background = new THREE.Color(0x9fcbdc);
    cena.fog = new THREE.Fog(0xc4d9d4, 180, 560);
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    cena.traverse(o => {
      if (o.isHemisphereLight) { o.intensity = 1.65; o.color.set(0xd7efff); o.groundColor.set(0x74844e); }
      else if (o.isAmbientLight) o.intensity = 0.3;
      else if (o.isDirectionalLight) o.intensity *= 2.7;
    });
    const sky = canvas(16, 256), ctx = sky.getContext("2d"), grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#4f91b8"); grad.addColorStop(0.6, "#b6dbe4"); grad.addColorStop(1, "#e6e5c8");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 16, 256);
    const ceu = mesh(cena, new THREE.SphereGeometry(650, 24, 12),
      new THREE.MeshBasicMaterial({ map: textura(sky), side: THREE.BackSide, fog: false, depthWrite: false }));
    ceu.castShadow = false; ceu.renderOrder = -10;
    // Cloud silhouettes and distant peaks stay outside the playable space.
    const nuvens = new THREE.Group(), matNuvem = new THREE.MeshBasicMaterial({ color: 0xeaf2ed, fog: true });
    for (let i = 0; i < (simples ? 8 : 14); i++) {
      const a = i * 2.399, x = Math.cos(a) * 310, z = Math.sin(a) * 310;
      for (let j = 0; j < 3; j++) esfera(nuvens, matNuvem, x + j * 14, 75 + (i % 3) * 13, z, 21, 7 + j * 2, 11);
    }
    compactar(nuvens); nuvens.traverse(o => { o.castShadow = false; }); cena.add(nuvens);
    const picos = new THREE.Group();
    const matPicos = [material(0x82989b), material(0x97aaa5)];
    for (let i = 0; i < 22; i++) {
      const a = i * Math.PI * 2 / 22, h = 55 + random() * 48;
      const m = mesh(picos, new THREE.ConeGeometry(35 + random() * 17, h, 5),
        matPicos[i % 2], Math.cos(a) * 325, h * 0.34, Math.sin(a) * 325);
      m.rotation.y = a;
    }
    compactar(picos); cena.add(picos);
  }
  function atualizarVeiculo(grupo, corpo, delta, freando = false) {
    if (!grupo.visible) return;
    if (grupo.userData.lanternas) grupo.userData.lanternas.color.setHex(freando ? 0xff3145 : 0x981c29);
    const v = corpo.velocity, q = corpo.quaternion;
    const frenteX = -2 * (q.x * q.z + q.w * q.y), frenteZ = -(1 - 2 * (q.x * q.x + q.y * q.y));
    const velocidade = v.x * frenteX + v.z * frenteZ;
    for (const r of grupo.userData.rodas || []) {
      r.giro.rotation.x -= velocidade * delta / r.raio;
      if (r.frente) r.direcao.rotation.y = THREE.MathUtils.clamp(corpo.angularVelocity.y * 0.16, -0.4, 0.4);
    }
    const s = grupo.userData.sombra;
    if (s) { s.position.y = -corpo.position.y + 0.025; s.material.opacity = Math.max(0, 1 - Math.max(0, corpo.position.y - 0.6) / 7); }
  }
  function limpar(grupo) {
    const materiais = new Set(), geometrias = new Set();
    grupo.traverse(o => { if (o.geometry) geometrias.add(o.geometry); if (o.material) materiais.add(o.material); });
    for (const g of geometrias) g.dispose();
    for (const m of materiais) {
      if (m.map) { m.map.dispose(); texturas.delete(m.map); }
      m.dispose();
    }
    grupo.clear(); grupo.userData = {};
  }
  function dispose() { for (const t of texturas) t.dispose(); texturas.clear(); }
  ambiente();
  return { montarCarro, policia, helicoptero, arvore, decorar, materialChao, atualizarVeiculo, dispose };
}
