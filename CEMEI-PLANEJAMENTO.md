# CEMEI: organização do catálogo

Atualizado em 26/11/2026.

## Regras implementadas

- A turma é determinada exclusivamente pelo dia e horário, em America/Sao_Paulo. Não há controles, parâmetros de URL ou preferência salva para trocar turma/trimestre.
- O trimestre é cumulativo: 1 libera a etapa 1; 2 libera 1 e 2; 3 libera 1, 2 e 3, respeitando a turma e a revisão do conteúdo. São sorteados até 15 jogos entre os elegíveis. O sorteio é renovado ao abrir ou voltar à página; a conferência periódica de horário mantém a seleção enquanto turma e trimestre não mudam.
- Integral recebe a interseção dos jogos liberados para Pré 4 e Pré 5. Fora de aula aparece a interseção visual, sem jogos de letras.
- A página aberta atualiza o catálogo a cada 30 segundos e ao retornar à aba/página. Os cartões originais são preservados para uma troca de turma não perder jogos.
- Horários em cemei-config.js: segunda 13:50–14:40 Pré 5; quinta 07:00–07:50 Pré 4, 07:50–08:40 integral, 09:45–10:35 Pré 5, 13:00–13:50 Pré 5, 13:50–14:40 Pré 4, 15:15–15:58 Pré 4. Início inclusivo; término exclusivo.
- Período letivo: fevereiro a dezembro; janeiro não libera jogos. Divisão centralizada em cemei-config.js: 1º de fevereiro a maio, 2º de junho a agosto e 3º de setembro a dezembro. O calendário se repete anualmente; ajustar caso a escola adote limites específicos.

## Critérios de seleção

Priorizar pareamento visual, memória de imagens, encaixes, formas, quantidades e sequências. Palavras redundantes na tela não impedem a inclusão se a figura ou o áudio permitem resolver a atividade. Reconhecer uma vogal no 3º trimestre é o objetivo do jogo, e não uma exigência de leitura de instruções. Evitar perguntas que mudam de sentido apenas por texto, palavras como únicas respostas e grupos identificados apenas por rótulos escritos. A demonstração inicial pelo adulto continua útil para aprender a clicar, arrastar e iniciar a partida.

As miniaturas oficiais e descrições públicas do acervo Wordwall foram conferidas; os cinco primeiros novos jogos também tiveram início de partida conferido no navegador, com respostas/arrastes de amostra. A incorporação local e o retorno ao catálogo foram conferidos no Microsoft Edge com Sombras do Corpo. Não equivale a concluir todas as rodadas de todos os jogos antigos. A classificação dos jogos externos já existentes é inicial e considera o formato visual; avaliar em sala o tamanho da rodada e o apoio necessário. Os provedores podem alterar conteúdo/disponibilidade.

## Pesquisa Wordwall

| Jogo | Fonte | Decisão |
| --- | --- | --- |
| Memória das Cores | https://wordwall.net/pt/resource/22107984 | Incluído; pares de cartões coloridos. |
| Combine as Cores | https://wordwall.net/pt/resource/5754663 | Incluído; tocar na cor correspondente à figura. |
| Separe pelas Cores | https://wordwall.net/pt/resource/93248153 | Incluído; grupos identificados por lápis coloridos; 24 peças, etapa 2. |
| Sombras do Corpo | https://wordwall.net/pt/resource/3462286 | Incluído; quatro questões com figura e duas sombras. |
| Complete a Sequência | https://wordwall.net/pt/resource/29263183 | Incluído; cinco questões de padrões ilustrados. |
| Grande e pequeno | https://wordwall.net/pt/resource/15461226 | Não incluído; o comando alterna maior/menor por texto, sem pista visual suficiente. |
| Sequência de imagens | https://wordwall.net/pt/resource/2077588 | Não incluído; grupos identificados apenas por rótulos escritos. |

Os novos embeds usam os GUIDs e miniaturas oficiais das respectivas páginas, com os mesmos atributos de sandbox do projeto. index.html e 5ano.html mantêm suas regras de seleção.

## Classificação por turma

