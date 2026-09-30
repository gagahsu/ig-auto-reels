import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { T } from '../theme';
import { tw } from '../anim';

/** 全片固定：Logo、頂部標題框、進度條、底部免責聲明 */
export const Chrome: React.FC<{ lines: string[] }> = ({ lines }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const inY = tw(f, 0, 14, 'back.out(1.6)', -40, 0);
  return (
    <AbsoluteFill style={{ fontFamily: T.font, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, height: 8, width: `${(f / durationInFrames) * 100}%`, background: T.yellow }} />
      <div style={{ position: 'absolute', top: 40, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Img src={staticFile(T.logo)} style={{ width: 124, height: 124, borderRadius: '50%', border: `4px solid ${T.ink}`, background: T.cream, boxShadow: '0 4px 12px rgba(0,0,0,.25)' }} />
      </div>
      <div style={{ position: 'absolute', top: 178, width: '100%', display: 'flex', justifyContent: 'center', transform: `translateY(${inY}px)` }}>
        <div style={{ background: T.cream, border: `5px solid ${T.ink}`, borderRadius: 22, padding: '14px 40px 16px', textAlign: 'center', boxShadow: `6px 6px 0 ${T.ink}` }}>
          <div style={{ color: T.ink, fontSize: 54, fontWeight: 900, lineHeight: 1.25, letterSpacing: 2 }}>{lines[0]}</div>
          <div style={{ color: T.ink, fontSize: 58, fontWeight: 900, lineHeight: 1.25, letterSpacing: 2 }}><span style={{ backgroundImage: `linear-gradient(transparent 55%, ${T.yellow} 55%)` }}>{lines[1]}</span></div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 190, background: 'rgba(251,245,230,.94)', borderTop: `4px solid ${T.ink}`, padding: '22px 64px', color: T.ink }}>
        <div style={{ fontSize: 26, fontWeight: 900 }}>【免責聲明】</div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.45, opacity: 0.95 }}>{T.disclaimer}</div>
      </div>
    </AbsoluteFill>
  );
};

/** 黃底黑框標籤（頭貼風格） */
export const Tag: React.FC<{ text: string; start?: number; sub?: string }> = ({ text, start = 0, sub }) => {
  const f = useCurrentFrame();
  const s = tw(f, start, 14, 'back.out(2.2)', 0.4, 1);
  const o = tw(f, start, 8, 'power1.out');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: o, transform: `scale(${s})` }}>
      {sub && <div style={{ fontFamily: T.font, fontSize: 52, fontWeight: 900, color: T.ink, marginBottom: 10 }}>{sub}</div>}
      <div style={{ fontFamily: T.font, background: T.yellow, color: T.ink, fontSize: 50, fontWeight: 900, padding: '8px 26px', borderRadius: 14, border: `4px solid ${T.ink}`, boxShadow: `4px 4px 0 ${T.ink}`, letterSpacing: 2 }}>{text}</div>
    </div>
  );
};
