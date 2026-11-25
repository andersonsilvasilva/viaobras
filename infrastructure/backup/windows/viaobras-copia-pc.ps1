# Segunda copia do backup do ViaObras, neste computador (documentation/BACKUP_MODELO.md, 4.2).
# O computador BUSCA as copias no Google Drive; o servidor nao tem acesso a este computador.
# A copia so acrescenta: apagar no Drive nao apaga aqui.
#
# (arquivo sem acentos de proposito: o Windows PowerShell 5.1 le UTF-8 sem BOM como ANSI)
[CmdletBinding()]
param(
    [string]$Base = 'D:\Backups\ViaObras',
    [string]$Origem = 'rclone:gdrive:viaobras-backup',
    [string]$Restic = '',
    [string]$HostDaCopia = 'viaobras-vps',
    [int]$MaximoDeCopiasNovas = 60,
    [switch]$Iniciar
)
$ErrorActionPreference = 'Stop'

$repositorio = Join-Path $Base 'repositorio'
$config = Join-Path $Base 'config'
$arquivoSenha = Join-Path $config 'senha.dpapi'
$arquivoMonitor = Join-Path $config 'monitor.txt'
$marcaVerificacao = Join-Path $config 'ultima-verificacao.txt'
# enquanto existir, nada e apagado. So uma pessoa remove, depois de conferir.
$marcaAlerta = Join-Path $config 'ALERTA.txt'
# tudo o que ja foi visto no Drive. A retencao daqui apaga copias que o Drive ainda tem: elas voltam a ser
# copiadas e nao podem contar como novidade.
$arquivoVistas = Join-Path $config 'vistas.txt'
$log = Join-Path $Base 'copia.log'
if (-not $Restic) { $Restic = Join-Path $Base 'ferramentas\restic.exe' }

function Write-Registro([string]$Texto) {
    $linha = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'), $Texto
    Write-Output $linha
    if (Test-Path -LiteralPath $Base) { Add-Content -LiteralPath $log -Value $linha -Encoding utf8 }
}

