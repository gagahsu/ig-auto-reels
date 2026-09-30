import React, { useMemo } from 'react';
import rough from 'roughjs';
import { useCurrentFrame } from 'remotion';
import { tw } from '../anim';

const gen = rough.generator();
type Shape = 'ellipse' | 'underline' | 'rect';
/** Rough.js 手繪標記，stroke 逐筆畫出 */
export const RoughMark: React.FC<{ w: number; h: number; shape?: Shape; color?: string; start?: number; dur?: number; seed?: number; sw?: number; style?: React.CSSProperties }> = ({ w, h, shape = 'ellipse', color = '#E23B32', start = 0, dur = 18, seed = 5, sw = 7, style }) => {
  const f = useCurrentFrame();
  const paths = useMemo(() => {
    const o = { seed, roughness: 1.4, bowing: 1.1, stroke: color, strokeWidth: sw };
    const d = shape === 'ellipse' ? gen.ellipse(w / 2, h / 2, w - sw * 3, h - sw * 3, o)
      : shape === 'rect' ? gen.rectangle(sw * 2, sw * 2, w - sw * 4, h - sw * 4, o)
      : gen.line(sw, h / 2, w - sw, h / 2 + 4, o);
    return gen.toPaths(d);
  }, [w, h, shape, color, seed, sw]);
  const p = tw(f, start, dur, 'power2.inOut');
  return (
    <svg width={w} height={h} style={{ position: 'absolute', overflow: 'visible', ...style }}>
      {paths.map((pp, i) => (
        <path key={i} d={pp.d} stroke={pp.stroke} strokeWidth={pp.strokeWidth} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.min(1, Math.max(0, p * paths.length - i))} />
      ))}
    </svg>
  );
};
