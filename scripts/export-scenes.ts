// 用法：npx tsx scripts/export-scenes.ts data/2026-09-30.json build/2026-09-30/scenes.json
import fs from 'node:fs';
import path from 'node:path';
import { buildScenes } from '../src/buildScenes';
const [inp, out] = process.argv.slice(2);
const b = JSON.parse(fs.readFileSync(inp, 'utf8'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ briefing: b, scenes: buildScenes(b) }, null, 2));
console.log('scenes →', out);
