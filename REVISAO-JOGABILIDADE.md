# Limite do mapa, menu e revisão de jogabilidade

Atualizado em 16/09/2026. Jogo ativo: `jogos/meus-jogos/corrida.html`.

## Melhorias implementadas em 16/09/2026

As quatro lógicas foram corrigidas no jogo ativo. A análise de 15/09 abaixo foi preservada como histórico: suas descrições de problemas não representam mais a implementação atual. O backup legado não recebe estas alterações de jogabilidade.

### Continuidade do terreno e correção após teste manual

- O chão visual passou de 400 × 400 para 1600 × 1600, cobrindo a região sob e atrás das montanhas. A trilha pintada mantém suas dimensões e posição na área central. A barreira física continua em ±187; a área de jogo e o radar continuam usando o mapa de 400 unidades.
- O relato de captura travada em 0% foi reproduzido com a IA e a física rodando juntas: a rotina de colisão antiga separava os veículos, levantava o jogador e fazia a viatura recuar repetidamente. Em 28 segundos, o jogador sem comandos era empurrado até a borda sem acumular captura.
- Removidos o salto/empurrão artificial e o afastamento por distância entre centros. Rapier resolve as colisões; a polícia desacelera ao se aproximar de um jogador lento e mantém distância curta para concluir o cerco. Efeitos visuais de impactos continuam presentes.
- Abordagens distintas: viatura perseguidora segue diretamente; moto aproxima pela lateral com maior agilidade de curva; interceptadora antecipa o trajeto; flanqueadora abre pelo lado oposto e fecha o cerco. Ao chegar perto, todas podem concluir a captura.
- A validação integrada agora executa a IA real, incluindo aproximações por diferentes direções, captura junto à barreira, quatro unidades juntas e fuga acelerando. O teste anterior de captura isolada, com velocidades zeradas, não cobria o conflito com o movimento das viaturas.

### Tiros do helicóptero

- Mira calculada com a velocidade real do jogador, inclusive quando está parado. O projétil continua seguindo uma direção fixa depois de disparado.
- Colisão contínua considera o caminho completo do tiro e o deslocamento do jogador entre quadros, usando uma caixa próxima à carroceria/cabine, em vez da antiga esfera ampla.
- Chão e obstáculos físicos bloqueiam o tiro antes de atingir o jogador. Paredes invisíveis de contenção e montanhas decorativas não são cobertura, pois o helicóptero também ataca de fora do limite.
- Preservados os 30 segundos sem coleta para iniciar o ataque, disparos a cada 1,2 s, limite de quatro projéteis, duração de 5,4 s, velocidade e efeito de empurrão. A coleta continua encerrando o ataque e removendo os tiros.

### Perseguição policial

- Planejamento, destinos e malha compartilham o limite seguro de ±183,8 unidades, dentro das paredes de ±187.
- Destinos dentro de obstáculos são projetados para pontos navegáveis. Cada trecho da rota é verificado antes de ser seguido.
- Buscas sem resultado também respeitam o intervalo de 0,55 s. A polícia procura um ponto alcançável de recuperação; não volta a acelerar diretamente contra o destino bloqueado.
- Quando não existe saída segura, a viatura freia e, após três segundos sem rota, utiliza a recuperação de posicionamento já existente.
- Estratégias diferenciadas por unidade, mantendo quantidade de viaturas e limites de velocidade por dificuldade.

### Captura por proximidade

- Continua sendo cerco próximo, não exclusivamente colisão: exige distância menor que 1,6 unidade entre as carrocerias, caminho livre, ambos apoiados e diferença de altura de até 1,25.
- Cada policial precisa manter as condições por 0,35 s antes de acumular captura. Contato, velocidade relativa, dificuldade e número de viaturas ainda influenciam a pressão.
- Não há captura através de cobertura nem durante saltos. Ao escapar do cerco, o progresso diminui; a proteção de reaparecimento foi preservada.
- A barra e o texto “Captura” mostram somente o progresso real até a derrota. Mantidos o limiar de 1,8 e a penalidade existente; isso não significa um tempo fixo de 1,8 segundos.

### Salto das rampas

- Colisor alinhado à superfície visível de 13,2 × 4,4 × 18,4, com entrada baixa acessível a partir do chão.
- Exige contato com o topo, entrada pela metade inferior, veículo alinhado à subida e velocidade mínima de 6 unidades/s.
- Impulso único perto da saída, orientado pela rampa. Contatos laterais, carro parado e aproximação pelo sentido contrário não disparam o salto.
- Preservados os impulsos por modelo e fator de conforto de 0,78. O controle reinicia ao reaparecer.

### Validação das melhorias

