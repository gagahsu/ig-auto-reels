# 全自動化計畫：每日 Reels（討論紀錄 + 待辦）

最後更新：2026-10-01。這份文件記錄討論結論與待辦，供新 session 接續。標示「未驗證」的內容是推估或第三方資料，實作前要實測。

## 目標

每天盤前自動產出並發布台股盤前速報 Reels，人工只做最後確認。

## 現況

- 原始資料：Gemini Spark 抓取並寄到 Gmail，執行時間不固定（痛點）。手動轉成 `data/<date>.json`。
- 每日手動 5 步：`export-scenes` → `gemini_tts.py` → 對嘴（Colab）→ `gemini_tts.py --reuse` → `render.mjs`。
- 待機影片（Flow 手動生成）：目前只有根目錄 `host_idle.mp4`（720×1280、8 秒）；`looks/` 輪替機制已在 Colab notebook 中，本機尚未建立 `looks/`。
- 本機硬體：Intel Core Ultra 5 225U、內顯、RAM 31GB，**無 NVIDIA GPU，不能本機跑 MuseTalk**。

## 已決定 / 已確認的事實

| 主題 | 結論 |
|---|---|
| 本機跑 MuseTalk | 不可行，需 CUDA GPU |
| Colab 自動化 | 無官方觸發 API，免費版會斷線；改用 Modal |
| Flow API | **沒有官方 API**。替代：Gemini API 的 Veo 3.1 / Nano Banana（計費，單價未查）、第三方 useapi.net（非官方，有帳號風險）、Playwright（脆弱） |
| 待機影片策略 | 建議一次生成 10～14 支放進 `looks/`，依日期輪替，1～2 週補一批；不要每天重新生成 |
| Meta Muse（AI 代理） | 消費型助理，不適合串此流程 |
| Modal | serverless GPU，按秒計費。官網 Starter：$0/月 + 每月 $30 免費額度。**沒綁卡只有 $1，且任何 GPU 函式都要先綁卡**（已實測：`Please add a payment method to use A10G GPU functions.`） |
| Modal 映像檔 | **已成功建好**（127 秒），torch 2.0.1+cu118、mmcv、mmpose 等相依都裝成功；綁卡後用快取 |
| 成本估算（未實測） | 每支約 $0.1～0.2（A10G 5～10 分鐘），每月約 $3～6，在免費額度內 |
| 資料來源改用 Claude Code CLI | 可行：`claude -p` 搭配工作排程器，取代 Gmail 步驟 |
| 硬數字 vs 判斷內容 | 硬數字（期貨、美股、ADR、匯率、加權指數）用程式抓，Claude 只負責新聞挑選、族群與點位說明 |
| 定時開機 | 用睡眠 + 工作排程器「喚醒電腦以執行此工作」，不要整夜開機；完全關機的 BIOS RTC Alarm 筆電通常沒有，未確認 |

## 目標架構

```
排程器 (Windows Task Scheduler，睡眠喚醒)
  1. fetch_numbers.py   硬數字（證交所/期交所 OpenAPI、yfinance），失敗就停止並通知
  2. claude -p          新聞、焦點族群、點位說明，輸入為上一步的數字
  3. build_briefing.py  合併 + 驗證 + 由程式組出 caption → data/<date>.json
  4. export-scenes → gemini_tts.py（口播與語音）
  5. modal run scripts/modal_lipsync.py --date <date>   （GPU 對嘴 → public/<date>/host.mp4）
  6. gemini_tts.py --reuse → render.mjs
  7. 通知使用者確認（發布前人工確認關卡）
  8. 發布 IG Reels
```

## 資料來源調查（A 類硬數字）

| 資料 | 來源 | 穩定度 | 備註 |
|---|---|---|---|
| 加權指數昨收 | 證交所 OpenAPI `openapi.twse.com.tw`（免金鑰） | 高 | 9/30 收 47,940.13，與簡報吻合 |
| 台指期夜盤 | 期交所 OpenAPI `openapi.taifex.com.tw`、政府資料開放平臺「期貨每日交易行情」 | 中高 | 有「交易時段」欄位，**夜盤收盤後多久可取得未確認，需實測** |
| 美股四大指數、ADR | `yfinance`（非官方） | 中 | 可能限流或改版；備援來源未查 |
| 新台幣匯率 | 證交所或台灣銀行 | 高 | 端點未查 |
| ADR 溢價率 | 自行計算：ADR ÷ 5 × 匯率 ÷ 台積電收盤 − 1 | 高 | |

