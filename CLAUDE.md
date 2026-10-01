# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Overview

finreels generates 1080×1920 Taiwan pre-market briefing Reels (台股盤前速報) from a daily briefing JSON. Pipeline: briefing JSON → narration script (scenes) → Gemini TTS → Remotion render. There is no on-screen host: every scene is an info card plus captions. User-facing docs are in Traditional Chinese (`README.md` has the daily workflow and tuning table).

Daily automation lives in a separate repo, `gagahsu/ig-auto-post` (`.github/workflows/post-reel-to-ig.yml`): it fetches the `IG_BRIEFING_PAYLOAD` email from Gmail, checks out this repo, runs the three commands below on an Ubuntu runner, hosts the mp4 and publishes it as an IG Reel. The briefing JSON schema is shared with that repo's carousel pipeline (`payload.example.json` there). This repo never touches Gmail or Instagram.

## Commands

There is no build, lint, or test setup (`npm test` is a stub). Requires Node 20+, Python 3.10+ (`pip install google-genai`); on Linux also `fonts-noto-cjk` for the CJK font stack in `theme.ts`.

```bash
# 1) briefing JSON -> scenes.json (editable narration/highlights); warns if groups/levels can't be parsed
npx tsx scripts/export-scenes.ts data/2026-09-30.json build/2026-09-30/scenes.json
# 2) TTS -> public/<date>/voice.wav and build/<date>/props.json
GEMINI_API_KEY=... python scripts/gemini_tts.py build/2026-09-30/scenes.json
#    flags: --dry-run (synthetic tone, no API)  --reuse (re-split existing voice.wav, no API)
# 3) render
node render.mjs build/2026-09-30/props.json out/2026-09-30.mp4
```

- Quick silent preview (estimated timing): `node render.mjs data/2026-09-30.json out/preview.mp4`
- Single frame: `node render.mjs <props> out/x.png --still=300`; partial range: `--frames=0-90`
- `REMOTION_CHROME` env var overrides the Chrome executable.

## Architecture

- `render.mjs` bundles `src/index.ts`, selects composition `BriefingReel`, and renders via `@remotion/renderer`. If the input JSON lacks a `briefing` key it is wrapped as `{ briefing: <json> }` — so it accepts either raw briefing data or a full props.json.
- `src/buildScenes.ts` is the single source of the narration template. It turns a briefing into `Scene[]` (`intro, indices, adr, futures, news×3, groups, levels, outro`), regex-parsing the free-text `groups_note` (`parseGroups`) for focus groups and support/resistance levels; groups/levels scenes are omitted when parsing finds nothing. Each scene has `narration` + `highlights` (substrings emphasized in captions) + scene-specific `data` (intro gets an agenda built from which scenes exist). Emoji are stripped from `outlook` so TTS doesn't read them.
- `src/Reel.tsx` — `timeline(props)` assigns each scene a frame range. Duration comes from `props.tts.durations[i]` (real TTS audio length) or falls back to `estimateSec` (chars / `T.charsPerSec`). `Root.tsx` uses `calculateMetadata` with this same `timeline` to set total duration, so timing logic must stay in that one function. `props.scenes` overrides the template scenes; `bgm` is an optional public/-relative path.
- `scripts/gemini_tts.py` — calls Gemini TTS once for the whole script (scenes joined by blank lines), writes `voice.wav` immediately, then splits it back into per-scene durations by finding silences near the char-count-proportional positions (warns when it falls back to the estimate). Writes `props.json`. Tries the newer `client.interactions.create` API and falls back to `generate_content` on older SDKs. Output is 24 kHz mono 16-bit. No automatic retry, to avoid burning quota.
- `src/theme.ts` holds brand name, colors, fonts, dimensions/FPS, `charsPerSec`, and the disclaimer. `components/` has the visual pieces (`Cards` per-scene layouts incl. `IntroCard`/`OutroCard`, `Chrome` title/AI-label/disclaimer overlay, `Captions`, `Rough` hand-drawn style via roughjs). `src/anim.ts` provides the `tw` GSAP-style tween helper used for frame-based animation.

## Notes

- The date key (`YYYY.MM.DD` in the briefing → `YYYY-MM-DD` in paths) ties together `data/`, `build/`, and `public/` directories; briefing `date` must be in the dotted form.
- The disclaimer/not-investment-advice text in the outro and footer, and the "AI 自動生成" label in `Chrome`, are intentionally fixed (posts go out without human review); don't remove them.
- Rendered mp4 must stay under ~20 MB because ig-auto-post serves it via jsDelivr (a ~70 s reel at crf 20 is ~8 MB).
- `build/`, `out/` and per-date `public/` assets are generated artifacts.
