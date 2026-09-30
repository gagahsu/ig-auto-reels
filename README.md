# finreels：台股盤前速報 Reels 產生器

盤前速報 JSON → 口播稿 → Gemini TTS → MuseTalk 對嘴主播 → Remotion 合成 1080×1920 Reels。

## 安裝（一次）
```bash
npm install
pip install google-genai
```
需要 Node 20+、Python 3.10+、ffmpeg。Remotion 第一次渲染會自動下載 Chrome headless shell。

## 一次性：做主播
1. **角色照片**：在 Gemini App 用圖片生成，例如：
   > 直式 9:16 寫實照片，台灣年輕女性財經主播，齊肩黑髮，深藍色上衣，半身正面看鏡頭，嘴巴自然閉合，溫暖咖啡廳背景淺景深，柔和均勻光線，手不要擋到臉
   * 必須是原創臉，不要用真人照片或名人參考圖。
2. **待機影片**：把照片丟給 Gemini App 的影片生成（Veo），提示：
   > 讓人物自然地看著鏡頭、輕微點頭與眨眼，嘴巴保持閉合不說話，鏡頭固定，8 秒
3. 下載成 `host_idle.mp4`，上傳到 Google Drive 的 `MyDrive/finreels/`。

之後每天都用同一支待機影片，主播長相就會固定。

## 每天出片
```bash
# 1) JSON 存成 data/2026-09-30.json，產生口播稿（可以手動改 narration / highlights）
npx tsx scripts/export-scenes.ts data/2026-09-30.json build/2026-09-30/scenes.json

# 2) Gemini TTS（整支只呼叫 1 次 API，再依停頓切場景）→ public/2026-09-30/voice.wav + build/2026-09-30/props.json
export GEMINI_API_KEY=你的key
python scripts/gemini_tts.py build/2026-09-30/scenes.json

# 3) 對嘴：把 voice.wav 上傳到 Drive 的 finreels/2026-09-30/，
#    在 Colab 開 colab/musetalk_lipsync.ipynb，改 DATE 後執行，
#    下載 host.mp4 放到 public/2026-09-30/host.mp4

# 4) 把主播接進 props（沿用已錄好的語音，不再呼叫 TTS），然後渲染
python scripts/gemini_tts.py build/2026-09-30/scenes.json --reuse
node render.mjs build/2026-09-30/props.json out/2026-09-30.mp4
```

只想先看畫面，可以跳過第 2、3 步：`node render.mjs data/2026-09-30.json out/preview.mp4`（無聲、剪影主播）。

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

## 發布前
- IG 發文時開啟「AI 生成」標籤。
- 片尾與底部已固定放免責聲明，不要拿掉。
