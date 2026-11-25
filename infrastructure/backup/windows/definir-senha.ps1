# Guarda a senha do repositorio de backup, cifrada pela sua conta do Windows (DPAPI).
# Rode voce mesmo, em uma janela do PowerShell. A senha nao aparece na tela nem fica no historico.
# Guarde uma copia dela TAMBEM em um cofre de senhas, fora deste computador e do servidor.
[CmdletBinding()]
param([string]$Base = 'D:\Backups\ViaObras')
$ErrorActionPreference = 'Stop'

$config = Join-Path $Base 'config'
New-Item -ItemType Directory -Force -Path $config | Out-Null
$primeira = Read-Host -AsSecureString 'Senha do repositorio de backup'
$segunda = Read-Host -AsSecureString 'Repita a senha'
$a = (New-Object Net.NetworkCredential('', $primeira)).Password
$b = (New-Object Net.NetworkCredential('', $segunda)).Password
if ($a -cne $b) { throw 'As senhas nao conferem.' }
if ($a.Length -lt 20) { throw 'Use pelo menos 20 caracteres (um gerador de senhas ajuda).' }
$primeira | Export-Clixml -LiteralPath (Join-Path $config 'senha.dpapi')
Write-Host 'Senha guardada. So a sua conta do Windows, neste computador, consegue le-la.'
