import { ART_COLS, ART_ROWS } from "./base";
import { EXPRESSION_META, type Emotion, type ParticleKind } from "./expressions";

// Camada de partículas posicionada por grade (seção 7.5):
// left = col/42 · 100%, top = row/21 · 100%. Só CSS keyframes.

export const MAX_PARTICLES = 12;
export const MAX_AMBIENT = 8;
export const MAX_BURST = MAX_PARTICLES - MAX_AMBIENT;

export type ParticleAnim = "rise" | "twinkle" | "drip" | "steam" | "bob" | "fall" | "pulse" | "pop" | "float" | "zzz" | "burst";
export type ParticleTone = "hair" | "ribbon" | "clothes" | "accent" | "line" | "blush";

export type Particle = {
  id: string;
  glyph: string;
  row: number;
  col: number;
  anim: ParticleAnim;
  tone: ParticleTone;
  /** segundos */
  duration: number;
  /** segundos */
  delay: number;
  /** deslocamento final em em (burst/zzz/fall) */
  dx: number;
  dy: number;
  scale: number;
  once: boolean;
};

/** Âncoras da seção 7.5. */
export const ANCHORS = {
  headTop: { row: 0, colFrom: 18, colTo: 24 },
  temple: { row: 5, col: 31 },
  eyeLeft: { row: 12, col: 14 },
  eyeRight: { row: 12, col: 27 },
} as const;

/** Pseudoaleatório determinístico em [0, 1): as partículas não "pulam" a cada render. */
function rand(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function between(i: number, salt: number, from: number, to: number): number {
  return from + rand(i, salt) * (to - from);
}

export function ambientCount(kind: ParticleKind, intensity: number): number {
  if (kind === "none") return 0;
  const i = Math.min(1, Math.max(0, intensity));
  if (kind === "sweat" || kind === "anger") return 1;
  if (kind === "bang") return i > 0.6 ? 2 : 1;
  return Math.min(MAX_AMBIENT, Math.max(2, Math.round(2 + i * 6)));
}

type Base = Omit<Particle, "id" | "delay" | "once">;

function ambientOne(kind: ParticleKind, i: number, count: number): Base | null {
  const head = ANCHORS.headTop;
  const headCol = between(i, 1, head.colFrom - 4, head.colTo + 4);
  switch (kind) {
    case "none":
      return null;
    case "notes":
      return { glyph: i % 2 ? "♫" : "♪", row: head.row, col: headCol, anim: "rise", tone: "hair", duration: 2.8, dx: between(i, 2, -1.5, 1.5), dy: -3, scale: 1 };
    case "hearts":
      return { glyph: i % 3 ? "♡" : "♥", row: head.row, col: headCol, anim: "rise", tone: "blush", duration: 3, dx: between(i, 2, -1.5, 1.5), dy: -3, scale: between(i, 3, 0.8, 1.2) };
    case "sparkles": {
      const angle = (i / count) * Math.PI * 2 + rand(i, 4);
      return { glyph: i % 2 ? "✦" : "✧", row: 8 + Math.sin(angle) * 9, col: 21 + Math.cos(angle) * 20, anim: "twinkle", tone: "accent", duration: 1.8, dx: 0, dy: 0, scale: between(i, 3, 0.8, 1.3) };
    }
    case "sweat":
      return { glyph: "💧", row: ANCHORS.temple.row, col: ANCHORS.temple.col + 1, anim: "drip", tone: "ribbon", duration: 2.4, dx: 0, dy: 0.8, scale: 0.8 };
    case "steam":
      return { glyph: "~", row: head.row + 1, col: headCol, anim: "steam", tone: "line", duration: 2, dx: between(i, 2, -1, 1), dy: -2.5, scale: 1.2 };
    case "rain":
      if (i === 0) return { glyph: "☁", row: -1.5, col: 30, anim: "bob", tone: "clothes", duration: 3, dx: 0, dy: 0, scale: 1.6 };
      return { glyph: "'", row: -0.5, col: between(i, 1, 29, 32), anim: "fall", tone: "ribbon", duration: 1.1, dx: 0, dy: 2, scale: 1 };
    case "tears": {
      const eye = i % 2 ? ANCHORS.eyeRight : ANCHORS.eyeLeft;
      return { glyph: "💧", row: eye.row + 1, col: eye.col + between(i, 1, -1, 1), anim: "fall", tone: "ribbon", duration: 1.6, dx: 0, dy: 3, scale: 0.55 };
    }
    case "anger":
      return { glyph: "💢", row: ANCHORS.temple.row - 1, col: ANCHORS.temple.col + 1, anim: "pulse", tone: "blush", duration: 1.2, dx: 0, dy: 0, scale: 1 };
    case "bang":
      return { glyph: "!", row: -1.5, col: 20 + i * 2, anim: "pop", tone: "hair", duration: 1.4, dx: 0, dy: -0.4, scale: 1.6 };
    case "ponder":
      return { glyph: i % 2 ? "…" : "?", row: -1, col: 25 + (i % 4) * 2, anim: "float", tone: "clothes", duration: 2.6, dx: 0, dy: -0.6, scale: i % 2 ? 1 : 1.3 };
    case "zzz":
      return { glyph: i % 2 ? "Z" : "z", row: 3, col: 30, anim: "zzz", tone: "clothes", duration: 3.2, dx: 3, dy: -3.5, scale: 0.9 + (i % 3) * 0.2 };
    case "tease":
      return { glyph: i % 2 ? "♪" : "~", row: 2, col: between(i, 1, 28, 34), anim: "rise", tone: "hair", duration: 2.6, dx: between(i, 2, 0, 2), dy: -2.5, scale: 1 };
  }
}

/** Partículas contínuas da emoção. A intensidade controla a quantidade. */
export function ambientParticles(emotion: Emotion, intensity: number): Particle[] {
  const kind = EXPRESSION_META[emotion].particle;
  const count = ambientCount(kind, intensity);
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const p = ambientOne(kind, i, count);
    if (!p) continue;
    out.push({ ...p, id: `${emotion}-${i}`, delay: (i / count) * p.duration, once: false });
  }
  return out;
}

/** Burst curto (troca de expressão ou carinho na cabeça). */
export function burstParticles(glyph: string, tone: ParticleTone, seed: number, count = MAX_BURST): Particle[] {
  const n = Math.min(MAX_BURST, count);
  const out: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + rand(seed, i);
    out.push({
      id: `burst-${seed}-${i}`,
      glyph,
      row: 3,
      col: 21,
      anim: "burst",
      tone,
      duration: 0.8,
      delay: i * 0.04,
      dx: Math.cos(angle) * 4,
      dy: Math.sin(angle) * 2.5 - 1,
      scale: 1,
      once: true,
    });
  }
  return out;
}

export function particleLeft(col: number): string {
  return `${(col / ART_COLS) * 100}%`;
}

export function particleTop(row: number): string {
  return `${(row / ART_ROWS) * 100}%`;
}
