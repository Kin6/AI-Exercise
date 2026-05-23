$ErrorActionPreference = "Stop"

if (Test-Path -LiteralPath ".\.venv\Scripts\Activate.ps1") {
  . .\.venv\Scripts\Activate.ps1
}

python -m uvicorn api_server:app --host 127.0.0.1 --port 8001 --reload
