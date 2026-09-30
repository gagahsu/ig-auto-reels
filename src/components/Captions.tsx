import React from 'react';
import { useCurrentFrame } from 'remotion';
import { T } from '../theme';
import { tw } from '../anim';

const tok = /[\dA-Za-z,.%+\-&]/;
/** 找最接近中間、且不會切斷數字/英文的位置；優先切在「到、與、和、的」之前 */
function safeCut(s: string) {
  const mid = s.length / 2;
  let best = -1, bs = 1e9;
  for (let i = 2; i < s.length - 2; i++) {
    if (tok.test(s[i - 1]) && tok.test(s[i])) continue;
    const score = Math.abs(i - mid) - ('到與和及'.includes(s[i]) ? 3 : 0);
    if (score < bs) { bs = score; best = i; }
  }
  return best < 0 ? Math.ceil(mid) : best;
}
/** 把口播切成短句（無標點），依字數分配時間；可傳入 TTS 的逐句時間戳覆蓋 */
export function chunk(narr: string, max = 15): string[] {
  const parts = narr.split(/[，。！？；：]/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (p.length <= max) { out.push(p); continue; }
    const sub = p.split('、');
    let cur = '';
    for (const s of sub) {
      if ((cur + s).length > max && cur) { out.push(cur); cur = s; } else cur = cur ? cur + '、' + s : s;
    }
    if (cur.length > max) { const h = safeCut(cur); out.push(cur.slice(0, h), cur.slice(h)); } else if (cur) out.push(cur);
  }
  return out;
}

const Hi: React.FC<{ text: string; hl: string[] }> = ({ text, hl }) => {
  const keys = hl.filter(Boolean).sort((a, b) => b.length - a.length);
  if (!keys.length) return <>{text}</>;
  const re = new RegExp(`(${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
  return <>{text.split(re).map((s, i) => keys.includes(s) ? <span key={i} style={{ color: T.yellow }}>{s}</span> : <span key={i}>{s}</span>)}</>;
};

export const Captions: React.FC<{ narration: string; highlights: string[]; frames: number; top?: number }> = ({ narration, highlights, frames, top = 1420 }) => {
  const f = useCurrentFrame();
  const cs = chunk(narration);
  const total = cs.reduce((a, c) => a + c.length, 0);
  let acc = 0, idx = 0, start = 0;
  for (let i = 0; i < cs.length; i++) {
    const len = (cs[i].length / total) * frames;
    if (f < acc + len || i === cs.length - 1) { idx = i; start = acc; break; }
    acc += len;
  }
  const pop = tw(f, start, 5, 'back.out(3)', 0.88, 1);
  return (
    <div style={{ position: 'absolute', top, left: 40, right: 40, textAlign: 'center', fontFamily: T.font, fontSize: 64, fontWeight: 900, color: '#fff', letterSpacing: 1,
      WebkitTextStroke: '10px #1b1b1b', paintOrder: 'stroke fill', textShadow: '0 4px 10px rgba(0,0,0,.35)', transform: `scale(${pop})` }}>
      <Hi text={cs[idx]} hl={highlights} />
    </div>
  );
};
