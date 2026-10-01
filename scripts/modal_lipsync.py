"""MuseTalk lip-sync on Modal (replaces colab/musetalk_lipsync.ipynb).

One-time:   modal run scripts/modal_lipsync.py::setup        (downloads model weights into a Volume)
Per day:    modal run scripts/modal_lipsync.py --date 2026-10-01 [--look look02_white-office]

Reads  public/<date>/voice.wav  and an idle clip (looks/*.mp4 rotated by date, else host_idle.mp4),
writes public/<date>/host.mp4.
"""
import datetime
import os
import subprocess
import tempfile

import modal

app = modal.App("finreels-musetalk")
weights = modal.Volume.from_name("finreels-musetalk-weights", create_if_missing=True)

PIP = "pip install -q"
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "ffmpeg", "libgl1", "libglib2.0-0", "build-essential")
    .run_commands(
        "git clone -q https://github.com/TMElyralab/MuseTalk.git /root/MuseTalk",
        f"{PIP} torch==2.0.1 torchvision==0.15.2 torchaudio==2.0.2 --index-url https://download.pytorch.org/whl/cu118",
        f"cd /root/MuseTalk && {PIP} -r requirements.txt",
        f'{PIP} openmim "setuptools<70" wheel mmengine',
        f'{PIP} "mmcv==2.0.1" -f https://download.openmmlab.com/mmcv/dist/cu118/torch2.0/index.html',
        f'{PIP} --no-build-isolation chumpy==0.70',
        f'{PIP} "mmdet==3.1.0" "mmpose==1.1.0" gdown',
        f'{PIP} "huggingface_hub==0.30.2" "numpy==1.23.5" "setuptools<70"',
    )
)

MUSETALK = "/root/MuseTalk"
NEED = (
    "musetalk/pytorch_model.bin musetalkV15/unet.pth musetalkV15/musetalk.json "
    "sd-vae/diffusion_pytorch_model.bin whisper/pytorch_model.bin dwpose/dw-ll_ucoco_384.pth "
    "syncnet/latentsync_syncnet.pt face-parse-bisent/79999_iter.pth face-parse-bisent/resnet18-5c106cde.pth"
).split()


def link_models():
    """Point MuseTalk/models at the persistent weights Volume."""
    subprocess.run(["rm", "-rf", f"{MUSETALK}/models"], check=True)
    os.symlink("/weights", f"{MUSETALK}/models")


@app.function(image=image, volumes={"/weights": weights}, timeout=1800)
def download_weights():
    link_models()
    def ok(f):
        return os.path.exists(f"/weights/{f}") and os.path.getsize(f"/weights/{f}") > 0

    if not all(ok(f) for f in NEED):
        # Same patches as the Colab notebook: drop pip install / HF mirror, use positional gdown id.
        script = subprocess.run(
            ["sed", "-e", "/^pip install/d", "-e", "/HF_ENDPOINT/d", "-e", "s/gdown --id /gdown /",
             "download_weights.sh"],
            cwd=MUSETALK, check=True, capture_output=True, text=True,
        ).stdout
        open("/tmp/dw.sh", "w").write(script)
        subprocess.run(["bash", "/tmp/dw.sh"], cwd=MUSETALK)  # no check: fallbacks below
        if not ok("face-parse-bisent/resnet18-5c106cde.pth"):
            os.makedirs("/weights/face-parse-bisent", exist_ok=True)
            import urllib.request
            urllib.request.urlretrieve("https://download.pytorch.org/models/resnet18-5c106cde.pth",
                                       "/weights/face-parse-bisent/resnet18-5c106cde.pth")
    still = [f for f in NEED if not ok(f)]
    assert not still, f"weights still missing: {still}"
    weights.commit()
    print("weights ok:", len(NEED), "files")


@app.function(image=image, gpu="A10G", volumes={"/weights": weights}, timeout=1800)
def lipsync(idle: bytes, voice: bytes) -> bytes:
    link_models()
    work = tempfile.mkdtemp()
    open(f"{work}/idle_raw.mp4", "wb").write(idle)
    open(f"{work}/voice_raw.wav", "wb").write(voice)
    # idle -> 25fps, no audio; voice -> 16k mono (same as the notebook)
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", f"{work}/idle_raw.mp4", "-r", "25",
                    "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", f"{work}/idle.mp4"], check=True)
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", f"{work}/voice_raw.wav",
                    "-ar", "16000", "-ac", "1", f"{work}/voice.wav"], check=True)
    open(f"{work}/task.yaml", "w").write(
        f'task_0:\n  video_path: "{work}/idle.mp4"\n  audio_path: "{work}/voice.wav"\n'
    )
    subprocess.run(
        ["python", "-m", "scripts.inference",
         "--inference_config", f"{work}/task.yaml", "--result_dir", f"{work}/out",
         "--unet_model_path", "models/musetalkV15/unet.pth",
         "--unet_config", "models/musetalkV15/musetalk.json",
         "--version", "v15", "--ffmpeg_path", "/usr/bin"],
        cwd=MUSETALK, check=True, stdin=subprocess.DEVNULL,
        env={**os.environ, "MPLBACKEND": "Agg"},
    )
    outs = sorted(
        os.path.join(r, f) for r, _, fs in os.walk(f"{work}/out") for f in fs if f.endswith(".mp4")
    )
    assert outs, "MuseTalk produced no mp4"
    return open(outs[0], "rb").read()


def pick_idle(date: str, look: str) -> str:
    looks_dir = "looks"
    looks = sorted(f for f in os.listdir(looks_dir) if f.lower().endswith(".mp4")) if os.path.isdir(looks_dir) else []
    if look:
        name = look if look.lower().endswith(".mp4") else look + ".mp4"
        assert name in looks, f"{name} not in looks/: {looks}"
        return f"{looks_dir}/{name}"
    if looks:
        # same rotation as the Colab notebook: ordinal % count, stable for a given date
        return f"{looks_dir}/" + looks[datetime.date.fromisoformat(date).toordinal() % len(looks)]
    assert os.path.exists("host_idle.mp4"), "no looks/ and no host_idle.mp4"
    return "host_idle.mp4"


@app.local_entrypoint()
def setup():
    download_weights.remote()


@app.local_entrypoint()
def main(date: str, look: str = ""):
    voice_path = f"public/{date}/voice.wav"
    assert os.path.exists(voice_path), f"missing {voice_path} (run gemini_tts.py first)"
    idle_path = pick_idle(date, look)
    print(f"idle: {idle_path}\nvoice: {voice_path}")
    out = lipsync.remote(open(idle_path, "rb").read(), open(voice_path, "rb").read())
    dest = f"public/{date}/host.mp4"
    open(dest, "wb").write(out)
    print(f"wrote {dest} ({len(out) / 1e6:.1f} MB)")