排程時間建議：美股約台灣 04:00～05:00 收盤、夜盤 05:00 收盤，故排程設在 06:00～06:30 之後，預留 15～20 分鐘跑完整條流程（未實測）。

## 現有資料格式的風險

1. `groups_note` 是帶 `<br>`、`<strong>` 的 HTML，`src/buildScenes.ts` 的 `parseGroups` 用正規表達式解析；格式一變，焦點族群與關鍵點位場景會**靜默消失**。
2. `groups_note` 內混有硬數字（47,940、48,000、31.852、2,505），模型寫錯不易被驗證抓到；建議拆成獨立欄位由程式填入。
3. `caption` 與其他欄位重複，應由程式組合而非獨立生成，避免不一致。

## IG 發布前置條件（未驗證，需查官方文件）

- Instagram 商業或創作者帳號，綁定 Facebook 粉專，建 Meta 開發者 App。
- Content Publishing API 要求影片放在**公開網址**（可沿用自架圖床或 Cloudflare R2）。
- Access Token 約 60 天，需自動續期。
- 自己的帳號在開發模式是否免審：未重新查證。

## 已完成

- `scripts/modal_lipsync.py`：MuseTalk 搬到 Modal，沿用 notebook 的安裝版本與參數。已通過語法檢查，**尚未在 GPU 上跑過**。指令：
  - 一次性：`python -m modal run scripts/modal_lipsync.py::setup`（下載權重到 Volume）
  - 每天：`python -m modal run scripts/modal_lipsync.py --date <date> [--look <name>]`
- `data/2026-10-01.json`：使用者貼的當日簡報。
- 已在本機 `pip install modal`（1.6.0）。因 Scripts 不在 PATH，需用 `python -m modal`。

## 待辦（依順序）

**使用者要做**
1. 到 Modal 綁定付款方式，並設定每月花費上限（位置以畫面為準）。
2. 確認 `python -m modal setup` 已授權（若未授權）。
3. 準備 `GEMINI_API_KEY`；確認 `pip install google-genai`。
4. （選）用 Flow 生成多支待機影片放進 `looks/`（提示詞見 `docs/host_looks_prompts.md`）。工作區根目錄有一支未追蹤的 `Woman_nodding_in_modern_office_20261001143625.mp4`，疑似待機影片候選。

**階段 1：跑通 Modal**
5. `modal run ...::setup` 下載權重，處理建置/下載錯誤。
6. 用 `host_idle.mp4` + 真實 `voice.wav`（`data/2026-10-01.json`）跑一次完整流程，驗證對嘴品質。
7. 若 `host.mp4` 太大導致函式回傳失敗，改為存進 Volume 再下載。
8. 先跑 `node render.mjs data/2026-10-01.json out/preview.mp4` 預覽版型。

**階段 2：一鍵跑完**
9. 寫 `run_daily` 腳本串起 4～6 步（含重試與失敗通知）。
10. 更新 README 與 CLAUDE.md（Modal 取代 Colab 的流程）。

**階段 3：資料來源自動化**
11. 寫 `fetch_numbers.py`，實測期交所夜盤資料可取得的時間點，找 yfinance 備援。
12. 寫 `docs/briefing_schema.md`、`build_briefing.py`（合併、驗證、組 caption），並評估把 `groups_note` 中的數字拆成結構化欄位。
13. `claude -p` 的提示詞與允許工具設定（新聞、族群、點位說明）。

**階段 4：排程與發布**
14. Windows 工作排程器 + 喚醒計時器；用 2 分鐘後喚醒的測試任務驗證現代待機下是否可靠；設定闔蓋、接電、睡眠選項。
15. 查 Instagram Content Publishing API 官方文件，建 Meta App、公開網址託管、Token 續期。
16. 發布前人工確認機制（通知 + 確認後才發，或逾時自動發）。
17. 先發到測試帳號，再切正式帳號。

## 未決問題

- 是否要每天重新生成待機影片（Veo / Nano Banana API）？目前建議影片池輪替。
- 通知管道：Email 或 LINE？
- 發布確認方式：必須手動確認，或逾時自動發？
- 財經內容的免責聲明已固定在輸出與頁尾，不可移除（見 CLAUDE.md）。