- 39 testes automatizados passaram, incluindo 16 específicos de táticas, mira, cobertura, captura, navegação e rampas. As travessias físicas das rampas foram verificadas a 50, 60 e 90 passos por segundo.
- Teste integrado do jogo em WebGL 1 e 2: salto único, captura gradual, porcentagem exibida, cobertura impedindo captura/tiros, acerto com empurrão, derrota por captura, temporizador e limite de projéteis.
- `node scripts/analyze-gameplay.mjs` executa agora os 16 testes de regressão das quatro lógicas; não reproduz os defeitos antigos.
- `node scripts/verify-gameplay-browser.mjs` executa os cenários integrados. Os testes usam Edge com renderização de software, sem equivaler a uma avaliação de desempenho em celulares ou GPUs físicas.

## Histórico da revisão de 15/09/2026

## Alterações realizadas

- Quatro paredes invisíveis verticais contínuas, sem superfície superior nem classificação como chão/rampa. Mantida a face interna do limite antigo, em ±187 unidades.
- Removidas as colisões das montanhas: as antigas esferas/caixas não correspondiam aos novos cones visuais e podiam sustentar o veículo no vazio.
- Montanhas reposicionadas para que suas bases fiquem inteiramente fora da área jogável, inclusive nas diagonais.
- A proteção antes/depois da física considera a caixa de colisão girada do carro ou da moto. A anterior limitava apenas o centro a ±188, já dentro da parede que começava em ±187.
- A proteção remove somente a velocidade voltada para fora. Não altera altura, queda, movimento tangente nem velocidade de retorno para dentro do mapa.
- Tela inicial com nova identidade visual, cena com os modelos reais, miniaturas da garagem renderizadas do próprio jogo, foco de teclado visível e layout responsivo. Preservados os cinco veículos oferecidos no menu, preços, compras e dificuldades existentes.
- Miniaturas pré-renderizadas: nenhum contexto WebGL adicional no menu. Regeneração reproduzível em `scripts/render-menu-assets.mjs`.

O backup legado não recebeu estas alterações de mapa e menu. Na revisão inicial de 15/09, as quatro lógicas abaixo haviam sido apenas analisadas; foram modificadas em 16/09 conforme a seção acima.

## 1. Tiros do helicóptero

### Funcionamento atual

Após 30 segundos **sem coletar o próximo bloco**, o helicóptero passa a atacar, mesmo que o jogador esteja dirigindo. Coletar reinicia o temporizador e remove os projéteis. A partir da terceira fase também existe patrulha visual sem ataque enquanto o temporizador não expira.

Disparos a cada 1,2 s, velocidade 96 unidades/s, até quatro projéteis ativos, vida de 5,4 s. O tiro segue uma direção fixa calculada no disparo; não é teleguiado. O acerto usa uma esfera de raio √20 ≈ 4,47 ao redor do jogador, não a carroceria física. O impacto empurra o carro e provoca um pequeno salto; não desconta pontos diretamente.

### Achados

- **Mira deslocada para jogador parado — confirmado em execução isolada.** Abaixo de 3 unidades/s, a previsão inventa movimento de 8 unidades/s para a frente. Com helicóptero em (220, 29, 0), o alvo fica 18,53 unidades à frente do carro imóvel, muito além do raio de acerto.
- **Tiros não verificam obstáculos — confirmado por leitura do código.** A atualização consulta somente distância até o jogador, tempo de vida e limites. Árvores, caixas e rampas não bloqueiam o projétil. A parede invisível do mapa não deve necessariamente bloquear esses tiros, já que o helicóptero ataca de fora; essa regra precisa ser explícita numa futura correção.
- **Acerto rasante pode ser perdido entre quadros — confirmado em execução isolada.** A passagem de x=-1,6 para x=1,6 com distância lateral de 4,4 cruza a esfera de acerto, mas os extremos ficam fora. O teste atual registra zero impactos.

Próxima correção sugerida: usar a velocidade real, inclusive zero, e testar todo o segmento percorrido pelo projétil contra o jogador e os obstáculos relevantes. Separar obstáculos de cobertura das paredes de contenção do mapa.

Referências: `main.js`, funções `calcularAlvoPrevistoHelicoptero`, `dispararProjetilHelicoptero`, `atualizarProjeteisHelicoptero`, `atualizarPunicaoPorInatividade`.

## 2. Perseguição policial

### Funcionamento atual

A polícia prevê a posição do jogador, alterna estratégias de perseguição/interceptação e pode tentar bloquear a próxima sílaba. Usa uma malha de rotas para contornar obstáculos, forças para acelerar e ré quando fica travada. O número de unidades cresce conforme a dificuldade/fase, até quatro. O teto de velocidade acompanha o veículo do jogador: aproximadamente 82% a 89,5% nas dificuldades fácil/média e 100% na difícil, antes dos efeitos posteriores de colisões.

### Achados

- **Limites de destino e navegação diferentes — confirmado em execução isolada.** O alvo é limitado a ±180, mas a navegação só aceita pontos até ±176. Um destino em x=180 pode ser escolhido e rejeitado pelo próprio planejador. Esse conflito já existia antes da nova barreira, cuja face permanece em ±187.
- **Sem rota, a polícia volta a mirar no destino bloqueado — confirmado em execução isolada.** Quando a busca retorna uma lista vazia, a função devolve o alvo original. Isso pode fazer a viatura insistir num obstáculo.
- **Falha de rota ignora o intervalo de recálculo — confirmado em execução isolada.** A condição de rota vazia dispara nova busca a cada quadro. Foram 12 buscas em 12 quadros, mesmo com intervalo configurado de 0,55 s.

