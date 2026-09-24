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

## Personalização

Nome do app, personagem, cenário e ritmo ficam na seção 0 do PROMPT.md.
