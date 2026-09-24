import { useEffect, useState } from "react";
import { now } from "../game/time";

/** Hora do relógio central (com a viagem no tempo do debug), atualizada a cada `intervalMs`. */
export function useNow(intervalMs: number): Date {
  const [date, setDate] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setDate(now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return date;
}
