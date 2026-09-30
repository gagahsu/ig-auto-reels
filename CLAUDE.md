# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Overview

finreels generates 1080×1920 Taiwan pre-market briefing Reels (台股盤前速報) from a daily briefing JSON. Pipeline: briefing JSON → narration script (scenes) → Gemini TTS → MuseTalk lip-sync host (Colab) → Remotion render. User-facing docs are in Traditional Chinese (`README.md` has the full daily workflow and tuning table).

## Commands

There is no build, lint, or test setup (`npm test` is a stub). Requires Node 20+, Python 3.10+ (`pip install google-genai`), ffmpeg.

```bash
# 1) briefing JSON -> scenes.json (editable narration/highlights)
npx tsx scripts/export-scenes.ts data/2026-09-30.json build/2026-09-30/scenes.json
# 2) TTS -> public/<date>/voice.wav (+ per-scene wavs) and build/<date>/props.json
GEMINI_API_KEY=... python scripts/gemini_tts.py build/2026-09-30/scenes.json
#    flags: --dry-run (silence, no API)  --reuse (keep existing wavs)  --only news1 (re-record one scene)
# 3) lip-sync in colab/musetalk_lipsync.ipynb -> put host.mp4 at public/<date>/host.mp4, then rerun step 2 with --reuse
# 4) render
node render.mjs build/2026-09-30/props.json out/2026-09-30.mp4
```

- Quick silent preview (silhouette host, estimated timing): `node render.mjs data/2026-09-30.json out/preview.mp4`
- Single frame: `node render.mjs <props> out/x.png --still=300`; partial range: `--frames=0-90`
- `REMOTION_CHROME` env var overrides the Chrome executable.

## Architecture

- `render.mjs` bundles `src/index.ts`, selects composition `BriefingReel`, and renders via `@remotion/renderer`. If the input JSON lacks a `briefing` key it is wrapped as `{ briefing: <json> }` — so it accepts either raw briefing data or a full props.json.
- `src/buildScenes.ts` is the single source of the narration template. It turns a briefing into `Scene[]` (`intro, futures, indices, adr, news×3, groups, levels, outro`), regex-parsing the free-text `groups_note` (`parseGroups`) for focus groups and support/resistance levels; groups/levels scenes are omitted when parsing finds nothing. Each scene has `narration` + `highlights` (substrings emphasized in captions) + scene-specific `data`.
- `src/Reel.tsx` — `timeline(props)` assigns each scene a frame range. Duration comes from `props.tts.durations[i]` (real TTS audio length) or falls back to `estimateSec` (chars / `T.charsPerSec`). `Root.tsx` uses `calculateMetadata` with this same `timeline` to set total duration, so timing logic must stay in that one function. `props.scenes` overrides the template scenes; `hostVideo` and `bgm` are optional public/-relative paths.
- Host lip-sync video is one continuous clip matching `voice.wav`; each scene shows it via `startFrom={from}` (`components/Host.tsx`): full-screen for intro/outro, small bubble otherwise. Without `hostVideo` a silhouette is shown.
- `scripts/gemini_tts.py` — synthesizes per scene, appends a 0.18s gap, concatenates into `voice.wav`, and writes `props.json` (including `hostVideo` if `public/<date>/host.mp4` exists). Tries the newer `client.interactions.create` API and falls back to `generate_content` on older SDKs. Output is 24 kHz mono 16-bit.
- `src/theme.ts` holds brand name, colors, fonts, dimensions/FPS, `charsPerSec`, and the disclaimer. `components/` has the visual pieces (`Cards` per-scene layouts, `Chrome` title/disclaimer overlay, `Captions`, `Rough` hand-drawn style via roughjs). `src/anim.ts` provides the `tw` GSAP-style tween helper used for frame-based animation.

## Notes

- The date key (`YYYY.MM.DD` in the briefing → `YYYY-MM-DD` in paths) ties together `data/`, `build/`, and `public/` directories; briefing `date` must be in the dotted form.
- The disclaimer/not-investment-advice text in the outro and footer is intentionally fixed; don't remove it.
- `build/`, `out/` and per-date `public/` assets are generated artifacts.
