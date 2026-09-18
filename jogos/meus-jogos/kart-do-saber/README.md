# Kart do Saber

Jogo independente de corrida educativa em 3D. Todos os arquivos ficam nesta pasta; os jogos anteriores e o catálogo não foram alterados.

## Abrir e jogar

Com Node.js 20 ou superior instalado, abra um terminal nesta pasta e execute:

```powershell
npm start
```

Acesse **http://127.0.0.1:4180/**. Não é necessário instalar pacotes: o servidor usa recursos nativos do Node e a biblioteca gráfica está incluída em `vendor/`.

Também é possível abrir `jogos/meus-jogos/kart-do-saber/` pelo servidor estático existente do repositório (porta 4173). Nesse caso, apenas o treino funciona. Não abra o HTML por `file://`, pois os módulos precisam de um servidor HTTP.

## Jogar com a turma

1. Inicie o servidor em um computador da escola, liberando o endereço de rede:

   ```powershell
   node server.mjs --host 0.0.0.0 --port 4180
   ```

2. Nesse computador, descubra o IPv4 da rede local (por exemplo, `192.168.1.20`). Nos demais computadores, abra `http://192.168.1.20:4180/`, substituindo pelo endereço real. Todos precisam conseguir alcançar essa porta na rede.
3. Ao abrir o jogo, o aluno escolhe **menino ou menina** e informa seu nome ou apelido. Ao confirmar, **entra automaticamente na fila**, sem sala privada, código ou convite. Jogadores com o mesmo conteúdo são agrupados em corridas de até quatro pessoas. O painel **Aguardando mais jogadores** mostra os nomes conectados, as vagas e a contagem regressiva. Durante a espera, é possível editar o apelido e a cor do kart; mudar de conteúdo procura a fila correspondente. **Trocar piloto** retorna à tela inicial.
4. A largada acontece com quatro pessoas ou após **20 segundos**, quando bots preenchem as vagas. Com 25 alunos chegando à mesma fila dentro desse intervalo, são seis corridas com quatro alunos e uma corrida com um aluno e três bots. Quem chega depois da largada entra na próxima corrida.
5. A turma é identificada automaticamente pela grade semanal: a fila e as perguntas usam o ano da turma no horário atual. Fora de um período registrado, o jogo oferece treino de revisão do 3º ano. A grade considera apenas 1º a 5º ano; CEMEI, AEE e períodos para agendamento não criam partidas.
6. **Treinar com bots** sai da fila e inicia um treino local. Voltar ao início procura uma nova corrida automaticamente.

O servidor precisa permanecer ligado. O botão de jogar online não publica o jogo na internet: para acesso fora da escola, hospede este servidor Node em um serviço com HTTPS e suporte a conexões HTTP persistentes. GitHub Pages sozinho serve o treino, mas não executa as salas. Em um proxy, desative o buffering de `/api/events` e permita conexões persistentes. Não é necessário contratar nada para testar localmente.

## Como jogar

- Segure **↑/W** para acelerar, **←/→** ou **A/D** para virar, e **↓/S** para frear. Continue segurando **↓/S** depois de parar para **dar ré**, com limite de aproximadamente 29 km/h. **↑/W** freia a ré e volta a acelerar para a frente. Soltar o acelerador faz o kart perder velocidade gradualmente. Pressionar acelerador e freio juntos apenas freia. Há controles de toque em dispositivos compatíveis.
- Os karts **colidem e se empurram**, tanto pela traseira quanto pelos lados. Uma batida perto da borda pode provocar uma queda. O retorno à pista tem 1,1 segundo de proteção contra colisões para evitar uma nova batida imediata. As mesmas regras valem no treino e na partida online.
- O personagem escolhido aparece no kart. **Nomes ficam sobre os carros e na classificação durante a corrida**; bots são identificados. A escolha de menino ou menina é independente da cor, então vários alunos podem usar o mesmo tipo de personagem.
- A direção é livre: o kart não acompanha as curvas sozinho. As pistas ficam elevadas acima do chão. Ao sair pela borda, o kart explode em partículas leves, desaparece durante a queda e volta ao centro cerca de 1,55 segundo depois, aproximadamente oito metros antes do ponto da queda, parado, alinhado e temporariamente protegido.
- Há dois circuitos completos: **Ilha das Descobertas**, tropical e ensolarada, e **Cânion Estelar**, rochoso e noturno. Eles alternam automaticamente a cada nova corrida, tanto no treino quanto no servidor da turma.
- Cada corrida tem quatro pilotos, uma volta e oito desafios. As respostas aparecem em **três portais sobre a pista**. A faixa atravessada no instante do portal determina a resposta.
- Acerto: limite de velocidade 28% maior por 2,2 segundos. Erro: limite 26% menor por 1,15 segundo, com a resposta explicada. É preciso continuar acelerando para aproveitar o turbo. Não há perda de pontos já conquistados.
- Até três **foguetes de turbo** podem surgir durante a corrida. Cada foguete é reservado e visível somente para um piloto que esteja pelo menos 12 metros atrás do líder; o líder e os pilotos próximos não conseguem vê-lo nem coletá-lo. Ao pegar, o kart recebe impulso imediato e 16% de velocidade extra por 1,65 segundo.
- **Vence quem cruza a chegada primeiro.** Acertos não participam da classificação, não atribuem posições nem anulam chegadas. Direção, velocidade, frenagem, quedas e ultrapassagens decidem o tempo; o efeito da pergunta é apenas temporário.
- O jogo não freia pelo aluno nem pelos bots ao chegar a uma pergunta. As perguntas aparecem com antecedência; o jogador pode usar o freio para ler e escolher. O botão **♫** usa a voz em português do navegador, quando disponível.
- Bots sorteiam uma resposta para cada desafio, com probabilidade de acerto variável entre 48% e 76%. Um sorteio de erro sempre escolhe uma alternativa incorreta. Eles também têm ritmos de direção diferentes e usam a mesma simulação dos alunos.
- Os conteúdos iniciais são **primeiras letras**, **sílabas iniciais** e **adição/subtração**. As questões e as alternativas variam a cada partida.
- **Esc** pausa o treino. Partidas online continuam enquanto o menu está aberto, e o kart do aluno freia. Ao sair, o piloto vira bot; uma conexão interrompida tem oito segundos de tolerância e pode se recuperar enquanto a sessão existir.
- O resultado mostra posição, tempo e acertos. Os pilotos que não terminarem até 50 segundos após o primeiro são classificados pela distância percorrida e ficam sem tempo de chegada. Há um limite total de cinco minutos por corrida.

