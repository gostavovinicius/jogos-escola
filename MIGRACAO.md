# Migração do Corrida do Saber

## Atualização visual posterior

Após a migração descrita abaixo, uma nova direção visual foi implementada no jogo principal, a pedido do usuário. A preservação da aparência mencionada no restante deste documento descreve a primeira etapa.

O módulo `jogos/meus-jogos/corrida/js/art.mjs` concentra os modelos procedurais e seus materiais. Os dez veículos da garagem têm carrocerias detalhadas, vidros inclinados, reflexos, faróis, lanternas de freio, rodas com aros e animação de giro/esterçamento. As motos têm piloto, capacete, motor, suspensão e escapamento; as viaturas e motos policiais mantêm sirenes e recebem identificação. O helicóptero tem cabine, cauda, rotores, motor, esquis e farol detalhados.

O cenário recebeu céu em gradiente, nuvens, picos distantes, nova grama com uma trilha pintada, árvores em camadas, pedras com musgo, arbustos, caixas de madeira, cones refletivos e rampas sinalizadas. A trilha é apenas visual: toda a área original continua transitável.

Não houve alteração no Rapier, colliders, massas, controles, regras ou progressão nesta etapa visual. As geometrias fixas dos modelos são agrupadas por material; o perfil simples reduz segmentos, dispensa relevo de textura e mantém reflexos por cubemap e sombras de contato leves. Suavização de bordas é solicitada para WebGL 2 no perfil com pelo menos 8 GB reportados pelo navegador.

A página de backup mantém sua aparência anterior. O jogo usado pelo catálogo é `corrida.html`.

Validação desta etapa: 13 testes unitários, checagem de 90 arquivos, execução nos dois renderers, perfil com sombras, controles, respawn, pontuação, coleta, progressão e recuperação de contexto. `scripts/capture-art.mjs` captura os dez modelos e os detalhes da frota com o próprio renderer, sem imagens externas. As capturas ficam em `test-results/`.

## Arquivos e arquitetura

- `corrida.html` mantém a interface e inicia somente o bootstrap.
- `corrida/js/bootstrap.js` apresenta o carregamento, os erros e o limite de espera.
- `corrida/js/start.mjs` detecta gráficos, importa a versão escolhida, aguarda o WebAssembly e só então carrega configuração, fases e lógica.
- `corrida/js/graphics.mjs` centraliza capacidades e a adaptação da iluminação.
- `corrida/js/physics.mjs` cria e administra o mundo, rigid bodies e colliders do Rapier.
- `corrida/js/main.js` mantém a lógica de jogo, com as integrações físicas e gráficas adaptadas.
- `corrida-backup.html` também foi migrado. Sua interface e lógica próprias continuam presentes; ele compartilha a nova infraestrutura.
- `package.json` e `pnpm-lock.yaml` fixam as dependências. O site continua estático, sem bundler ou etapa de compilação.

Os caminhos acima são relativos a `jogos/meus-jogos/`.

## Inspeção inicial

A referência anterior é o commit `cdee5cf7a289a792032b48e348170949f4ae25e4`.

O jogo principal usava Three.js 0.149.0, e o backup, r128. Ambos carregavam a biblioteca física 0.6.2 por CDN. Essas eram as únicas páginas/códigos que dependiam daquele motor físico.

O mundo usa gravidade de -20, um chão infinito, caixas e esferas, incluindo colliders compostos em montanhas e rampas. Os elementos de cenário são fixos; jogador, viaturas e motos são dinâmicos. As massas são, respectivamente, 800, 900 e 540.

Movimento e IA aplicam forças centrais, ajustam velocidades, tração lateral e orientação. Contatos alimentam detecção de chão, rampas, colisão com polícia e captura. Saltos de rampa, tiros do helicóptero e empurrões modificam velocidades por regras próprias. A coleta de sílabas usa distância, não sensores físicos.

Não havia trimeshes, convex polyhedra, raycasts físicos, máscaras/grupos personalizados, corpos cinemáticos ou sensores para migrar. Não há GLTFLoader, DRACOLoader, OrbitControls, animation mixers ou pós-processamento no jogo de corrida. Modelos, partículas e texturas de canvas são gerados pelo código. Câmera, teclado, touch, menus, fases, progressão, animações e chaves de salvamento foram mantidos.

## Gráficos

| Capacidade detectada | Módulo efetivamente carregado |
| --- | --- |
| WebGL 2 | Three.js 0.186.0 |
| Somente WebGL 1 | Three.js 0.162.0 |
| Nenhum dos dois | Mensagem amigável, sem iniciar o jogo |

A detecção usa canvases separados e entrega ao renderer o próprio contexto detectado. Somente a versão selecionada é baixada; cada módulo resolve suas dependências da mesma versão no jsDelivr.

`graphicsCapabilities` contém versão WebGL, disponibilidade de WebGL 2, versão Three.js, tamanho máximo de textura e amostras máximas.

Texturas usam `colorSpace`, e a saída usa `outputColorSpace`. Uma adaptação GLSL compartilhada conserva a iluminação Lambert e o alcance das luzes pontuais usados anteriormente. Mantêm-se tone mapping, exposição, neblina, sombras e perfis de qualidade. A resolução de sombras respeita o limite do dispositivo.

