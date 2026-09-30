"""
整支口播只呼叫一次 Gemini TTS（省額度），再依靜音停頓切回每個場景，並產生 Remotion 用的 props.json。

用法：
  export GEMINI_API_KEY=...
  python scripts/gemini_tts.py build/2026-09-30/scenes.json
  python scripts/gemini_tts.py build/2026-09-30/scenes.json --dry-run   # 不呼叫 API，用合成音測流程
  python scripts/gemini_tts.py build/2026-09-30/scenes.json --reuse     # 不呼叫 API，沿用已存在的 voice.wav 重新切分

輸出：
  public/2026-09-30/voice.wav     整段語音（Remotion 播放、Colab 對嘴都用這個）
  build/2026-09-30/props.json     node render.mjs 直接吃這個

切分方式：場景之間以空行分隔；回來的音訊找出最長的靜音停頓當作場景邊界
（以字數比例估計的位置為準，附近找不到停頓就直接用估計位置，並印出警告）。
限流或失敗時不會自動重試，避免白白消耗每日額度；voice.wav 在 API 成功後立刻寫檔。

環境變數（選填）：
  GEMINI_TTS_MODEL  預設 gemini-3.8-flash-tts
  GEMINI_TTS_VOICE  預設 Kore
  GEMINI_TTS_STYLE  語氣描述
"""
import argparse, base64, io, json, math, os, sys, wave
from array import array
from pathlib import Path

SR = 24000
WIN = 0.02        # 靜音偵測視窗（秒）
MIN_GAP = 0.2     # 至少這麼長的靜音才算場景停頓（秒）
MODEL = os.getenv("GEMINI_TTS_MODEL", "gemini-3.8-flash-tts")
VOICE = os.getenv("GEMINI_TTS_VOICE", "Kore")
STYLE = os.getenv(
    "GEMINI_TTS_STYLE",
    "台灣口音的年輕女性財經主播，用台灣繁體中文的自然發音，語氣專業、明快、有精神，語速偏快但咬字清楚，數字要唸得清楚，每段之間自然停頓",
)


def pcm_from_bytes(b: bytes) -> bytes:
    """API 可能回 WAV（有 RIFF 標頭）或 raw L16 PCM；統一轉成 24k mono 16-bit PCM。"""
    if b[:4] == b"RIFF":
        with wave.open(io.BytesIO(b)) as w:
            assert w.getsampwidth() == 2 and w.getnchannels() == 1, "預期 16-bit mono"
            if w.getframerate() != SR:
                sys.exit(f"取樣率 {w.getframerate()} ≠ {SR}，請調整 SR")
            return w.readframes(w.getnframes())
    return b


def tts(client, text: str) -> bytes:
    # 新版 API（2026 文件）：interactions.create
    try:
        it = client.interactions.create(
            model=MODEL,
            input=[{"type": "user_input", "content": [{
                "type": "text", "text": text,
                "annotations": [{"type": "speech_metadata", "style": STYLE}],
            }]}],
            response_format={"type": "audio"},
            generation_config={"speech_config": [{"voice": VOICE}]},
        )
        return pcm_from_bytes(base64.b64decode(it.output_audio.data))
    except AttributeError:
        pass  # SDK 太舊沒有 interactions → 退回 generate_content
    from google.genai import types
    r = client.models.generate_content(
        model=MODEL,
        contents=f"{STYLE}：{text}",
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE))),
        ),
    )
    return pcm_from_bytes(r.candidates[0].content.parts[0].inline_data.data)


def write_wav(p: Path, pcm: bytes):
    p.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(p), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm)


def read_wav(p: Path) -> bytes:
    with wave.open(str(p)) as w:
        return w.readframes(w.getnframes())


def weight(text: str) -> int:
    return max(1, len([c for c in text if c not in "，。、！？： \n"]))


