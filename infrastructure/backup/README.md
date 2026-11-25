# Backup da produção do ViaObras: instalação

Modelo aprovado: [BACKUP_MODELO.md](../../documentation/BACKUP_MODELO.md) (D-P122…D-P129). Restauração: [BACKUP_RESTAURACAO.md](../../documentation/BACKUP_RESTAURACAO.md).

| Arquivo | Onde roda | O que faz |
|---|---|---|
| `viaobras-backup.sh` | VPS | cópia, retenção e integridade |
| `viaobras-restore-test.sh` | VPS | prova a restauração em um MySQL temporário, sem rede |
| `viaobras-backup.cron` | VPS | agendamento (`/etc/cron.d/viaobras-backup`) |
| `config.exemplo` | VPS | modelo de `/etc/viaobras-backup/config` |
| `windows/viaobras-copia-pc.ps1` | computador | segunda cópia, buscada no Drive |
| `windows/definir-senha.ps1` | computador | guarda a senha, cifrada pela conta do Windows |
| `windows/ver-senha.ps1` | computador | mostra a senha, para guardar no cofre |
| `windows/agendar-copia.ps1` | computador | tarefa diária do Windows |

**Nenhum segredo vai para este repositório, para documentos ou para conversas.** Senha, `client_secret` e `rclone.conf` são digitados ou copiados por você.

## Parte A: o que só o responsável faz

### A1. Senha do repositório
> **Nesta instalação (2026-11-25) a senha já foi gerada** (48 caracteres) e gravada no computador e no servidor, sem ser exibida. Em vez de A1, A5 e A6: rode você mesmo `D:\Backups\ViaObras\ferramentas\ver-senha.ps1`, salve a senha no cofre e feche a janela. O texto abaixo vale para uma instalação nova.

Gere no seu cofre de senhas uma senha aleatória com **pelo menos 32 caracteres** e salve-a lá, com o nome "ViaObras backup". **Sem ela, nenhuma cópia pode ser recuperada.**

### A2. Identificação própria no Google
Na conta que vai receber o backup, com **verificação em duas etapas** ligada. Os nomes dos menus do Google mudam de tempos em tempos; o guia atualizado está em <https://rclone.org/drive/> ("Making your own client_id").

1. No Google Cloud Console, crie um projeto (ex.: `viaobras-backup`) e ative a **Google Drive API**.
2. Configure a tela de consentimento OAuth, público **externo**, e adicione apenas o escopo `.../auth/drive.file`.
3. **Publique o aplicativo** (em modo de teste a autorização expira em 7 dias).
4. Crie uma credencial **ID do cliente OAuth**, tipo **App para computador**. Guarde o ID e a chave secreta no cofre.

### A3. Autorizar o acesso (no computador)
Com o `rclone` em `D:\Backups\ViaObras\ferramentas`, no PowerShell:

```powershell
& 'D:\Backups\ViaObras\ferramentas\rclone.exe' --config 'D:\Backups\ViaObras\config\rclone.conf' config
```

`n` (novo) → nome **`gdrive`** → tipo **drive** → cole o `client_id` e o `client_secret` → escopo **`drive.file`** → demais respostas em branco → autorize no navegador **com a conta do backup**.

> **Pasta no Drive:** com `drive.file`, o rclone **só enxerga o que ele mesmo cria**. Ele criará a pasta `viaobras-backup` na raiz do Drive. Uma pasta criada pelo site não é visível para ele. **Não mova nem renomeie** a pasta criada.

### A4. Copiar o acesso para o servidor
O arquivo contém a autorização de acesso. Copie você mesmo, no seu terminal:

```powershell
scp -i $HOME\.ssh\<sua-chave> D:\Backups\ViaObras\config\rclone.conf root@<servidor>:/etc/viaobras-backup/rclone.conf
```

### A5. Senha no servidor
No terminal do servidor (a senha não aparece na tela nem fica no histórico):

```bash
read -rs -p 'Senha do backup: ' S && printf '%s\n' "$S" > /etc/viaobras-backup/senha && unset S && chmod 600 /etc/viaobras-backup/senha
```

### A6. Senha no computador
```powershell
& 'D:\Backups\ViaObras\ferramentas\definir-senha.ps1'
```

### A7. Monitor externo
Crie três verificações em um serviço de sinal de vida (ex.: Healthchecks.io), com aviso por e-mail:

