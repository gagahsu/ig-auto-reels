import React from 'react';
import { Composition } from 'remotion';
import { Reel, ReelProps, timeline } from './Reel';
import { T } from './theme';
import sample from '../data/2026-09-30.json';

export const Root: React.FC = () => (
  <Composition
    id="BriefingReel"
    component={Reel as any}
    width={T.W} height={T.H} fps={T.FPS}
    durationInFrames={300}
    defaultProps={{ briefing: sample } as ReelProps}
    calculateMetadata={({ props }) => {
      const tl = timeline(props as ReelProps);
      const last = tl[tl.length - 1];
      return { durationInFrames: last.from + last.frames };
    }}
  />
);
