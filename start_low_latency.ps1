$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host "Cleaning old Streamlit sessions for this project..."
$escapedRoot = [Regex]::Escape($projectRoot)
Get-CimInstance Win32_Process |
    Where-Object {
        $_.Name -like "python*" -and
        $_.CommandLine -like "*streamlit*" -and
        $_.CommandLine -like "*app.py*" -and
        $_.CommandLine -match $escapedRoot
    } |
    ForEach-Object {
        try {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
            Write-Host "Stopped PID $($_.ProcessId)"
        } catch {
            Write-Host "Skipped PID $($_.ProcessId): $($_.Exception.Message)"
        }
    }

Start-Sleep -Seconds 1

if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    . .\.venv\Scripts\Activate.ps1
}

$env:PYTHONIOENCODING = "utf-8"
$env:STREAMLIT_BROWSER_GATHER_USAGE_STATS = "false"

Write-Host "Starting AI Fitness Coach at http://localhost:8501"
streamlit run app.py --server.port 8501 --server.headless true
