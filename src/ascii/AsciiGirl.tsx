import { Fragment, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EXPRESSIONS, EXPRESSION_META, type Emotion } from "./expressions";
import { colorize, type Segment } from "./render";
import {
  ambientParticles,
  burstParticles,
  particleLeft,
  particleTop,
  type Particle,
} from "./particles";

type CSSVars = CSSProperties & Record<`--${string}`, string | number>;

export type AsciiGirlProps = {
  emotion: Emotion;
  /** 0–1: opacidade do blush e quantidade de partículas. */
  intensity?: number;
  /** Alterna a boca entre M e `talk` a cada 140 ms. */
  talking?: boolean;
  /** Olhar para o chat (só em neutral). */
  lookAtChat?: boolean;
  /** Estágio da relação: decide a reação ao carinho na cabeça. */
  stage?: number;
  showParticles?: boolean;
  /** Galeria de debug: mostra o quadro de olho fechado. */
  forceBlink?: boolean;
  fontSize?: string;
  className?: string;
};

const FRAME_MS = 140;
const PAT_MS = 1500;
const BURST_MS = 1000;

function renderSegment(seg: Segment, key: number) {
  if (seg.cls === null) return <Fragment key={key}>{seg.text}</Fragment>;
  if (seg.tok > 0) {
    return (
      <span
        key={key}
        className={`tok ${seg.cls}`}
        style={{ display: "inline-block", width: `${seg.tok}ch`, textAlign: "center" }}
      >
        {seg.text}
      </span>
    );
  }
  const isHair = seg.cls === "hair" || seg.cls === "hair ahoge";
  return (
    <span key={key} className={seg.cls} data-hair={isHair ? "" : undefined}>
      {seg.text}
    </span>
  );
}

function ParticleSpan({ p }: { p: Particle }) {
  const style: CSSVars = {
    left: particleLeft(p.col),
    top: particleTop(p.row),
    animationDuration: `${p.duration}s`,
    animationDelay: `${p.delay}s`,
    animationIterationCount: p.once ? 1 : "infinite",
    "--dx": `${p.dx}em`,
    "--dy": `${p.dy}em`,
    "--s": p.scale,
  };
  return (
    <span className={`particle p-${p.anim} tone-${p.tone}`} style={style}>
      {p.glyph}
    </span>
  );
}

export function AsciiGirl({
  emotion,
  intensity = 0.5,
  talking = false,
  lookAtChat = false,
  stage = 0,
  showParticles = true,
  forceBlink = false,
  fontSize,
  className = "",
}: AsciiGirlProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [pat, setPat] = useState<Emotion | null>(null);
  const [blinking, setBlinking] = useState(false);
  const [talkFrame, setTalkFrame] = useState(false);
  const [bursts, setBursts] = useState<Particle[]>([]);
  const burstSeed = useRef(0);
  const patTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const shown = pat ?? emotion;
  const canBlink = EXPRESSIONS[shown].blink;
  const level = Math.min(1, Math.max(0, intensity));
  const particlesOn = showParticles && !reduceMotion;

  // Piscar: intervalo aleatório de 2,5–6 s, 140 ms fechado, piscada dupla em 20% das vezes.
  useEffect(() => {
    if (!canBlink) {
      setBlinking(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const close = (double: boolean) => {
      setBlinking(true);
      timer = setTimeout(() => {
        setBlinking(false);
        timer = double ? setTimeout(() => close(false), FRAME_MS) : schedule();
      }, FRAME_MS);
    };
    const schedule = () => setTimeout(() => close(Math.random() < 0.2), 2500 + Math.random() * 3500);
    timer = schedule();
    return () => clearTimeout(timer);
  }, [canBlink]);

  // Falar: alterna M e `talk` a cada 140 ms.
  useEffect(() => {
    if (!talking) {
      setTalkFrame(false);
      return;
    }
    const id = setInterval(() => setTalkFrame((f) => !f), FRAME_MS);
    return () => clearInterval(id);
  }, [talking]);

  const addBurst = (glyph: string, tone: Particle["tone"]) => {
    if (!particlesOn) return;
    const seed = ++burstSeed.current;
    const fresh = burstParticles(glyph, tone, seed);
    setBursts(fresh);
    setTimeout(() => {
      setBursts((cur) => (cur === fresh ? [] : cur));
    }, BURST_MS);
  };

  // Trocar de expressão: pequeno burst de partículas (o crossfade fica com o Motion).
  const lastShown = useRef(shown);
  useEffect(() => {
    if (lastShown.current === shown) return;
    lastShown.current = shown;
    addBurst("✧", "accent");
  }, [shown]);

  useEffect(() => () => clearTimeout(patTimer.current), []);

  // Carinho na cabeça: reação local, sem chamar a API.
  const onClick = (e: MouseEvent<HTMLPreElement>) => {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-hair]")) return;
    setPat(stage >= 3 ? "flustered" : "surprised");
    addBurst("♡", "blush");
    clearTimeout(patTimer.current);
    patTimer.current = setTimeout(() => setPat(null), PAT_MS);
  };

  const rows = colorize(shown, { blinking: blinking || forceBlink, talkFrame, lookAtChat });
  const ambient = particlesOn ? ambientParticles(shown, level) : [];
  const meta = EXPRESSION_META[shown];
  const stageStyle: CSSVars = { "--blush-opacity": 0.5 + 0.5 * level };

  return (
    <div className={`ascii-girl ${className}`} style={fontSize ? { fontSize } : undefined}>
      <div className="ascii-breathe">
        <div className="ascii-stage" style={stageStyle}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.pre
              key={shown}
              className="ascii-art"
              role="img"
              aria-label={`Hana, ${meta.label}`}
              onClick={onClick}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {rows.map((segs, r) => (
                <Fragment key={r}>
                  {segs.map(renderSegment)}
                  {r < rows.length - 1 ? "\n" : null}
                </Fragment>
              ))}
            </motion.pre>
          </AnimatePresence>
          {particlesOn && (
            <div className="ascii-particles" aria-hidden="true">
              {[...ambient, ...bursts].map((p) => (
                <ParticleSpan key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