O caminho WebGL 1 executa o jogo completo com o mesmo Rapier e regras. Não foi necessário remover um efeito exclusivamente WebGL 2.

## Física

Rapier Compat 0.20.0 é inicializado com `await init()` antes de criar o mundo.

As formas são descritores nativos: `ColliderDesc.cuboid`, `ColliderDesc.ball` e `HalfSpace`. Colliders compostos preservam deslocamentos e orientação. Corpos fixos e dinâmicos são criados separadamente. As massas dos colliders geram a massa/inércia dos veículos; as rotações físicas X/Z ficam bloqueadas como antes.

Vetores/quaternions reutilizáveis mantêm a fronteira entre a lógica existente, que edita eixos individuais, e os setters/getters nativos do Rapier. A integração e a resolução de colisões são feitas exclusivamente pelo Rapier.

| Par de contato | Atrito | Restituição |
| --- | --- | --- |
| Veículo/cenário | 0 | 0,02 |
| Veículo/veículo | 0,08 | 0,04 |

Os valores são obtidos com as regras nativas Min para atrito e Multiply para restituição. Contatos entre elementos fixos não precisam de resposta física.

O amortecimento exponencial original é convertido e aplicado antes da integração. A ordem é relevante: usar diretamente o amortecimento interno do novo motor produzia uma diferença mensurável no giro. As forças são limpas após cada passo efetivamente executado, preservando sua cadência original.

Os manifolds nativos fornecem contatos e normais para chão, rampas e polícia. Pares separados, apenas previstos pela detecção, não contam como contato. O início de contato é emitido uma vez por par de corpos; contatos persistentes continuam disponíveis para captura.

O acumulador mantém os passos físicos dos perfis existentes, o passo menor em rampas e o limite de substeps. A renderização continua por requestAnimationFrame. Mantiveram-se os ajustes de movimento por frame e o limite de delta existentes, para não alterar a sensação em máquinas lentas.

## Inicialização, erros e desempenho

- Aviso durante carregamento, falha de biblioteca/arquivo, falta de WebGL/WebAssembly e erro de inicialização.
- O loop só começa depois de bibliotecas, física e objetos procedurais prontos.
- Perda de contexto pausa o loop e limpa controles; recuperação retoma a renderização. O aviso orienta recarregar se o navegador não recuperar o contexto.
- Erros de shader e de execução aparecem na tela.
- Vetores de leitura do Rapier e registros de contato são reutilizados.
- Corpos fixos não participam da sincronização por frame.
- Posição e rotação só são enviadas ao Rapier quando a lógica as altera.
- Remoção de objetos de fase também remove os colliders e referências de contato.
- O mundo libera sua memória WebAssembly ao sair da página, exceto quando preservado pelo cache de navegação.

## Executar e verificar

Com Node.js e pnpm disponíveis:

```text
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm start
```

Abra `http://127.0.0.1:4173/jogos/meus-jogos/corrida.html`. A publicação continua sendo dos arquivos estáticos do projeto. Os módulos exigem servir por HTTP/HTTPS, em vez de abrir a página diretamente por file://.

Os testes de navegador são opcionais e utilizam Playwright e Microsoft Edge instalados no ambiente:

```text
node scripts/verify-browser.mjs
node scripts/compare-baseline.mjs
```

Se Playwright não estiver na resolução local do Node, `PLAYWRIGHT_MODULE` aceita a URL file:// do módulo de um runtime existente. Esses testes não adicionam dependências de navegador ao site.

O primeiro teste serve as versões instaladas para validar de forma reproduzível os módulos escolhidos. O segundo lê a referência pelo Git e carrega suas bibliotecas apenas em memória, para comparar o comportamento; requer rede. Não resta um motor antigo instalado, importado ou usado como fallback pela aplicação.

## Resultados e limites da validação

- Verificação sintática e de referências locais de scripts/estilos em 88 arquivos.
- 13 testes automatizados de detecção, iluminação, massa, gravidade, força, amortecimento, acumulador, chão, salto, rampa e colisão entre veículos.
- Testes de navegador com WebGL 2, WebGL 1 real em contexto restrito, perfil com sombras e página de backup.
- Movimento, curva, respawn, coleta, pontuação e passagem de fase testados.
- Perda/recuperação de contexto, ausência de WebGL/WebAssembly e falha de rede testadas.
- Nenhum erro de console nos cenários de sucesso.
- Não existe build, typecheck TypeScript ou configuração de lint anterior; a checagem de sintaxe e os testes foram adicionados.

A comparação com a referência usa passos de 1/60 s, comandos controlados e pista sem colisões de obstáculos/polícia para isolar a movimentação. Após um segundo acelerando, mediu aproximadamente 42,70 contra 42,71 na referência. A diferença de posição ficou abaixo de 0,1 unidade nas amostras de repouso, aceleração, curva e frenagem. Os dois renderers produziram resultados físicos idênticos nessa sequência.

Não se promete igualdade bit a bit entre motores com solvers diferentes, sobretudo em colisões múltiplas. A validação gráfica utilizou Edge com renderização por software; não substitui teste em GPUs físicas antigas. Navegadores precisam também suportar WebAssembly, módulos e a sintaxe JavaScript já usada no jogo. Os módulos públicos continuam dependendo da disponibilidade do CDN.
