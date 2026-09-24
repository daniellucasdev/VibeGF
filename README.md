# Kokoro ♡ (心, "coração")

Web app em React onde você conversa por chat com **Hana Mizuki**, uma garota de anime desenhada em ASCII. Ela tem sentimentos que mudam a cada mensagem, e a relação evolui devagar — de desconhecidos até namorados — como num anime slice-of-life de romance. Visual kawaii: pastel, brilhos, corações e janelas no estilo de um "sistema operacional fofo" dos anos 2000.

> A regra de ouro: o LLM **interpreta** a Hana e **sugere** como os sentimentos mudaram; o **código** decide os números, os limites, os estágios e os eventos. O modelo nunca decide sozinho em que ponto da relação vocês estão.

## Instalação

```bash
npm install
cp .env.example .env   # edite com sua chave
npm run dev            # front em http://localhost:5173, servidor em :8787
```

Produção local: `npm run build && npm start` (o Express serve o `dist/` e a API).

### `.env`

```
ANTHROPIC_API_KEY=sk-ant-...   # console.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-5
HANA_EFFORT=low                # low | medium | high
MOCK_LLM=false                 # true = respostas falsas, sem gastar API
PORT=8787
```

### Sem chave? Modo mock

`MOCK_LLM=true` (ou sem a variável) roda o app **inteiro** com respostas falsas variadas por estágio — perfeito para desenvolver a UI sem custo. O [deploy público](https://daniellucasdev.github.io/VibeGF/) usa exatamente esse modo: nenhuma chave vai para o bundle.

> **Nota sobre workspaces:** se sua org do Anthropic tiver múltiplos workspaces, crie a chave já com o workspace selecionado no console (chaves não-scoped recebem erro 400 pedindo `anthropic-workspace-id`).

## Custos

O modelo padrão é o `claude-sonnet-5`. O texto fixo da personagem (~2,3k tokens) fica em cache (`cache_control: ephemeral`), então a partir da 2ª mensagem você paga só os tokens novas + resposta — na prática, centavos por dia de conversa. Para gastar menos, `claude-haiku-4-5` também funciona (sem `effort`). A partir da 2ª mensagem, o painel de debug mostra `cache_read_input_tokens > 0`.

## Debug

`?debug=1` na URL ou **Ctrl+Shift+D**:

- palco da Hana (forçar emoção/intensidade/falar/olhar);
- **galeria com as 13 expressões** (falar, piscar, olhar, partículas), dia e noite;
- viagem no tempo (+1 h, +1 dia, relógio fixo) — toda a lógica usa o `now()` central;
- sliders dos sentimentos, seletor de estágio e estado da declaração;
- forçar toast de estágio e cena de declaração;
- último JSON bruto da resposta (com `usage`).

## Testes

```bash
npm test   # Vitest: lógica pura, motor do chat, servidor e ASCII
```

## Arquitetura em uma linha por pasta

- `shared/` — tipos, schema Zod + JSON Schema, estágios e rotina da Hana (front + servidor)
- `server/` — Express stateless: guarda a chave, monta prompts (persona fixa cacheável + bloco AGORA dinâmico), chama o Claude com saída estruturada, valida, retry e turno reserva
- `src/game/` — lógica pura: `applyTurn` (clamp, anti-grind, teto diário), humor, declaração, tempo
- `src/ascii/` — arte tokenizada, expressões, render com máscara de cores
- `src/chat/` — motor da conversa: debounce, visto/digitando, balões, retorno e silêncio
- `src/components/` — UI kawaii completa

## Decisões

(além das anotadas pelas fases anteriores)

- **Chave da API e workspaces:** ver nota acima.
- **Turno proativo sem ganhos:** quando ela puxa assunto sozinha (retorno/silêncio), deltas e memórias são zerados — o usuário não contou nada (decisão da fase 2, aplicada na 6).
- **Deploy público em mock:** o GitHub Pages não tem backend; o site público roda com `MOCK_LLM=true` embutido (a UI avisa). Para conversar com o Claude de verdade, rode localmente com sua chave.
- **ASCII — espaços sem cor:** a máscara de cores (seção 7.3) é calculada para todo caractere, mas na renderização os espaços em branco viram texto puro, sem `<span>`. Assim o ahoge (linhas 0–1) balança só o fio de cabelo, e o clique de "carinho na cabeça" só dispara sobre o cabelo desenhado.
- **ASCII — ahoge:** cada trecho do ahoge é um `inline-block` que gira ±6° com `transform-origin` na base.
- **Anti-grind multi-mensagem:** com várias mensagens no mesmo turno, os ganhos só são cortados se **todas** forem repetidas.
- **`made_up` sem briga** em aberto é ignorado; um segundo `fight` com briga em aberto também.
- **Requisitos do estágio 5 caem** (ela fica distante): a declaração volta de `open` para `locked`.
- **Limite de 500 caracteres** contado em `.length` (igual ao servidor) para o corte no cliente — emoji a mais não vira 400 no servidor.
