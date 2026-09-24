# Kokoro ♡ — namorada virtual anime em ASCII

Kokoro ♡ (心, "coração") é um web app em React onde você conversa por chat com **Hana**, uma garota de anime desenhada em ASCII. Ela tem sentimentos que mudam a cada mensagem, e a relação evolui devagar, de desconhecidos até namorados, como num anime slice-of-life de romance.

## Como rodar

1. Instale as dependências: `npm install`
2. Copie o `.env.example` para `.env` e configure sua chave da Anthropic (console.anthropic.com)
3. Rode `npm run dev` — front em http://localhost:5173, servidor em http://localhost:8787

> **Sem chave?** Coloque `MOCK_LLM=true` no `.env`: o app inteiro roda com respostas falsas, sem gastar nada. O deploy público (GitHub Pages) usa exatamente esse modo, então nenhum segredo vai para o bundle.

## Implementação

Abra o Claude Code nesta pasta e digite algo como "Leia o PROMPT.md e implemente a fase 1". Ele segue o plano em 7 fases (seção 12 do PROMPT.md), terminando cada fase com testes verdes e um commit.

## Deploy

- **Local (produção):** `npm run build && npm start` — o Express serve o `dist/` e a API com sua chave do `.env`.
- **GitHub Pages:** deploy automático via Actions a cada push (modo mock — sem chave, sem custo).

## Debug

Abra com `?debug=1` na URL ou `Ctrl+Shift+D`. Por enquanto o painel tem o "palco" (emoção, intensidade, falar, olhar pro chat e tema dia/noite) e a galeria com as 13 expressões lado a lado, com opções de falar, piscar, olhar pro chat e partículas. Clique no cabelo da Hana para fazer carinho na cabeça ♡.

## Decisões

- **ASCII — espaços sem cor:** a máscara de cores (seção 7.3) é calculada para todo caractere, mas na renderização os espaços em branco viram texto puro, sem `<span>`. Assim o ahoge (linhas 0–1) balança só o fio de cabelo, e o clique de "carinho na cabeça" só dispara sobre o cabelo desenhado.
- **ASCII — ahoge:** cada trecho do ahoge é um `inline-block` que gira ±6° com `transform-origin` na base.
- **Tema na fase 1:** o tema é automático pelo horário (noite das 19h às 6h). O seletor dia/noite está provisoriamente no DebugPanel, para conferir a galeria nos dois temas; o ajuste definitivo entra nos Ajustes (fase 7).
- **Header:** os botões 📒 📸 ⚙️ 🔊 já aparecem, mas ficam marcados como "em breve" até as fases que os implementam.
- **Proxy `/api`:** entra na fase 3, junto com o servidor.
- **Listas fechadas em `shared/types.ts`:** `EMOTIONS`, `REACTIONS` e `EVENTS` ficam em `types.ts` (sem depender do Zod) e são reexportadas por `schema.ts`. Um teste garante que as 13 emoções batem com as expressões ASCII, e uma checagem de tipo garante que o Zod e o tipo `HanaTurn` não divergem.
- **Fuso horário:** `shared/dailyLife.ts` tem `localParts(date, timeZone?)`. Sem fuso, usa o do navegador; com fuso (IANA), usa `Intl`. Assim o servidor calcula horário, rotina e data local com o `timeZone` do cliente.
- **Anti-grind com várias mensagens:** o debounce junta várias mensagens num turno. O turno conta como repetição se **todas** repetem uma das últimas 10 (inclusive as anteriores do mesmo turno). "Curta" é o texto do turno inteiro com menos de 3 caracteres. Em `greet_return` e `idle_nudge` não há mensagem do usuário, então nenhum ganho positivo é aplicado.
- **Teto diário:** conta o que foi de fato ganho (depois do clamp em 0–100 e do teto de doki-doki). Perdas no mesmo dia não liberam mais ganho.
- **Eventos validados:** `made_up` sem briga em aberto é ignorado, e `fight` com uma briga já em aberto também (o motivo original fica). `confession_declined` vale em `locked`, `open` e `cooldown`; `confession_rejected` só em `she_confessed`.
- **Declaração:** se os requisitos do estágio 5 deixarem de valer (por exemplo, a afeição caiu), `open` volta para `locked`. Humores forçados (`shy` ao pedir tempo, `sad` ao ser recusada) têm intensidade mínima de 0,5.
- **Humor-base:** o PROMPT.md dá a intensidade só para `pouty` (0,4) e `happy` (0,3). Usei 0,5 para `sleepy` e 0,3 para `neutral`.
- **Dias conversados:** o save guarda `daysTalked` (as datas) e a contagem só do dia corrente.
- **Zod:** v4 (`zod@4`). `z.number().int()` e `z.enum([...])` funcionam como no PROMPT.md.

## Personalização

Nome do app, personagem, cenário e ritmo ficam na seção 0 do PROMPT.md.