Número = primeiro trimestre em que o jogo fica disponível, mantendo-se nos seguintes. “—” = fora do acervo da turma. “Pendente” não aparece em nenhuma turma; o arquivo foi preservado.

| Arquivo em jogos/cemei | Jogo | Pré 4 | Pré 5 | Revisão | Habilidade |
| --- | --- | --- | --- | --- | --- |
| jogoDaMemoria.html | Memória: Sítio do Seu Lobato | 1 | 1 | Inicial | memoria |
| letra_inicial.html | Aperte na Inicial | — | 3 | Pendente | letras |
| jogo_memoria.html | Memória: Animais | 1 | 1 | Inicial | memoria |
| alfabeto.html | Alfabeto | — | 3 | Pendente | letras |
| jogoDaMemoria2.html | Memória: Super-heróis | 2 | 1 | Inicial | memoria |
| jogoDasSombras.html | Sombras: Animais Marinhos | 1 | 1 | Inicial | sombras |
| quebraCabeca.html | Quebra-Cabeça: Animais | 2 | 1 | Inicial | encaixe |
| AEIOU.html | Jogo das Vogais | — | 3 | Pendente | letras |
| animaisEFormas.html | Animais e Formas | 1 | 1 | Inicial | formas |
| quebra_cabeca.html | Quebra-Cabeça: Animais Marinhos | 2 | 1 | Inicial | encaixe |
| encaixaNaCaixa.html | Encaixa na Caixa | 1 | 1 | Inicial | encaixe |
| cincoErros.html | Cinco Erros | 2 | 2 | Inicial | atencao |
| quebraCabecaMaternal.html | Quebra-Cabeça Maternal | 1 | 1 | Inicial | encaixe |
| jogoDaVelha.html | Jogo da Velha | 3 | 2 | Inicial | logica |
| cores2.html | Cores dos Objetos | 1 | 1 | Inicial | cores |
| cores3.html | Cores do Dia a Dia | 2 | 1 | Inicial | cores |
| sombras.html | Sombras | 2 | 1 | Inicial | sombras |
| sombrasPokemon.html | Sombras Pokémon | 2 | 2 | Inicial | sombras |
| sombras2.html | Sombras 2 | 2 | 1 | Inicial | sombras |
| sombrasPrimavera.html | Sombras da Primavera | 2 | 2 | Inicial | sombras |
| formasGeometricas.html | Formas Geométricas | 1 | 1 | Inicial | formas |
| jogoFormasGeometricas.html | Jogo das Formas Geométricas | 2 | 2 | Inicial | formas |
| memoriaAnimaisFazenda.html | Memória: Animais da Fazenda | 2 | 1 | Inicial | memoria |
| animaisFazenda.html | Animais da Fazenda | 2 | 1 | Inicial | memoria |
| memoriaInfantil.html | Jogo da Memória Infantil | 1 | 1 | Inicial | memoria |
| memoriaEmojis.html | Jogo da Memória Emojis | 3 | 2 | Inicial | memoria |
| numerosAte10.html | Números até 10 | 3 | 2 | Inicial | quantidades |
| numerosAte5.html | Números até 5 | 2 | 1 | Inicial | quantidades |
| folclore.html | Folclore | 2 | 2 | Inicial | memoria |
| partesDoCorpo.html | Partes do Corpo | 2 | 1 | Inicial | memoria |
| memoriaDinossauro.html | Memória Dinossauro | 3 | 2 | Inicial | memoria |
| vocabularioAnimaisFazenda.html | Vocabulário: Animais da Fazenda | 2 | 1 | Inicial | associacao |
| animaisAssociacao.html | Animais: Associação | 2 | 1 | Inicial | associacao |
| memoriaAnimaisFazenda2.html | Memória: Animais da Fazenda 2 | 2 | 1 | Inicial | memoria |
| vogaisLetraInicial.html | Vogais: Letra Inicial | — | 3 | Inicial | letras |
| vogaisInicialImagem.html | Vogais: Letra Inicial e Imagem | 3 | 3 | Inicial | letras |
| vogaisSomInicial.html | Vogais: Som Inicial | 3 | 3 | Inicial | letras |
| letraInicial.html | Letra Inicial | — | 3 | Inicial | letras |
| letraInicialImagem.html | Letra Inicial: Imagens | — | 3 | Inicial | letras |
| qualVogalInicial.html | Qual é a Vogal Inicial? | — | 3 | Inicial | letras |
| letraInicialVogais.html | Letra Inicial: Vogais | — | 3 | Inicial | letras |
| vogalInicialDuasOpcoes.html | Vogal Inicial: Duas Opções | 3 | 3 | Inicial | letras |
| aVogalInicialE.html | A Vogal Inicial é... | — | 3 | Inicial | letras |
| vogaisComSom.html | Vogais com Som | 3 | 3 | Inicial | letras |
| vogaisSomLetraInicial.html | Vogais: Som e Letra Inicial | — | 3 | Inicial | letras |
| vogaisInicial42.html | Vogais: 42 Questões | — | 3 | Inicial | letras |
| escolhaVogalInicial.html | Escolha a Vogal Inicial | — | 3 | Inicial | letras |
| vogaisIniciaisAviao.html | Vogais Iniciais: Avião | — | 3 | Inicial | letras |
| letraInicialVogaisGameShow.html | Letra Inicial Vogais: Game Show | — | 3 | Pendente | letras |
| letraInicialVogaisOvelha.html | Letra Inicial: Vogais | — | 3 | Inicial | letras |
| letraInicialVogaisSelva.html | Letra Inicial (Vogais) | — | 3 | Inicial | letras |
| letraInicialVogaisIglu.html | Letra Inicial das Vogais | — | 3 | Inicial | letras |
| qualAVogalAranha.html | Qual a Vogal? | — | 3 | Inicial | letras |
| letraInicialFiguraVogais.html | Letra Inicial da Figura | — | 3 | Pendente | letras |
| vogalInicialIndio.html | Vogal Inicial: Cursiva | — | 3 | Pendente | letras |
| vogalInicialObjetos.html | Vogal Inicial: Objetos | — | 3 | Inicial | letras |
| qualVogalInicialOlho.html | Qual a Vogal Inicial? | — | 3 | Inicial | letras |
| memoriaCores.html | Memória das Cores | 2 | 1 | Inicial | memoria |
| relacioneCores.html | Combine as Cores | 1 | 1 | Inicial | cores |
| classificandoCores.html | Separe pelas Cores | 2 | 2 | Inicial | cores |
| sombrasCorpo.html | Sombras do Corpo | 1 | 1 | Inicial | sombras |
| sequenciaImagens.html | Complete a Sequência | 3 | 2 | Inicial | sequencias |

