# Registra a tarefa do Windows que faz a copia diaria. Se o computador estiver desligado no horario,
# a tarefa roda assim que possivel. Roda com a sua conta (a senha guardada so abre com ela).
[CmdletBinding()]
param(
    [string]$Base = 'D:\Backups\ViaObras',
    [string]$Horario = '12:00'
)
$ErrorActionPreference = 'Stop'

$destino = Join-Path $Base 'ferramentas\viaobras-copia-pc.ps1'
if (-not (Test-Path -LiteralPath $destino)) { throw "Copie o script para $destino antes de agendar." }

$acao = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$destino`" -Base `"$Base`""
$gatilhos = @(
    (New-ScheduledTaskTrigger -Daily -At $Horario),
    (New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME")
)
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'ViaObras - copia do backup' -Action $acao -Trigger $gatilhos -Settings $ajustes -Force | Out-Null
Write-Host 'Tarefa registrada: ViaObras - copia do backup'
