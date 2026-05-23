#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ -f ".venv/bin/activate" ]; then
  source ".venv/bin/activate"
fi

python3 -m uvicorn api_server:app --host 0.0.0.0 --port 8001 --reload
