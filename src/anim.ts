import { gsap } from 'gsap';
const cache: Record<string, (t: number) => number> = {};
export const ease = (name: string) => (cache[name] ??= gsap.parseEase(name) as any);
/** GSAP 緩動 + Remotion 逐幀：決定性、可 seek */
export const tw = (frame: number, start: number, dur: number, e = 'power3.out', from = 0, to = 1) => {
  const t = Math.min(1, Math.max(0, (frame - start) / dur));
  return from + (to - from) * ease(e)(t);
};
