// 用法：npx tsx scripts/export-scenes.ts data/2026-09-30.json build/2026-09-30/scenes.json
import fs from 'node:fs';
import path from 'node:path';
import { buildScenes } from '../src/buildScenes';
const [inp, out] = process.argv.slice(2);
const b = JSON.parse(fs.readFileSync(inp, 'utf8'));
const scenes = buildScenes(b);
// groups_note 是自由文字，格式一變這兩個場景就會被略過；在 GitHub Actions 上顯示成黃色警告
const gha = process.env.GITHUB_ACTIONS ? '::warning::' : '⚠ ';
if (!scenes.some((s) => s.kind === 'groups')) console.log(`${gha}groups_note 解析不到焦點族群，影片略過「焦點族群」場景`);
if (!scenes.some((s) => s.kind === 'levels')) console.log(`${gha}groups_note 解析不到支撐/壓力點位，影片略過「關鍵點位」場景`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ briefing: b, scenes }, null, 2));
console.log('scenes →', out);
