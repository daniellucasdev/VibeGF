# Kokoro ♡ — guia do executor

PROMPT.md é a especificação completa e a fonte da verdade. Implemente na ordem da seção 12 (7 fases). Ao concluir cada fase:

1. `npm test` verde e `npm run build` passando (a partir da fase que introduz o build).
2. `git add -A && git commit` com mensagem descritiva generosa (Portuguese, corpo detalhando o que entrou: componentes, testes, decisões). Commits pequenos e frequentes dentro da fase também são bem-vindos.
3. Reporte em 3–6 linhas: o que foi implementado, contagem de testes, o que ficou para a fase seguinte. Não avance para a próxima fase sem terminar a atual.

## Regras

- **Fonte de verdade:** se PROMPT.md e seu conhecimento divergirem (nome de opção, API de pacote, flag), siga o PROMPT.md. Se algo não compilar porque a API real do pacote difere do que o PROMPT.md descreve, use a API real e anote o ajuste no README (seção "Decisões").
- **Não invente API de biblioteca.** Em caso de dúvida sobre `motion/react`, `zustand`, `tailwindcss v4`, `@anthropic-ai/sdk`, consulte a documentação oficial antes de escrever.
- **Modelo:** o padrão é `claude-sonnet-5` (ver .env.example). NUNCA escreva chave de API em código, commit ou log. A chave vive só em `.env` (que é gitignored).
- **Não mude** a arte ASCII base nem os tokens além do que a seção 7 permite; o teste de alinhamento precisa passar.
- **Sem `--no-verify`, sem `git push`, sem amend** — commits locais apenas; o push é feito fora do Claude Code.
- TypeScript strict, sem `any` salvo comentário justificando.