Próxima correção sugerida: unificar os limites de navegação/alvo com uma margem segura; respeitar o intervalo também após buscas sem resultado; escolher um ponto navegável de recuperação em vez de insistir diretamente no destino bloqueado.

Referências: `pontoNavegavelNoMapa`, `calcularRotaPolicialNoMapa`, `obterAlvoNavegacaoPolicial`, `criarPlanoIApolicial`, `atualizarIApolicia`.

## 3. Captura por proximidade

### Funcionamento atual

É uma captura por pressão acumulada, não exclusivamente por colisão. Combina distância horizontal/vertical, velocidade relativa, contato real e número de policiais próximos. O acumulador precisa chegar a 1,8, mas isso **não significa captura fixa em 1,8 segundos**: a taxa depende da dificuldade e pressão. Há redução de pressão após colisões e um período de proteção ao reaparecer.

### Achados

- **Pode capturar sem encostar — confirmado em execução isolada.** A 10 unidades de distância, na mesma altura, com ambos parados e nenhum contato físico, a pressão é 0,5. Mantidas essas condições, na fase fácil seriam cerca de 6,70 s para completar a captura após a proteção inicial. Isso pode ser uma regra intencional, mas não corresponde à impressão de “contato”.
- **Não exige caminho livre entre os veículos — leitura do código.** Um obstáculo entre jogador e policial não impede o cálculo de pressão.
- **O indicador visual não representa apenas o tempo acumulado — leitura do código.** Usa o maior valor entre pressão visual suavizada e progresso real; pode transmitir captura mais adiantada do que o acumulador efetivo.

Próxima decisão sugerida: definir se a captura deve exigir contato sustentado ou cerco próximo com caminho livre. Só então ajustar raio, tempo de tolerância, alívio e indicador. Não reduzir indiscriminadamente o raio sem considerar os diferentes tamanhos dos veículos.

Referências: `obterPressaoPolicial`, `atualizarCapturaPorContato`, `atualizarIndicadorContato`.

## 4. Salto das rampas

### Funcionamento atual

O salto é um impulso arcade ao detectar contato com qualquer colisor da rampa, desde que o carro esteja aproximadamente em pé e tenha passado o intervalo de 1,1 s. Usa a frente do carro, não o sentido de saída da rampa. O fator de conforto é 0,78.

### Achados

- **Contato lateral, mesmo parado, pode lançar o carro — confirmado em execução isolada.** Com normal horizontal e velocidade inicial zero, o Clássico recebe 29,64 unidades/s horizontais e 13,65 verticais. Não há exigência de velocidade mínima, normal superior, alinhamento ou passagem pela saída.
- **Pode relançar ao reencontrar a rampa após o intervalo — leitura do código.** Não há estado de entrada/saída para limitar o impulso a uma travessia.
- **Colisão maior que a superfície visível — leitura do código.** A caixa principal mede 14,4 × 5,6 × 20,4, enquanto a malha mede 13,2 × 4,4 × 18,4. O contato pode ocorrer antes de o carro aparentemente tocar a rampa.

Próxima correção sugerida: alinhar a superfície física com a visível; distinguir topo de laterais; lançar somente numa travessia válida da saída, com velocidade e direção coerentes. Preservar o salto arcade se essa for a experiência desejada.

Referências: `criarRampa`, `estaEmRampa` e bloco `cooldownRampa <= 0` no movimento do jogador.

## Validação

- 23 testes automatizados de física, gráficos e limite do mapa passaram.
- Limite exercitado nos quatro lados e quatro cantos, com carro e moto, a 50/60/90 passos por segundo; testadas marcha de retorno, movimento tangente, correção de caixa girada e queda contra parede.
- Testes do jogo real em navegador, com WebGL 1 e 2: limite, impacto em alta velocidade e salto contra parede sem elevação persistente. Obstáculos e polícia desativados somente no cenário de teste isolado.
- Testes de regressão em navegador: movimento, direção, respawn, coleta, pontuação, progressão, sombras, restauração de contexto e falhas de inicialização.
- Menu verificado em 1100×720, 390×844 e 568×320: imagens carregadas, sem rolagem horizontal e botões alcançáveis.
- Na revisão original, `node scripts/analyze-gameplay.mjs` reproduzia os achados sobre as funções daquela versão. O script foi substituído por testes de regressão após as correções.

Limitação: testes de navegador em Edge com renderização de software; não equivalem a uma validação de desempenho em celulares ou placas gráficas físicas.

Ordem sugerida na revisão original, já implementada: salto indevido das rampas; critério/clareza da captura; recuperação de rotas da polícia; colisão contínua e previsão dos tiros.
