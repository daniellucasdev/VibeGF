// Som opcional (8.4): "pop" em mensagem nova e "chime" ao subir de estágio.
// WebAudio puro, sem arquivos. Volume baixo e respectivo de reduceMotion? Som
// não é movimento — só o ajuste "som" (e o autoplay policy) controla.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type Tone = { freq: number; at: number; dur: number; gain: number; type?: OscillatorType };

function play(tones: readonly Tone[]) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const t of tones) {
    const osc = ac.createOscillator();
    const vol = ac.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.value = t.freq;
    vol.gain.setValueAtTime(0, now + t.at);
    vol.gain.linearRampToValueAtTime(t.gain, now + t.at + 0.01);
    vol.gain.exponentialRampToValueAtTime(0.0001, now + t.at + t.dur);
    osc.connect(vol).connect(ac.destination);
    osc.start(now + t.at);
    osc.stop(now + t.at + t.dur + 0.05);
  }
}

/** "pop" suave de mensagem nova. */
export function pop() {
  play([{ freq: 660, at: 0, dur: 0.09, gain: 0.045 }, { freq: 990, at: 0.03, dur: 0.08, gain: 0.03 }]);
}

/** "chime" ao subir de estágio (e na declaração). */
export function chime() {
  play([
    { freq: 523.25, at: 0, dur: 0.35, gain: 0.05 },    // C5
    { freq: 659.25, at: 0.09, dur: 0.35, gain: 0.05 }, // E5
    { freq: 783.99, at: 0.18, dur: 0.45, gain: 0.05 }, // G5
    { freq: 1046.5, at: 0.27, dur: 0.6, gain: 0.04 },  // C6
  ]);
}