function Assert-DestinoSeguro([string]$Caminho) {
    $completo = [IO.Path]::GetFullPath($Caminho)
    if ($env:OneDrive -and $completo.StartsWith($env:OneDrive, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'A pasta de destino esta dentro do OneDrive: uma exclusao se propagaria.'
    }
    if ($completo -match '(?i)\\(Google Drive|Meu Drive|My Drive|Dropbox|OneDrive[^\\]*)(\\|$)') {
        throw 'A pasta de destino parece sincronizada: escolha outra.'
    }
    $pasta = $completo
    while ($pasta) {
        if (Test-Path -LiteralPath (Join-Path $pasta '.git')) { throw 'A pasta de destino esta dentro de um projeto Git.' }
        $pasta = Split-Path -Path $pasta -Parent
    }
}

function Invoke-Restic([string[]]$Argumentos) {
    & $Restic @Argumentos
    if ($LASTEXITCODE -ne 0) { throw "restic $($Argumentos[0]) falhou (codigo $LASTEXITCODE)" }
}

function ConvertTo-Data($Valor) {
    return [DateTimeOffset]::Parse([string]$Valor, [Globalization.CultureInfo]::InvariantCulture)
}

function Get-Copias([string]$Repo) {
    $saida = & $Restic -r $Repo snapshots --json --host $HostDaCopia --tag viaobras
    if ($LASTEXITCODE -ne 0) { throw "nao foi possivel listar as copias (codigo $LASTEXITCODE)" }
    $lista = ($saida -join "`n") | ConvertFrom-Json
    return @($lista | Where-Object { $_ })
}

$trava = New-Object Threading.Mutex($false, 'ViaObrasCopiaBackup')
if (-not $trava.WaitOne(0)) { Write-Output 'outra copia em andamento'; exit 3 }
try {
    Assert-DestinoSeguro $Base
    if (-not (Test-Path -LiteralPath $Restic)) { throw "restic nao encontrado em $Restic" }
    if (-not (Test-Path -LiteralPath $arquivoSenha)) { throw 'senha nao definida: rode definir-senha.ps1' }

    # a senha fica cifrada pela conta do Windows e so existe em claro na memoria deste processo
    $segura = Import-Clixml -LiteralPath $arquivoSenha
    $senha = (New-Object Net.NetworkCredential('', $segura)).Password
    $env:RESTIC_PASSWORD = $senha
    $env:RESTIC_FROM_PASSWORD = $senha
    $rcloneConf = Join-Path $config 'rclone.conf'
    if (Test-Path -LiteralPath $rcloneConf) { $env:RCLONE_CONFIG = $rcloneConf }
    $env:Path = (Split-Path -Path $Restic -Parent) + ';' + $env:Path

    if ($Iniciar) {
        Invoke-Restic @('-r', $repositorio, 'init', '--from-repo', $Origem, '--copy-chunker-params')
        Write-Registro 'repositorio local criado'
        exit 0
    }

    $anteriores = @(Get-Copias $repositorio)
    $antes = $anteriores.Count
    # origem vazia com copias aqui: alguem apagou no Drive (ou o destino mudou). Avisar ja, sem apagar nada.
    if ($antes -gt 0 -and @(Get-Copias $Origem).Count -eq 0) {
        throw 'ALERTA: o Google Drive esta sem nenhuma copia, mas este computador tem. Nada foi apagado. Confira o Drive e o servidor.'
    }
    Write-Registro 'copiando do Google Drive'
    Invoke-Restic @('-r', $repositorio, 'copy', '--quiet', '--from-repo', $Origem, '--host', $HostDaCopia, '--tag', 'viaobras')
    $copias = @(Get-Copias $repositorio)
    if ($copias.Count -eq 0) { throw 'nenhuma copia no repositorio local' }
    $vistas = New-Object 'System.Collections.Generic.HashSet[string]'
    if (Test-Path -LiteralPath $arquivoVistas) {
        foreach ($id in Get-Content -LiteralPath $arquivoVistas) { [void]$vistas.Add($id) }
    }
    $naOrigem = @(Get-Copias $Origem)
    $recebidas = @($naOrigem | Where-Object { -not $vistas.Contains([string]$_.id) })
    $novas = $recebidas.Count
    $datas = @($copias | ForEach-Object { ConvertTo-Data $_.time })
    $maisRecente = ($datas | Sort-Object -Descending | Select-Object -First 1)
    Write-Registro ('copias novas: {0}; total: {1}; mais recente: {2:yyyy-MM-dd HH:mm} UTC' -f $novas, $copias.Count, $maisRecente.UtcDateTime)

    # Quem tivesse acesso ao Drive poderia criar copias falsas para a retencao descartar as verdadeiras:
    # com data no futuro, com data antiga (tomando o lugar das diarias e mensais) ou em grande quantidade.
    $noFuturo = @($datas | Where-Object { $_ -gt [DateTimeOffset]::UtcNow.AddHours(2) }).Count
    $retroativas = 0
    if ($antes -gt 0) {
        $ultimaAnterior = ($anteriores | ForEach-Object { ConvertTo-Data $_.time } | Sort-Object -Descending | Select-Object -First 1)
        $retroativas = @($recebidas | Where-Object { (ConvertTo-Data $_.time) -lt $ultimaAnterior }).Count
    }
    if ($noFuturo -gt 0 -or $retroativas -gt 0 -or ($antes -gt 0 -and $novas -gt $MaximoDeCopiasNovas)) {
        $motivo = "novas: $novas; com data no futuro: $noFuturo; com data antiga: $retroativas"
        Set-Content -LiteralPath $marcaAlerta -Value ('{0} copias suspeitas ({1})' -f (Get-Date -Format 's'), $motivo) -Encoding utf8
    }
    # grava depois da marca de alerta: se parar no meio, a conferencia se repete na proxima vez
    foreach ($copia in $naOrigem) { [void]$vistas.Add([string]$copia.id) }
    Set-Content -LiteralPath $arquivoVistas -Value @($vistas) -Encoding ascii
    if (Test-Path -LiteralPath $marcaAlerta) {
        throw "ALERTA: $((Get-Content -LiteralPath $marcaAlerta -TotalCount 1)). Nada sera apagado ate voce conferir e remover $marcaAlerta"
    }
    if (([DateTimeOffset]::UtcNow - $maisRecente).TotalHours -gt 48) {
        throw 'a copia mais recente tem mais de 48 horas: o backup do servidor pode ter parado'
    }

    Invoke-Restic @('-r', $repositorio, 'forget', '--quiet', '--host', $HostDaCopia, '--tag', 'viaobras', '--group-by', 'host,tags',
        '--keep-within', '48h', '--keep-daily', '7', '--keep-weekly', '4', '--keep-monthly', '6', '--prune')

    $verificar = -not (Test-Path -LiteralPath $marcaVerificacao)
    if (-not $verificar) { $verificar = ((Get-Date) - (Get-Item -LiteralPath $marcaVerificacao).LastWriteTime).TotalDays -ge 30 }
    if ($verificar) {
        Write-Registro 'conferencia mensal: lendo todos os dados'
        Invoke-Restic @('-r', $repositorio, 'check', '--quiet', '--read-data')
        Set-Content -LiteralPath $marcaVerificacao -Value (Get-Date -Format 's') -Encoding utf8
    }

    Write-Registro 'copia concluida'
    if (Test-Path -LiteralPath $arquivoMonitor) {
        $url = (Get-Content -LiteralPath $arquivoMonitor -TotalCount 1).Trim()
        if ($url) {
            try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20 | Out-Null }
            catch { Write-Registro 'aviso ao monitor nao foi entregue' }
        }
    }
    exit 0
}
catch {
    Write-Registro "FALHOU: $($_.Exception.Message)"
    exit 1
}
finally {
    Remove-Item Env:RESTIC_PASSWORD, Env:RESTIC_FROM_PASSWORD -ErrorAction SilentlyContinue
    $trava.ReleaseMutex()
}
