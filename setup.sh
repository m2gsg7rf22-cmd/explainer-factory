#!/usr/bin/env bash
# One-time setup (macOS or Linux). Everything installed here is free / open source. After this, nothing needs a subscription or an account.
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node 20+ first (brew install node)"; exit 1; }
command -v python3 >/dev/null || { echo "Install Python 3.10+ first"; exit 1; }
if ! command -v ffmpeg >/dev/null; then
  if command -v brew >/dev/null; then brew install ffmpeg; else sudo apt-get update && sudo apt-get install -y ffmpeg; fi
fi
npm install
npx playwright install chromium
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
mkdir -p models/kokoro out
[ -f models/kokoro/kokoro-v1.0.onnx ] || curl -L -o models/kokoro/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
[ -f models/kokoro/voices-v1.0.bin ]  || curl -L -o models/kokoro/voices-v1.0.bin  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
echo
echo "Setup done.  Next:"
echo "  source .venv/bin/activate"
echo "  python run.py make storyboards/dishwasher.json     # test video -> out/videos/"
echo "  python run.py ig-login                             # log in to Instagram once (see README)"
echo "  python run.py serve                                # 3 videos/day, forever"
echo "  python run.py install-service                      # start automatically at every login/boot"
echo "Optional unlimited topics: install Ollama (https://ollama.com), 'ollama pull qwen2.5:14b-instruct', set llm.enabled: true in config.yaml"
