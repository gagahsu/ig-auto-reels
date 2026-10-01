# finreels：台股盤前速報 Reels 產生器

盤前速報 JSON → 口播稿 → Gemini TTS → Remotion 合成 1080×1920 Reels（純資訊卡＋字幕，無主播）。

## 安裝（一次）
```bash
npm install
pip install google-genai
```
需要 Node 20+、Python 3.10+。Remotion 第一次渲染會自動下載 Chrome headless shell。
Linux 需要中文字型：`sudo apt install fonts-noto-cjk`。

## 每天出片（手動）
```bash
# 1) JSON 存成 data/2026-09-30.json，產生口播稿（可以手動改 narration / highlights）
npx tsx scripts/export-scenes.ts data/2026-09-30.json build/2026-09-30/scenes.json

# 2) Gemini TTS（整支只呼叫 1 次 API，再依停頓切場景）→ public/2026-09-30/voice.wav + build/2026-09-30/props.json
export GEMINI_API_KEY=你的key
python scripts/gemini_tts.py build/2026-09-30/scenes.json

# 3) 渲染
node render.mjs build/2026-09-30/props.json out/2026-09-30.mp4
```

只想先看畫面，可以跳過第 2 步：`node render.mjs data/2026-09-30.json out/preview.mp4`（無聲、時長用字數估計）。

## 每天出片（自動）
由 [ig-auto-post](https://github.com/gagahsu/ig-auto-post) 的 `post-reel-to-ig.yml` 負責：讀 Gmail 裡的 `IG_BRIEFING_PAYLOAD` 信 → checkout 本 repo 跑上面 1～3 步 → 上傳影片 → 發布 IG Reels。
本 repo 只放產生影片的程式，不碰 Gmail 與 Instagram。

## 常用調整
| 想改 | 位置 |
|---|---|
| 某一句唸錯 / 語氣不對 | 改 `scenes.json` 該場景 narration，重跑 `gemini_tts.py`（整段重錄，用 1 次額度） |
| 切分位置不準 | 不用重錄：`gemini_tts.py ... --reuse` 只重新切分；或先用 `--dry-run` 測流程 |
| 聲音、語氣 | 環境變數 `GEMINI_TTS_VOICE`（Kore、Aoede、Leda…）、`GEMINI_TTS_STYLE` |
| TTS 模型 | `GEMINI_TTS_MODEL`（預設 gemini-3.8-flash-tts） |
| 品牌名、配色、免責聲明 | `src/theme.ts` |
| 背景音樂 | 檔案放 `public/`，props.json 加 `"bgm": "bgm.mp3"` |
| 口播模板、場景順序 | `src/buildScenes.ts` |
| 單格截圖檢查 | `node render.mjs build/…/props.json out/x.png --still=300` |

## 注意
- 焦點族群與關鍵點位是用正規表達式解析 `groups_note` 自由文字；解析不到時這兩個場景會略過，`export-scenes` 會印出警告（GitHub Actions 上顯示為黃色 warning）。
- 片尾與底部已固定放免責聲明，右上角固定標示「AI 自動生成」，不要拿掉。