## Conteúdo preservado fora da seleção automática

- alfabeto.html: ordenação do alfabeto completo.
- letra_inicial.html: aguarda revisão interativa do provedor externo.
- AEIOU.html: aguarda revisão interativa do provedor externo.
- letraInicialFiguraVogais.html: mistura leitura de palavras, contagem de letras e ordem alfabética.
- letraInicialVogaisGameShow.html: rodadas extensas com tempo e ajudas escritas.
- vogalInicialIndio.html: cursiva e identificação da figura precisam de revisão.

Os três cartões que já estavam comentados (memórias de futebol e sombras em labirinto) continuam desativados.

## Ampliação solicitada: mais 20 jogos

Os 20 abaixo somam-se aos cinco primeiros (25 inclusões no total). Miniaturas oficiais e conteúdo público conferidos; não são apenas trocas de tema do mesmo GUID. Texto redundante no cartão não exige leitura quando os dois cartões podem ser comparados pelas figuras. Memórias de 36–40 peças entram somente no terceiro trimestre; podem exigir acompanhamento e mais de uma rodada de aula.

| Arquivo em jogos/cemei | Jogo | Pré 4 | Pré 5 | Modelo | Fonte pública |
| --- | --- | --- | --- | --- | --- |
| memoriaFrutas.html | Memória: Frutas | 2 | 1 | 25 | https://wordwall.net/pt/resource/35293143 |
| memoriaHorta.html | Memória: Frutas e Vegetais | 2 | 2 | 25 | https://wordwall.net/pt/resource/78602788 |
| memoriaAlimentos.html | Memória: Alimentos | 3 | 3 | 25 | https://wordwall.net/pt/resource/33517269 |
| memoriaMar.html | Memória: Animais do Mar | 3 | 3 | 25 | https://wordwall.net/pt/resource/14716660 |
| memoriaTransito.html | Memória: Trânsito | 2 | 1 | 25 | https://wordwall.net/pt/resource/22071924 |
| memoriaSustentabilidade.html | Memória: Cuidar do Planeta | 3 | 3 | 25 | https://wordwall.net/pt/resource/24730216 |
| memoriaEsportes.html | Memória: Esportes | 3 | 2 | 25 | https://wordwall.net/pt/resource/5794690 |
| memoriaProfissoes.html | Memória: Profissões | 3 | 2 | 25 | https://wordwall.net/pt/resource/13019424 |
| memoriaOlimpiadas.html | Memória: Olimpíadas | 3 | 2 | 25 | https://wordwall.net/pt/resource/19711342 |
| memoriaBrinquedos.html | Memória: Brinquedos | 2 | 1 | 25 | https://wordwall.net/pt/resource/58984400 |
| memoriaFormas.html | Memória: Formas | 1 | 1 | 25 | https://wordwall.net/pt/resource/14308039 |
| ligueNumeros.html | Ligue os Números até 5 | 2 | 1 | 22 | https://wordwall.net/pt/resource/3547875 |
| conteBolinhas.html | Conte as Bolinhas | 3 | 2 | 3 | https://wordwall.net/pt/resource/3555591 |
| conteAnimais.html | Conte os Animais | 3 | 2 | 3 | https://wordwall.net/pt/resource/13541261 |
| memoriaQuantidades.html | Memória: Números e Bolas | 3 | 2 | 25 | https://wordwall.net/pt/resource/30412796 |
| sombrasCarros.html | Sombras: Carros | 1 | 1 | 5 | https://wordwall.net/pt/resource/4017212 |
| sombrasFrutas.html | Sombras: Frutas | 1 | 1 | 5 | https://wordwall.net/pt/resource/3586087 |
| sombrasPalhacos.html | Sombras: Palhaços | 3 | 2 | 46 | https://wordwall.net/pt/resource/9944991 |
| sombrasTransportes.html | Sombras: Transportes | 2 | 1 | 5 | https://wordwall.net/pt/resource/3221487 |
| sombrasVerao.html | Sombras: Verão | 2 | 2 | 46 | https://wordwall.net/pt/resource/4369067 |

