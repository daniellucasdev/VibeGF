// Arte base da Hana (21 linhas, até 42 colunas). Espaços à esquerda contam.
// Letras maiúsculas são tokens trocados pela expressão:
//   A/Z sobrancelhas (4) · K/J pálpebras (5) · L/R olhos (5) · B/C blush (3) · M boca (4)
// Do ponto de vista de quem olha, o olho esquerdo é L e o direito é R.
const ART = String.raw`
                    ,
                   (
              _.--""""""--._
          .-""'            '""-.
       .-'   .-'   /  \   '-.   .-.  .-.
     .'   .-'    /  /\  \    '-.\  \/  /
    /  *.'   /  /  /  \  \  \   /__/\__\
   /   /  /| /| /| |  | |\ |\ |\  \   \
  /   / / |/ |/ |/ |  | \| \| \| \ \   \
  | | | |/ '  '  '      '  '  ' \| | | |
  | | | |   AAAA          ZZZZ   | | | |
  | | | |   KKKKK        JJJJJ   | | | |
  | | | |   LLLLL        RRRRR   | | | |
  | | | |  BBB              CCC  | | | |
  | | | |\         MMMM         /| | | |
  | | | | '.                  .' | | | |
  |   | |   '-.            .-'   | |   |
  |   | |      '-.______.-'      | |   |
 /|   | |        |      |        | |   |\
/ |   | |   .----'      '----.   | |   | \
  |   | |  /    \  \  /  /    \  | |   |
`;

export const BASE_LINES: readonly string[] = ART.split("\n").slice(1, -1);

export const ART_ROWS = 21;
export const ART_COLS = 42;

export const TOKEN_LETTERS = ["A", "Z", "K", "J", "L", "R", "B", "C", "M"] as const;
export type TokenLetter = (typeof TOKEN_LETTERS)[number];

export const TOKEN_WIDTH: Record<TokenLetter, number> = {
  A: 4, Z: 4, K: 5, J: 5, L: 5, R: 5, B: 3, C: 3, M: 4,
};

export function isTokenLetter(ch: string): ch is TokenLetter {
  return (TOKEN_LETTERS as readonly string[]).includes(ch);
}
