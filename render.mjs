// 用法：node render.mjs <props.json|briefing.json> <out.mp4> [--frames=0-90] [--still=120]
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
const [inp, out = 'out/reel.mp4', ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map((a) => a.replace(/^--/, '').split('=')));
let props = JSON.parse(fs.readFileSync(inp, 'utf8'));
if (!props.briefing) props = { briefing: props };
const browserExecutable = process.env.REMOTION_CHROME || undefined;
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'BriefingReel', inputProps: props, browserExecutable });
fs.mkdirSync(path.dirname(out), { recursive: true });
if (opt.still) {
  await renderStill({ serveUrl, composition, inputProps: props, output: out, frame: +opt.still, browserExecutable });
} else {
  await renderMedia({ serveUrl, composition, inputProps: props, codec: 'h264', outputLocation: out, browserExecutable, crf: 20,
    frameRange: opt.frames ? opt.frames.split('-').map(Number) : undefined,
    onProgress: ({ progress }) => process.stdout.write(`\r${(progress * 100).toFixed(0)}%`) });
}
console.log('\n→', out, `${composition.durationInFrames} frames`);