| Verificação | Esperada a cada | Tolerância |
|---|---|---|
| backup | 6 horas | 2 horas |
| integridade | 7 dias | 1 dia |
| cópia no computador | 1 dia | **7 dias** |

Os dois primeiros endereços vão em `/etc/viaobras-backup/config`; o terceiro, em `D:\Backups\ViaObras\config\monitor.txt`.

## Parte B: instalação (feita com autorização)

### No servidor (VPS compartilhada: só acrescenta)
1. Instalar `restic` (mesma versão do computador, binário oficial com a soma conferida) e `rclone`.
2. `install -d -m 700 /etc/viaobras-backup` e `install -d -m 755 /opt/viaobras/backup-tool`.
3. `install -m 755 viaobras-*.sh /opt/viaobras/backup-tool/`; `install -m 600 config.exemplo /etc/viaobras-backup/config` e preencher.
4. Depois de A4 e A5: `viaobras-backup.sh init` (uma única vez), depois `run`.
5. **`viaobras-restore-test.sh`** precisa terminar com "restauração comprovada". Anotar o tempo.
6. Só então: `install -m 644 viaobras-backup.cron /etc/cron.d/viaobras-backup`.
7. Testar o aviso de falha.
8. Rotação do registro: `/etc/logrotate.d/viaobras-backup` (semanal, 8 arquivos).

A cada publicação do app, gravar o commit em `/opt/viaobras/VERSION`: ele vai junto na cópia.

### No computador
1. `restic.exe` e `rclone.exe` (oficiais, soma conferida) e os três scripts em `D:\Backups\ViaObras\ferramentas`.
2. Depois de A3 e A6, e da primeira cópia no servidor:
   `viaobras-copia-pc.ps1 -Iniciar`, depois `viaobras-copia-pc.ps1`.
3. `agendar-copia.ps1`.

## Quando o computador disser ALERTA
Ele **para de apagar** até você liberar. Não remova o aviso antes de entender a causa.

1. Veja `D:\Backups\ViaObras\copia.log` e `config\ALERTA.txt`.
2. Compare com o registro do servidor (`/var/log/viaobras-backup.log`): as datas das cópias batem?
3. Causas legítimas possíveis: cópias feitas à mão em quantidade, ou relógio errado.
4. Sem explicação: trate como invasão. Não apague nada no computador, troque a autorização do Google e a senha da caixa do Drive, e examine o servidor.
5. Explicado: remova `config\ALERTA.txt`.

**Limite conhecido:** os alertas pegam datas no futuro, datas antigas, quantidade anormal e Drive esvaziado. Quem controlar o servidor ainda pode passar a enviar **cópias novas com conteúdo errado**; as antigas já guardadas no computador seguem a retenção normal (até 6 meses). Os testes de restauração são o que revela esse caso.

## Testes feitos antes da instalação (2026-11-25)
Em ambiente descartável no computador de desenvolvimento (MySQL 8.0.30, restic 0.20.0, pasta local no lugar do Drive):

- Backup e restauração com a estrutura real (88 tabelas, 95 migrations, mais uma tabela de prova): acentos, emojis e dados binários idênticos byte a byte; anexos e configuração idênticos; nada em claro no repositório.
- Falhas (dump com erro ou cortado, anexos, consulta, configuração ausente): nenhuma cópia gravada, aviso de falha enviado e temporários apagados.
- Duas execuções ao mesmo tempo: a segunda sai sem mexer na primeira.
- Restauração com uma migration a menos: reprovada.
- Retenção: de 265 cópias, 19 mantidas, a mais antiga com 148 dias.
- Computador: apagar tudo na origem não apaga a cópia local, que restaura sozinha; alertas persistentes; destino no OneDrive ou em projeto Git recusado; senha errada falha; senha não aparece no registro.

## Conferido na instalação (2026-11-25)
Google Drive com identificação própria e permissão `drive.file`; `flock` e MySQL 8.4 na VPS; primeira cópia no Drive; restauração **a partir do Drive** no contêiner isolado (51 s); agendamento ativado; cópia no computador (com leitura de todos os dados) e tarefa do Windows executada com sucesso.

**Ainda não conferido:** a primeira execução disparada pelo agendamento da VPS, a retenção e a verificação semanal rodando sozinhas, o monitor externo e o aviso de falha.
