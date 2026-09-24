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

## Personalização

Nome do app, personagem, cenário e ritmo ficam na seção 0 do PROMPT.md.
