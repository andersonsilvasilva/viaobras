# Mostra a senha do backup para voce guarda-la no cofre de senhas.
# Rode voce mesmo, em uma janela sua do PowerShell, sem ninguem olhando e sem gravar a tela.
# Nao copie a saida para conversas, documentos ou e-mails. Feche a janela depois.
[CmdletBinding()]
param([string]$Base = 'D:\Backups\ViaObras')
$ErrorActionPreference = 'Stop'

$segura = Import-Clixml -LiteralPath (Join-Path $Base 'config\senha.dpapi')
Read-Host 'A senha vai aparecer na tela. Pressione Enter para mostrar' | Out-Null
Write-Host (New-Object Net.NetworkCredential('', $segura)).Password
Read-Host 'Depois de salvar no cofre, pressione Enter para limpar a tela' | Out-Null
Clear-Host
