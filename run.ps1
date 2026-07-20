# EMS Starter Script
# Automatically kills any process locking port 5034 and runs the web app.

Clear-Host
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "          TRACK360 ERP STARTER SCRIPT         " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Checking for existing processes on port 5034..." -ForegroundColor Cyan

$processId = Get-NetTCPConnection -LocalPort 5034 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1

if ($processId) {
    $procName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).Name
    Write-Host "-> Found locked process '$procName' (PID: $processId) on port 5034." -ForegroundColor Yellow
    Write-Host "-> Terminating it to free the port..." -ForegroundColor Yellow
    Stop-Process -Id $processId -Force
    Start-Sleep -Seconds 1
    Write-Host "-> Port 5034 has been successfully freed." -ForegroundColor Green
} else {
    Write-Host "-> Port 5034 is already free." -ForegroundColor Green
}

Write-Host ""
Write-Host "[2/2] Launching the .NET Web Application..." -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Gray
dotnet run --launch-profile http