## Gráficos e desempenho

- **Automático:** tenta WebGL 2 e recorre a WebGL 1 se necessário.
- **Leve · WebGL 1:** solicita um contexto WebGL 1 real, reduz cenário e resolução, sem antialiasing.
- **Bonito · WebGL 2:** solicita WebGL 2, mais vegetação e nuvens, antialiasing quando disponível e maior resolução. Se WebGL 2 não existir, informa o uso do modo leve.
- Ambos os modos reduzem a resolução se os quadros ficarem lentos. Ter WebGL 2 não é tratado como garantia de uma placa potente.
- O cenário é agrupado em poucas malhas; a pista e os pilotos usam poucos polígonos. Floreiras e placas laterais têm bases presas à pista, as nuvens ficam no horizonte e foguetes e rampas usam geometrias simples. As sombras são simples discos, sem sombras dinâmicas, pós-processamento, motor de física ou texturas grandes.
- A renderização mira 60 quadros por segundo durante a corrida e limita o menu a 30. Isso é uma meta, **não uma medição de desempenho nos computadores da escola**. Validar em pelo menos um computador antigo real continua necessário.
- A biblioteca Three.js **r162** foi escolhida porque suporta os dois contextos com a mesma implementação. A partir de r163, o renderizador oficial deixou de suportar WebGL 1. Não atualize a biblioteca sem preservar a versão compatível. Fonte: https://threejs.org/docs/pages/WebGLRenderer.html
- Todos os recursos visuais são locais. A disponibilidade e o funcionamento offline da leitura em voz alta dependem do navegador e das vozes instaladas.

O console do navegador permite consultar `window.kartDoSaber` para ver modo gráfico, triângulos, chamadas de desenho e resumo da corrida. O canvas também fornece `data-webgl`, `data-triangles`, `data-draw-calls` e `data-pixel-ratio` para diagnóstico.

## Arquitetura

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html`, `style.css` | Menu, desafios, controles e resultado |
| `js/app.mjs` | Interface, entrada, áudio, treino e cliente de rede |
| `js/core.mjs` | Regras de corrida, bots, pontuação e classificação |
| `js/track.mjs` | Traçado e altura compartilhados; projeção dos karts na pista |
| `js/questions.mjs` | Conteúdo educativo e sorteio reproduzível |
| `js/renderer.mjs` | Ilha, Cânion, pistas, explosão, pilotos, portais, câmera e WebGL 1/2 |
| `server.mjs` | Salas, sessões e simulação autoritativa |
| `vendor/` | Three.js r162 e sua licença MIT |
| `tests/` | Testes de regras, compatibilidade e partidas de rede |

Na rede, o servidor atualiza a corrida 30 vezes por segundo, subdividindo a física em passos de no máximo 1/60 segundo para detectar colisões, e envia estados a aproximadamente 15 Hz por Server-Sent Events. O navegador envia apenas direção, acelerador e freio por HTTP, com reaproveitamento de conexão; não pode definir velocidade, acertos, distância ou chegada. O freio de pausa para sem engatar ré. As posições são suavizadas na renderização. Essa implementação foi pensada para a rede local da escola; a sensação de direção em conexões de internet de alta latência ainda precisa de avaliação. O teste de 25 clientes verifica agrupamento e mensagens, não substitui medir 25 computadores e sua rede reais.

Salas, nomes e personagens ficam somente na memória do servidor. O navegador guarda o último apelido, personagem e preferências localmente; em computadores compartilhados, o próximo aluno deve conferir o nome na tela inicial. Não há contas, anúncios, chat, cadastro de dados pessoais nem serviços de análise. Recarregar a página inicia uma nova sessão; não existe retomada após recarregamento ou reinício do servidor. A reconexão automática cobre interrupções breves na conexão da página aberta.

## Testes

```powershell
npm test
```

Os testes cobrem perguntas, faixas de resposta, turbo/penalidade, foguetes individuais de recuperação, exclusão do líder, rampas e reaparecimento, variação dos bots, chegada independente de acertos, aceleração manual, frenagem, ré, colisões frontais e laterais, transferência de velocidade, empurrões nas bordas, quedas, retorno seguro, escolha dos contextos, isolamento dos arquivos, 25 clientes simultâneos, fila automática, preenchimento com bots, nomes e personagens na rede e validação dos comandos. A validação visual deve incluir os dois modos e os dois circuitos em um navegador real.

## Escopo desta primeira versão

É uma versão jogável com aceleração e direção manuais, ré, colisões entre karts, pista elevada, quedas, foguetes de recuperação, rampas, dois circuitos alternados, personagens masculino e feminino e quatro cores de kart. Ainda não há itens de ataque, drift ou saltos comandados fora das rampas ou editor de questões. A prioridade é escolher respostas durante uma corrida que também exige pilotagem. As imagens fornecidas foram usadas como referência de conceito, sem copiar personagens ou tratar seus textos como instruções.
