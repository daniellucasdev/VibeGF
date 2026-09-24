# Kokoro ♡ — namorada virtual anime em ASCII

Kokoro ♡ (心, "coração") é um web app em React onde você conversa por chat com **Hana**, uma garota de anime desenhada em ASCII. Ela tem sentimentos que mudam a cada mensagem, e a relação evolui devagar, de desconhecidos até namorados, como num anime slice-of-life de romance.

## Como rodar

1. Instale as dependências: `npm install`
2. Copie o `.env.example` para `.env` e configure sua chave da Anthropic (console.anthropic.com)
3. Rode `npm run dev` — front em http://localhost:5173, servidor em http://localhost:8787 (os dois sobem juntos com `concurrently`; o Vite faz proxy de `/api` para o servidor)

> **Sem chave?** Coloque `MOCK_LLM=true` no `.env`: o app inteiro roda com respostas falsas, sem gastar nada. O deploy público (GitHub Pages) usa exatamente esse modo, então nenhum segredo vai para o bundle.

## Modo mock (`MOCK_LLM=true`)

O servidor devolve turnos falsos, mas válidos no mesmo schema do Claude: cerca de 20 falas por estágio, emoções variadas, deltas de +1 a +3 e eventos ocasionais. Ele também reage a declarações ("te amo", "gosto de você"), a pedidos de desculpa com uma briga em aberto e ao estado da declaração, para dar pra testar a UI inteira sem chave e sem custo. `MOCK_DELAY_MS` (padrão 600) simula a latência. `/api/summarize` no mock só acrescenta uma linha ao resumo anterior.

Rotas: `POST /api/chat`, `POST /api/summarize` e `GET /api/health` (`{ ok, mock, model }`). O body é validado com Zod (mensagem do usuário até 500 caracteres, histórico até 40 itens) e há um rate limit de 20 requisições por minuto por IP.

## Implementação

Abra o Claude Code nesta pasta e digite algo como "Leia o PROMPT.md e implemente a fase 1". Ele segue o plano em 7 fases (seção 12 do PROMPT.md), terminando cada fase com testes verdes e um commit.

## Deploy

- **Local (produção):** `npm run build && npm start` — o Express serve o `dist/` e a API com sua chave do `.env`.
- **GitHub Pages:** deploy automático via Actions a cada push (modo mock — sem chave, sem custo).

## Debug

Abra com `?debug=1` na URL ou `Ctrl+Shift+D`. O painel tem:

- **Palco:** força uma emoção, a intensidade, a boca falando e o olhar pro chat por cima do humor real ("(humor real)" devolve o controle para o jogo).
- **Ajustes provisórios:** tema (auto/dia/noite), "ler pensamentos 💭", "mostrar números" e "↺ recomeçar do zero" (apaga o save e volta ao onboarding). Esses ajustes vão para a janela ⚙️ na fase 7.
- **Último turno:** o JSON que o servidor devolveu (com `usage` em desenvolvimento).
- **Galeria** com as 13 expressões lado a lado, com opções de falar, piscar, olhar pro chat e partículas.

Clique no cabelo da Hana para fazer carinho na cabeça ♡. O botão 📒 no header abre "O que a Hana lembra de você ✎", onde dá pra apagar cada memória.

## Decisões

- **Chave da API e workspaces:** a chamada real exige uma chave scoped a um workspace no console.anthropic.com (a API pede `anthropic-workspace-id` para chaves não-scoped). Com uma chave comum, tudo funciona; com uma chave de org multi-workspace, crie a chave já selecionando o workspace.

