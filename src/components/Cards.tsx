import React from 'react';
import { useCurrentFrame } from 'remotion';
import { scaleLinear } from 'd3-scale';
import { T, signColor } from '../theme';
import { tw } from '../anim';
import { Tag } from './Chrome';
import { RoughMark } from './Rough';

const Box: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = 400 }) => (
  <div style={{ position: 'absolute', top, left: 60, right: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: T.font, color: T.ink }}>{children}</div>
);
const fmt = (n: number, dec = 0) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const n = (s: string) => parseFloat(String(s).replace(/[^\d.\-]/g, ''));
const enter = (f: number, st: number, dy = 40) => ({ opacity: tw(f, st, 10, 'power1.out'), transform: `translateY(${tw(f, st, 16, 'power3.out', dy, 0)}px)` });

/** 台指期夜盤：數字滾動 + 手繪圈 + 印章 */
export const FuturesCard: React.FC<{ d: any }> = ({ d }) => {
  const f = useCurrentFrame();
  const close = n(d.futures_close), ch = n(d.futures_change);
  const c = signColor(d.futures_change);
  const v = tw(f, 10, 34, 'power3.out', close - ch, close);
  const stamp = tw(f, 46, 10, 'back.out(2.5)', 2.2, 1);
  return (
    <Box>
      <Tag text="台指期夜盤" sub="昨夜收盤" />
      <div style={{ position: 'relative', marginTop: 50, width: 900, height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <RoughMark w={860} h={270} start={36} dur={20} color={c} style={{ left: 20, top: -10 }} />
        <div style={{ fontSize: 200, fontWeight: 900, color: c, letterSpacing: -4, fontVariantNumeric: 'tabular-nums' }}>{fmt(v)}</div>
      </div>
      <div style={{ ...enter(f, 22), marginTop: 24, display: 'flex', gap: 24 }}>
        <div style={{ background: c, color: '#fff', fontSize: 58, fontWeight: 900, padding: '6px 28px', borderRadius: 14 }}>{ch >= 0 ? '▲' : '▼'} {d.futures_change.replace(/^[+\-]/, '')} 點</div>
        <div style={{ border: `5px solid ${c}`, color: c, fontSize: 58, fontWeight: 900, padding: '0 24px', borderRadius: 14 }}>{d.futures_change_pct}</div>
      </div>
      <div style={{ marginTop: 70, opacity: f > 46 ? 1 : 0, transform: `rotate(-8deg) scale(${stamp})`, border: `8px solid ${T.tag}`, color: T.tag, fontSize: 76, fontWeight: 900, padding: '4px 30px', borderRadius: 16, letterSpacing: 8, background: 'rgba(255,255,255,.4)' }}>{d.outlook.trim()}</div>
    </Box>
  );
};

/** 橫向漲跌長條（D3 scale），用於美股指數與 ADR */
const Bars: React.FC<{ rows: { name: string; value: string }[]; start: number; nameW?: number; rowH?: number }> = ({ rows, start, nameW = 290, rowH = 118 }) => {
  const f = useCurrentFrame();
  const vals = rows.map((r) => n(r.value));
  const m = Math.max(...vals.map(Math.abs)) * 1.1;
  const W = 960 - nameW - 180;
  const x = scaleLinear().domain([-m, m]).range([0, W]);
  return (
    <div style={{ marginTop: 40, width: 960 }}>
      {rows.map((r, i) => {
        const st = start + i * 6, p = tw(f, st, 22, 'power3.out');
        const v = vals[i], c = signColor(r.value);
        const x0 = x(0), x1 = x(v * p);
        return (
          <div key={r.name} style={{ ...enter(f, st, 30), display: 'flex', alignItems: 'center', height: rowH }}>
            <div style={{ width: nameW, fontSize: 50, fontWeight: 900, textAlign: 'right', paddingRight: 20 }}>{r.name}</div>
            <svg width={W} height={70}>
              <line x1={x0} x2={x0} y1={0} y2={70} stroke="#999" strokeWidth={3} strokeDasharray="6 6" />
              <rect x={Math.min(x0, x1)} y={12} width={Math.abs(x1 - x0)} height={46} rx={8} fill={c} />
            </svg>
            <div style={{ width: 180, fontSize: 50, fontWeight: 900, color: c, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v >= 0 ? '+' : ''}{(v * p).toFixed(2)}%</div>
          </div>
        );
      })}
    </div>
  );
};

export const IndicesCard: React.FC<{ d: any[] }> = ({ d }) => {
  const f = useCurrentFrame();
  const best = [...d].sort((a, b) => n(b.value) - n(a.value))[0];
  const bi = d.indexOf(best);
  return (
    <Box>
      <Tag text="美股收盤" sub="四大指數" />
      <div style={{ position: 'relative' }}>
        <Bars rows={d} start={8} />
        <RoughMark w={330} h={120} start={40} color={T.tag} seed={9} style={{ left: -24, top: 40 + bi * 118 - 2 }} />
      </div>
    </Box>
  );
};

export const AdrCard: React.FC<{ d: any }> = ({ d }) => {
  const f = useCurrentFrame();
  const prem = d.premium.replace('溢價', '').trim();
  return (
    <Box>
      <Tag text="台股 ADR" sub="昨夜表現" />
      <Bars rows={d.adr} start={8} nameW={220} />
      <div style={{ ...enter(f, 34), position: 'relative', marginTop: 30, fontSize: 56, fontWeight: 900 }}>
        台積電ADR 溢價 <span style={{ color: signColor(prem) }}>{prem}</span>
        <RoughMark w={640} h={30} shape="underline" start={44} color={T.yellow} sw={12} style={{ left: 0, top: 70 }} />
      </div>
    </Box>
  );
};

/** 新聞：標題分行 + 螢光筆底線，摘要小字 */
export const NewsCard: React.FC<{ d: any }> = ({ d }) => {
  const f = useCurrentFrame();
  return (
    <Box>
      <Tag text={`焦點新聞 ${d.i + 1}/${d.total}`} />
      <div style={{ marginTop: 50, width: 940 }}>
        {d.lines.map((l: string, i: number) => {
          const st = 8 + i * 12, hp = tw(f, st + 8, 14, 'power2.inOut');
          return (
            <div key={i} style={{ ...enter(f, st), position: 'relative', fontSize: 62, fontWeight: 900, lineHeight: 1.35, marginBottom: 18, textWrap: 'balance' as any }}>
              <span style={{ backgroundImage: `linear-gradient(transparent 58%, ${i === 0 ? 'rgba(255,216,74,.85)' : 'rgba(226,59,50,.22)'} 58%)`, backgroundSize: `${hp * 100}% 100%`, backgroundRepeat: 'no-repeat', WebkitBoxDecorationBreak: 'clone' }}>{l}</span>
            </div>
          );
        })}
        <div style={{ ...enter(f, 30), marginTop: 20, fontSize: 38, fontWeight: 500, color: T.sub, lineHeight: 1.6, borderLeft: `8px solid ${T.yellow}`, paddingLeft: 24 }}>{d.detail}</div>
      </div>
    </Box>
  );
};

export const GroupsCard: React.FC<{ d: any[] }> = ({ d }) => {
  const f = useCurrentFrame();
  return (
    <Box>
      <Tag text="今日焦點族群" />
      <div style={{ marginTop: 40, width: 960 }}>
        {d.map((g, i) => {
          const st = 8 + i * 10;
          return (
            <div key={i} style={{ ...enter(f, st), background: '#fff', border: `4px solid ${T.ink}`, borderRadius: 20, padding: '20px 26px', marginBottom: 22, boxShadow: `5px 5px 0 ${T.ink}`, display: 'flex', alignItems: 'center', gap: 22 }}>
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: T.yellow, border: `4px solid ${T.ink}`, color: T.ink, fontSize: 42, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 46, fontWeight: 900 }}>{g.name}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                  {g.stocks.map((s: any, j: number) => (
                    <div key={j} style={{ opacity: tw(f, st + 8 + j * 4, 8), fontSize: 32, fontWeight: 700, background: '#2f2f33', color: '#fff', padding: '4px 14px', borderRadius: 10 }}>{s.name} <span style={{ color: T.yellow }}>{s.code}</span></div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Box>
  );
};

/** 關鍵點位：垂直價格尺（D3 scale） */
export const LevelsCard: React.FC<{ d: any }> = ({ d }) => {
  const f = useCurrentFrame();
  const lo = n(d.supportLo), hi = d.supportHi ? n(d.supportHi) : lo, res = n(d.resistance), close = n(d.close);
  const H = 620, pad = 60;
  const y = scaleLinear().domain([Math.min(lo, close) - 150, Math.max(res, close) + 150]).range([H - pad, pad]);
  const line = (v: number, label: string, color: string, st: number, dash = false) => {
    const p = tw(f, st, 16, 'power3.out');
    return (
      <g key={label} opacity={tw(f, st, 8)}>
        <line x1={250} x2={250 + 650 * p} y1={y(v)} y2={y(v)} stroke={color} strokeWidth={6} strokeDasharray={dash ? '16 12' : undefined} />
        <text x={230} y={y(v) + 16} textAnchor="end" fontSize={44} fontWeight={900} fill={color}>{fmt(v)}</text>
        <text x={900} y={y(v) - 16} textAnchor="end" fontSize={40} fontWeight={900} fill={color}>{label}</text>
      </g>
    );
  };
  return (
    <Box>
      <Tag text="關鍵點位" sub="今日開盤觀測" />
      <svg width={960} height={H} style={{ marginTop: 20, fontFamily: T.font }}>
        <rect x={250} y={y(hi)} width={650 * tw(f, 10, 16)} height={Math.max(8, y(lo) - y(hi))} fill="rgba(226,59,50,.14)" />
        {line(res, '上方壓力', T.ink, 24, true)}
        {line(close, '夜盤收盤', T.up, 16)}
        {line(hi, '支撐區上緣', T.down, 8)}
        {hi !== lo && line(lo, '支撐區下緣', T.down, 12)}
      </svg>
    </Box>
  );
};
