// Rate limit simples em memória (6.1): N requisições por janela fixa, por IP.

import type { RequestHandler } from "express";

export type RateLimitOptions = { limit: number; windowMs: number; now?: () => number };

export function rateLimit({ limit, windowMs, now = Date.now }: RateLimitOptions): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const t = now();
    // Limpeza preguiçosa: evita crescer sem fim com IPs que não voltam.
    if (hits.size > 5000) for (const [ip, h] of hits) if (h.resetAt <= t) hits.delete(ip);
    const ip = req.ip ?? req.socket.remoteAddress ?? "?";
    let h = hits.get(ip);
    if (!h || h.resetAt <= t) {
      h = { count: 0, resetAt: t + windowMs };
      hits.set(ip, h);
    }
    h.count++;
    if (h.count > limit) {
      res.setHeader("Retry-After", String(Math.ceil((h.resetAt - t) / 1000)));
      res.status(429).json({ error: "calma! muitas mensagens de uma vez… espera um minutinho (・・;)" });
      return;
    }
    next();
  };
}