- **ASCII — espaços sem cor:** a máscara de cores (seção 7.3) é calculada para todo caractere, mas na renderização os espaços em branco viram texto puro, sem `<span>`. Assim o ahoge (linhas 0–1) balança só o fio de cabelo, e o clique de "carinho na cabeça" só dispara sobre o cabelo desenhado.
- **ASCII — ahoge:** cada trecho do ahoge é um `inline-block` que gira ±6° com `transform-origin` na base.
- **Tema na fase 1:** o tema é automático pelo horário (noite das 19h às 6h). O seletor dia/noite está provisoriamente no DebugPanel, para conferir a galeria nos dois temas; o ajuste definitivo entra nos Ajustes (fase 7).
- **Header:** os botões 📒 📸 ⚙️ 🔊 já aparecem, mas ficam marcados como "em breve" até as fases que os implementam.
- **Servidor na fase 3:** só existe o mock. `MOCK_LLM` ausente vale `true`, e `MOCK_LLM=false` ainda cai no mock com um aviso no log, porque o Claude de verdade (`server/claude.ts`) entra na fase 5. O `.env` é lido com `process.loadEnvFile()` do Node (sem `dotenv`) e é opcional.
- **Validação do request:** o limite de 500 caracteres vale para mensagens do usuário. Falas da Hana (até 3 balões de 400) e cenas aceitam até 1300. Também há limites para nome, memórias (60 × 200), resumo (2000), fuso (IANA válido) e datas (ISO).
- **Rate limit:** janela fixa de 1 minuto em memória, sem dependência, aplicado a `/api/chat` e `/api/summarize` (o `/api/health` fica de fora). Responde 429 com `Retry-After`.
- **App separado do `listen`:** `server/app.ts` monta o Express (`createApp`) e `server/index.ts` só lê o ambiente e sobe a porta, para os testes rodarem o app numa porta livre. `npm start` já serve o `dist/` com fallback para o `index.html`.
- **`usage` no mock:** em desenvolvimento a resposta traz `usage` zerado e `mock: true`, para o painel de debug já ter onde mostrar.
- **Listas fechadas em `shared/types.ts`:** `EMOTIONS`, `REACTIONS` e `EVENTS` ficam em `types.ts` (sem depender do Zod) e são reexportadas por `schema.ts`. Um teste garante que as 13 emoções batem com as expressões ASCII, e uma checagem de tipo garante que o Zod e o tipo `HanaTurn` não divergem.
- **Fuso horário:** `shared/dailyLife.ts` tem `localParts(date, timeZone?)`. Sem fuso, usa o do navegador; com fuso (IANA), usa `Intl`. Assim o servidor calcula horário, rotina e data local com o `timeZone` do cliente.
- **Anti-grind com várias mensagens:** o debounce junta várias mensagens num turno. O turno conta como repetição se **todas** repetem uma das últimas 10 (inclusive as anteriores do mesmo turno). "Curta" é o texto do turno inteiro com menos de 3 caracteres. Em `greet_return` e `idle_nudge` não há mensagem do usuário, então nenhum ganho positivo é aplicado.
- **Teto diário:** conta o que foi de fato ganho (depois do clamp em 0–100 e do teto de doki-doki). Perdas no mesmo dia não liberam mais ganho.
- **Eventos validados:** `made_up` sem briga em aberto é ignorado, e `fight` com uma briga já em aberto também (o motivo original fica). `confession_declined` vale em `locked`, `open` e `cooldown`; `confession_rejected` só em `she_confessed`.
- **Declaração:** se os requisitos do estágio 5 deixarem de valer (por exemplo, a afeição caiu), `open` volta para `locked`. Humores forçados (`shy` ao pedir tempo, `sad` ao ser recusada) têm intensidade mínima de 0,5.
- **Humor-base:** o PROMPT.md dá a intensidade só para `pouty` (0,4) e `happy` (0,3). Usei 0,5 para `sleepy` e 0,3 para `neutral`.
- **Dias conversados:** o save guarda `daysTalked` (as datas) e a contagem só do dia corrente.
- **Zod:** v4 (`zod@4`). `z.number().int()` e `z.enum([...])` funcionam como no PROMPT.md.
- **Store (fase 4):** zustand 5 com `createStore` + `persist` em `src/store/useGame.ts` (hook `useGame(selector)`), chave `kokoro-save`, `version: 1`. O que é passageiro ("digitando…", boca falando, erro, cena de abertura, "+N" das barras, último JSON) mora num segundo store sem persistência (`useChatUi.ts`), para não regravar o localStorage a cada tecla.
- **Save validado campo a campo:** além do `migrate` (qualquer versão diferente de 1), um `merge` próprio passa o que vem do disco por schemas Zod campo a campo (`src/store/save.ts`). Um pedaço estragado vira o padrão daquele campo, sem apagar o resto; mensagens, memórias e marcos inválidos são descartados um a um. O storage do persist tem try/catch na leitura (JSON estragado → começa do zero) e na escrita (cota cheia → aviso no console).
- **Ids:** mensagens, memórias e marcos compartilham um contador crescente (`nextId`). `summarizedUpTo` guarda o id da última mensagem resumida, não um índice, porque o teto de 400 descarta as mais antigas.
- **Um balão = uma mensagem:** cada balão guarda a emoção daquele momento (kaomoji do avatar). O `thought` do turno fica no último balão (ThoughtCloud). O avatar aparece no primeiro balão do grupo e quando a emoção muda. "✓ enviado / ✓✓ visto" aparece na última bolha de cada grupo do usuário.
- **Quando o turno é aplicado:** `applyTurn`, memórias, reação e marcos entram junto com o primeiro balão (é quando a expressão muda e as barras animam); os outros balões entram um a um. Se a página fechar no meio, o `pagehide` mostra na hora os balões que faltam, para o save não perdê-los. O "digitando…" do primeiro balão desconta o tempo que já ficou na tela esperando a API.
- **Boca falando:** do primeiro balão até um pouco depois do último (`min(1500, 300 + 25 × caracteres)` ms).
- **Erro:** nunca há nova tentativa automática. O balão de erro tem "↻ tentar de novo", e uma mensagem nova também leva junto as que falharam. Se a chamada falha antes do tempo de leitura, a mensagem fica em "✓ enviado". Mensagens do usuário que ficaram sem resposta (página fechada antes da resposta) são respondidas uma única vez na próxima carga.
- **Cena de abertura:** a legenda "[Uma notificação de um número desconhecido…]" fica salva como mensagem `scene` no topo da conversa (o servidor a transforma em narração entre colchetes). Se a página recarregar no meio da cena, ela recomeça do zero. O primeiro balão vira o marco `first_message` do álbum.
- **Marcos:** `first_message`, `stage_up` e os eventos aceitos pelo código já são registrados no save; os toasts, a `ConfessionScene` e o álbum entram na fase 6.
- **"[3 horas depois]" na lista:** calculado na hora de desenhar, com a mesma regra do servidor (`sceneGapMarker`), e nunca colado numa cena salva. O `DaySeparator` usa `Intl` em pt-BR ("quinta-feira, 24 de setembro").
- **Limites de texto:** `cutChars` corta pela mesma conta do `z.string().max()` do servidor (unidades de `.length`) sem partir emoji, para um texto cheio de emoji nunca virar erro 400. Os tempos de digitação contam caracteres de verdade (code points).
- **Contraste:** o gradiente das bolhas do usuário foi escurecido (`#C93D82 → #7A52CC`) para o texto branco passar de 4,5:1 nas duas pontas. Texto secundário pequeno usa `--ink-muted` (`#75567B` de dia), porque `--ink-soft` sobre `--surface-2` dá 4,37:1.
- **CSS fora de `@layer`:** `.kawaii-window` define `position: relative` fora de camada e por isso vence os utilitários do Tailwind; o `KaomojiPicker` (que precisa de `absolute`) tem estilo próprio.
- **Bundle:** o Zod também roda no cliente (validar o save e a resposta da API), então `react`, `motion` e `zod` saem em chunks próprios e nenhum passa de 500 kB. O coração de enviar é o `Heart` do `lucide-react`.
- **Onboarding:** o tratamento sugerido acompanha o pronome (ele → -kun, ela → -chan, elu → só o nome) até o usuário escolher um.

## Personalização

Nome do app, personagem, cenário e ritmo ficam na seção 0 do PROMPT.md.
