import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion';
import { T } from '../theme';
import { tw } from '../anim';

/** 主持人佔位：沒有對嘴影片時顯示剪影；有 hostVideo 時播放對應時間段（整支對嘴影片，startFrom=場景起點） */
const Placeholder: React.FC<{ small?: boolean }> = ({ small }) => {
  const f = useCurrentFrame();
  const bob = Math.sin(f / 9) * 4;
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 30% 20%, #c79a63 0%, #8a6440 35%, #3d2c21 100%)' }}>
      {!small && [[160, 620, 120], [880, 520, 90], [760, 1320, 140], [220, 1500, 70]].map(([x, y, r], i) => (
        <div key={i} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: 'rgba(255,220,160,.18)', filter: 'blur(18px)' }} />
      ))}
      <svg viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0, transform: `translateY(${bob}px)` }}>
        <ellipse cx="540" cy="760" rx="170" ry="210" fill="#1c1a1f" />
        <path d="M200 1920 C210 1350 330 1140 540 1120 C750 1140 870 1350 880 1920 Z" fill="#1c1a1f" />
        <rect x="470" y="930" width="140" height="220" fill="#1c1a1f" />
      </svg>
      {!small && <div style={{ position: 'absolute', top: 1040, width: '100%', textAlign: 'center', fontFamily: T.font, color: 'rgba(255,255,255,.55)', fontSize: 30, fontWeight: 700 }}>AI 主播（對嘴影片放這裡）</div>}
    </AbsoluteFill>
  );
};

export const HostFull: React.FC<{ video?: string; startFrom: number }> = ({ video, startFrom }) =>
  video ? <OffthreadVideo src={staticFile(video)} startFrom={startFrom} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Placeholder />;

export const HostBubble: React.FC<{ video?: string; startFrom: number }> = ({ video, startFrom }) => {
  const f = useCurrentFrame();
  const s = tw(f, 2, 14, 'back.out(1.8)', 0, 1);
  const D = 320;
  const SC = 0.54;
  return (
    <div style={{ position: 'absolute', left: 60, top: 1110, width: D, height: D, borderRadius: '50%', overflow: 'hidden', border: `6px solid ${T.ink}`, boxShadow: `6px 6px 0 ${T.yellow}`, transform: `scale(${s})` }}>
      {video
        ? <OffthreadVideo src={staticFile(video)} startFrom={startFrom} muted style={{ position: 'absolute', width: 415, height: 737, left: -64, top: -105, maxWidth: 'none' }} />
        : <div style={{ position: 'absolute', width: 1080, height: 1920, transform: `scale(${SC})`, transformOrigin: '0 0', left: D / 2 - 540 * SC, top: D * 0.45 - 760 * SC }}><Placeholder small /></div>}
    </div>
  );
};
