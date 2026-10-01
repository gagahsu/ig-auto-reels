import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { T } from './theme';
import { tw } from './anim';
import { buildScenes, estimateSec, titleLines, Scene } from './buildScenes';
import { Chrome } from './components/Chrome';
import { Captions } from './components/Captions';
import { AdrCard, FuturesCard, GroupsCard, IndicesCard, IntroCard, LevelsCard, NewsCard, OutroCard } from './components/Cards';

export type ReelProps = {
  briefing: any;
  scenes?: Scene[];                         // 可傳入 LLM 改寫後的腳本；沒傳就用模板
  tts?: { audio: string; durations: number[] }; // public/ 下的整段語音 + 每場景秒數
  bgm?: string;
};

export const timeline = (p: ReelProps) => {
  const scenes = p.scenes ?? buildScenes(p.briefing);
  let from = 0;
  return scenes.map((s, i) => {
    const sec = p.tts?.durations?.[i] ?? estimateSec(s.narration);
    const frames = Math.round(sec * T.FPS);
    const r = { s, from, frames };
    from += frames;
    return r;
  });
};

const Paper = () => <AbsoluteFill style={{ background: T.cream }} />;

const SceneView: React.FC<{ s: Scene; frames: number }> = ({ s, frames }) => {
  const f = useCurrentFrame();
  const flash = 1 - tw(f, 0, 6, 'power1.out');
  return (
    <AbsoluteFill>
      <Paper />
      {s.kind === 'intro' && <IntroCard d={s.data} />}
      {s.kind === 'futures' && <FuturesCard d={s.data} />}
      {s.kind === 'indices' && <IndicesCard d={s.data} />}
      {s.kind === 'adr' && <AdrCard d={s.data} />}
      {s.kind === 'news' && <NewsCard d={s.data} />}
      {s.kind === 'groups' && <GroupsCard d={s.data} />}
      {s.kind === 'levels' && <LevelsCard d={s.data} />}
      {s.kind === 'outro' && <OutroCard />}
      <Captions narration={s.narration} highlights={s.highlights} frames={frames} />
      <AbsoluteFill style={{ background: '#fff', opacity: flash * 0.5 }} />
    </AbsoluteFill>
  );
};

export const Reel: React.FC<ReelProps> = (p) => {
  const tl = timeline(p);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {tl.map(({ s, from, frames }) => (
        <Sequence key={s.id} from={from} durationInFrames={frames}>
          <SceneView s={s} frames={frames} />
        </Sequence>
      ))}
      <Chrome lines={titleLines(p.briefing)} />
      {p.tts?.audio && <Audio src={staticFile(p.tts.audio)} />}
      {p.bgm && <Audio src={staticFile(p.bgm)} volume={0.08} loop />}
    </AbsoluteFill>
  );
};