def silent_runs(pcm: bytes):
    """回傳 [(起點秒, 終點秒)]：長度 ≥ MIN_GAP 的靜音區間。"""
    s = array("h"); s.frombytes(pcm[: len(pcm) // 2 * 2])
    n = int(SR * WIN)
    rms = []
    for i in range(0, len(s) - n + 1, n):
        seg = s[i:i + n:4]  # 每 4 點取 1 點，夠用
        rms.append(math.sqrt(sum(x * x for x in seg) / len(seg)))
    if not rms:
        return []
    peak = sorted(rms)[int(len(rms) * 0.95)]
    thr = max(peak * 0.05, 30)
    runs, start = [], None
    for i, r in enumerate(rms + [1e9]):
        if r < thr and start is None:
            start = i
        elif r >= thr and start is not None:
            if (i - start) * WIN >= MIN_GAP:
                runs.append((start * WIN, i * WIN))
            start = None
    return runs


def split_points(pcm: bytes, weights: list[int]):
    """回傳 (邊界秒數 list, 使用估計位置的邊界索引 list)。"""
    total = len(pcm) / 2 / SR
    runs = [(a, b) for a, b in silent_runs(pcm) if a > 0.05 and b < total - 0.05]  # 去掉開頭與結尾的靜音
    tw = sum(weights)
    cuts, fallback, acc, prev = [], [], 0, 0.0
    for k, w in enumerate(weights[:-1]):
        acc += w
        expect = total * acc / tw
        window = max(2.0, total * 0.08)
        # 分數 = 停頓長度 - 離估計位置的距離懲罰：偏好長停頓，但不要跑太遠
        cands = [((b - a) - 0.15 * abs((a + b) / 2 - expect), (a + b) / 2) for a, b in runs
                 if abs((a + b) / 2 - expect) <= window and (a + b) / 2 > prev + 0.5]
        if cands:
            t = max(cands)[1]
        else:
            t = max(expect, prev + 0.5); fallback.append(k)
        cuts.append(t); prev = t
    return cuts, fallback


def fake_speech(scenes) -> bytes:
    """dry-run：每場景一段正弦波 + 0.4 秒靜音，用來測切分。"""
    out = array("h")
    for s in scenes:
        n = int(SR * max(2.0, weight(s["narration"]) / 5.4))
        out.extend(int(8000 * math.sin(2 * math.pi * 220 * i / SR)) for i in range(n))
        out.extend([0] * int(SR * 0.4))
    return out.tobytes()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scenes_json")
    ap.add_argument("--dry-run", action="store_true", help="不呼叫 API，用合成音測流程")
    ap.add_argument("--reuse", action="store_true", help="不呼叫 API，沿用已存在的 voice.wav 重新切分並產生 props（例如放入 host.mp4 之後）")
    a = ap.parse_args()

    src = Path(a.scenes_json)
    data = json.loads(src.read_text("utf-8"))
    scenes = data["scenes"]
    date = data["briefing"]["date"].replace(".", "-")
    pub = Path("public") / date
    voice = pub / "voice.wav"

    if a.dry_run:
        pcm = fake_speech(scenes)
    elif a.reuse:
        if not voice.exists():
            sys.exit(f"找不到 {voice}，請先不加 --reuse 跑一次")
        pcm = read_wav(voice)
    else:
        from google import genai
        client = genai.Client()  # 讀 GEMINI_API_KEY
        text = "\n\n".join(s["narration"] for s in scenes)
        print(f"呼叫 Gemini TTS 一次（{len(scenes)} 個場景，{len(text)} 字，model={MODEL}, voice={VOICE}）…")
        try:
            pcm = tts(client, text)
        except Exception as e:
            sys.exit(f"TTS 失敗（不自動重試）：{e.__class__.__name__}: {e}")
    if not a.reuse:
        write_wav(voice, pcm)  # 先存檔，之後切分出問題也不用再花額度

    cuts, fallback = split_points(pcm, [weight(s["narration"]) for s in scenes])
    total = len(pcm) / 2 / SR
    edges = [0.0] + cuts + [total]
    durations = [round(edges[i + 1] - edges[i], 3) for i in range(len(scenes))]
    for i, s in enumerate(scenes):
        print(f"{s['id']:<8} {durations[i]:5.2f}s  {s['narration']}")
    if fallback:
        names = "、".join(scenes[k]["id"] + "→" + scenes[k + 1]["id"] for k in fallback)
        print(f"\n⚠ 這些邊界找不到停頓，用字數比例估計：{names}（請對照影片檢查字幕是否對得上）")

    props = {
        "briefing": data["briefing"],
        "scenes": scenes,
        "tts": {"audio": f"{date}/voice.wav", "durations": durations},
    }
    host = pub / "host.mp4"
    if host.exists():
        props["hostVideo"] = f"{date}/host.mp4"
    out = src.parent / "props.json"
    out.write_text(json.dumps(props, ensure_ascii=False, indent=2), "utf-8")
    print(f"\n總長 {total:.1f}s → {voice}\nprops → {out}" + ("" if host.exists() else "\n（尚無 host.mp4，主持人會用剪影；對嘴影片放到 " + str(host) + " 後加 --reuse 重跑一次即可）"))


if __name__ == "__main__":
    main()