Outros candidatos descartados nesta ampliação: placas de trânsito (59881615) pareia texto com placa; classificação de formas (3555124) tem grupos apenas escritos; quiz de formas (14318499) exige ler qual forma procurar; verdadeiro/falso (18948958) exige ler o nome da forma; quantidades até 20 (21662290) excede a faixa adotada nesta proposta; percepção de sombras (16745663) repete as mesmas figuras de palhaços do recurso 9944991 e não conta como um jogo novo.

## Validação da implementação

- 10 testes passaram em `node --test --test-isolation=none tests/cemei.test.mjs tests/cemei-acervo.test.mjs`: limites de todos os horários, fuso, janeiro, trimestres cumulativos, interseção, retorno, metadados, 25 inclusões e regressão do catálogo não-CEMEI.
- `node scripts/check.mjs`: 165 arquivos com sintaxe e referências locais válidas.
- Os 20 embeds adicionais responderam com os IDs públicos esperados e sem indicador de erro do Wordwall.
- Catálogo final conferido no navegador: sem controles manuais e sem transbordamento horizontal; fora de aula no terceiro trimestre havia 56 jogos visuais comuns elegíveis. A revisão posterior limita a exibição a 15 sorteados desse acervo.
- Partidas conferidas por amostragem, incluindo memória de frutas. Nem todas as rodadas dos 25 jogos foram concluídas.

## Ajuste de apresentação e sorteio

Título e aviso de turma/trimestre removidos a pedido do usuário. A página exibe apenas os cartões. O limite de 15 é aplicado depois dos filtros de turma, revisão e trimestre cumulativo. O acervo completo continua disponível para os sorteios seguintes; os outros catálogos mantêm seu comportamento anterior.
