# Model Routing and Cost Optimization

Classifique cada solicitação antes de delegar. Use sempre o modelo menos caro capaz de concluir a tarefa corretamente. Não crie um subagente quando o agente atual puder concluir a tarefa de forma mais barata e confiável.

## Papéis disponíveis

- `router` — `gpt-5.6-terra`, low, somente leitura. Classifica solicitações ambíguas e devolve apenas nível, agente e justificativa curta. Para solicitações obviamente simples, normais ou complexas, a conversa principal pode aplicar esta mesma tabela sem iniciar o router.
- `luna-worker` — `gpt-5.6-luna`, low, pode escrever. Executa trabalho local, mecânico, repetitivo e de baixo risco.
- `terra-worker` — `gpt-5.6-terra`, medium, pode escrever. Executa programação normal, mudanças pequenas ou médias, testes e depuração moderada.
- `sol-worker` — `gpt-5.6-sol`, high, pode escrever. Executa mudanças complexas, sistêmicas, em múltiplos módulos, concorrência, segurança e bugs difíceis.
- `astra-planner` — `gpt-6-astra`, medium, somente leitura. Investiga e produz um plano para `sol-worker`; nunca implementa, edita arquivos, corrige lint ou assume tarefas triviais.

## Roteamento

| Nível | Destino | Exemplos |
| --- | --- | --- |
| SIMPLE | `luna-worker` | texto, CSS/HTML simples, valores de configuração, renomeações, referências, boilerplate, scripts pequenos e correções locais evidentes. |
| NORMAL | `terra-worker` | funcionalidade pequena ou média, endpoint simples, refatoração localizada, testes, integração simples e bug moderado. |
| COMPLEX | `sol-worker` | alteração ampla, múltiplos módulos, concorrência, banco de dados, autenticação, segurança, refatoração significativa e bug difícil. |
| ARCHITECTURE / EXTREME | `astra-planner` → `sol-worker` | incerteza arquitetural alta, opções com consequências importantes, diagnóstico especialmente difícil ou mudança difícil de reverter. |

Não use Astra para SIMPLE, NORMAL ou COMPLEX quando Sol puder investigar e implementar eficientemente. Não use Sol quando Terra puder concluir bem. Não use Terra quando Luna for suficiente. Astra deve retornar: problema, hipótese ou causa raiz, arquivos envolvidos, estratégia, sequência, riscos, testes e critérios de conclusão. O Sol executa esse plano sem refazer a investigação completa.

## Economia e fan-out

- Limite a no máximo três subagentes simultâneos e use menos quando possível.
- Só use paralelismo para trabalho independente com ganho real; nunca para agentes que editarão os mesmos arquivos.
- Não repita a mesma investigação em vários modelos sem justificativa concreta.
- Não faça revisão automática por modelo caro após mudanças pequenas.
- Use high somente quando raciocínio extra provavelmente melhorar o resultado; tarefas pequenas devem ler poucos arquivos e carregar pouco contexto.
- Quando já houver plano suficientemente detalhado, o executor deve implementá-lo e validá-lo, sem refazer toda a análise.

## Casos de controle

- “Troque o texto do botão de Salvar para Confirmar.” → `luna-worker`.
- “Crie um endpoint simples para listar usuários.” → `terra-worker`.
- “Investigue um deadlock intermitente envolvendo múltiplos workers.” → `sol-worker`.
- “Migrar um monólito crítico para arquitetura distribuída, sem abordagem definida.” → `astra-planner`, depois `sol-worker`.
