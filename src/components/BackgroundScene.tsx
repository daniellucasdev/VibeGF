import { memo } from "react";

type Theme = "day" | "night";

const PETALS = 15;
const STARS = 12;
const FIREFLIES = 5;

/** Posição "aleatória" estável por índice: o fundo não muda entre renders. */
function spread(i: number, salt: number): number {
  const x = Math.sin(i * 91.7 + salt * 47.3) * 10000;
  return x - Math.floor(x);
}

/** Fundo em gradiente com pétalas de sakura (dia) ou estrelas, lua e vaga-lumes (noite). Só CSS. */
export const BackgroundScene = memo(function BackgroundScene({ theme }: { theme: Theme }) {
  return (
    <div className="bg-scene" aria-hidden="true">
      {theme === "day"
        ? Array.from({ length: PETALS }, (_, i) => (
            <span
              key={i}
              className="petal"
              style={{
                left: `${spread(i, 1) * 100}%`,
                animationDuration: `${11 + spread(i, 2) * 9}s`,
                animationDelay: `${-spread(i, 3) * 20}s`,
                scale: `${0.7 + spread(i, 4) * 0.6}`,
              }}
            />
          ))
        : (
          <>
            <span className="moon">☾</span>
            {Array.from({ length: STARS }, (_, i) => (
              <span
                key={`s${i}`}
                className="star"
                style={{
                  left: `${spread(i, 5) * 100}%`,
                  top: `${spread(i, 6) * 70}%`,
                  animationDuration: `${2 + spread(i, 7) * 3}s`,
                  animationDelay: `${-spread(i, 8) * 4}s`,
                }}
              >
                ✦
              </span>
            ))}
            {Array.from({ length: FIREFLIES }, (_, i) => (
              <span
                key={`f${i}`}
                className="firefly"
                style={{
                  left: `${spread(i, 9) * 90}%`,
                  top: `${50 + spread(i, 10) * 45}%`,
                  animationDuration: `${3 + spread(i, 11) * 3}s`,
                  animationDelay: `${-spread(i, 12) * 5}s`,
                }}
              />
            ))}
          </>
        )}
    </div>
  );
});
