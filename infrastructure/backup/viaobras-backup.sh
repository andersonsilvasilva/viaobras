#!/usr/bin/env bash
# Backup da produção do ViaObras (documentation/BACKUP_MODELO.md).
#
# Uso:  viaobras-backup.sh run      gera e envia uma cópia (banco, arquivos, configuração)
#       viaobras-backup.sh forget   aplica a retenção
#       viaobras-backup.sh check    confere a integridade do repositório
#       viaobras-backup.sh init     cria o repositório (uma única vez, na instalação)
#
# Nenhum segredo fica neste arquivo. A configuração vem de $BACKUP_CONFIG (padrão /etc/viaobras-backup/config,
# somente root, modo 600). Exemplo em config.exemplo.
set -Eeuo pipefail
umask 077

BACKUP_CONFIG="${BACKUP_CONFIG:-/etc/viaobras-backup/config}"
[ -r "$BACKUP_CONFIG" ] || { echo "configuração não encontrada: $BACKUP_CONFIG" >&2; exit 2; }
# shellcheck disable=SC1090
. "$BACKUP_CONFIG"

: "${RESTIC_REPOSITORY:?defina RESTIC_REPOSITORY}"
: "${RESTIC_PASSWORD_FILE:?defina RESTIC_PASSWORD_FILE}"
export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE
if [ -n "${RCLONE_CONFIG:-}" ]; then export RCLONE_CONFIG; fi

APP_DIR="${APP_DIR:-/opt/viaobras}"
ENV_FILE="${ENV_FILE:-$APP_DIR/infrastructure/.env}"
# pasta de trabalho fixa: contém dados em claro só durante a execução
STAGING="${STAGING:-$APP_DIR/backup/trabalho}"
LOCK="${LOCK:-/run/lock/viaobras-backup.lock}"
BACKUP_HOST="${BACKUP_HOST:-viaobras-vps}"
MIN_TABLES="${MIN_TABLES:-50}"
HEARTBEAT_URL="${HEARTBEAT_URL:-}"
HEARTBEAT_CHECK_URL="${HEARTBEAT_CHECK_URL:-}"
RESTIC="${RESTIC_BIN:-restic}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# Aviso ao monitor externo. Não leva nenhum dado do sistema e nunca derruba o backup.
signal() {
  local url="$1" suffix="${2:-}"
  [ -n "$url" ] || return 0
  curl -fsS -m 20 --retry 3 -o /dev/null "$url$suffix" || log "aviso ao monitor não foi entregue"
}

compose() { (cd "$APP_DIR/infrastructure" && docker compose "$@" </dev/null); }

# As três funções abaixo são o único contato com a produção. Os testes as substituem por BACKUP_HOOKS.
dump_database() {
  # sem --databases: o arquivo não tem CREATE DATABASE nem USE, então nunca escolhe sozinho onde ser restaurado
  compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 "$MYSQL_DATABASE"'
}

query_database() {
  compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -N -B -e "$1" "$MYSQL_DATABASE"' sh "$1"
}

copy_files() {
  local source
  source="$(docker volume inspect -f '{{.Mountpoint}}' viaobras_api_storage)"
  [ -d "$source" ] || return 1
  cp -a "$source/." "$1/"
}

if [ -n "${BACKUP_HOOKS:-}" ]; then
  # shellcheck disable=SC1090
  . "$BACKUP_HOOKS"
fi

version_info() {
  if [ -f "$APP_DIR/VERSION" ]; then
    echo "commit=$(head -n1 "$APP_DIR/VERSION")"
  else
    echo "commit=desconhecido"
  fi
}

# Trava: não deixa duas execuções ao mesmo tempo.
acquire_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$LOCK"
    flock -n 9 || { log "outra execução em andamento"; exit 3; }
  else
    mkdir "$LOCK.d" 2>/dev/null || { log "outra execução em andamento"; exit 3; }
    LOCK_DIR="$LOCK.d"
  fi
}

LOCK_DIR=""
WORKING=0
CURRENT_SIGNAL=""
finish() {
  local code=$?
  if [ "$WORKING" = 1 ]; then rm -rf -- "$STAGING"; fi
  if [ -n "$LOCK_DIR" ]; then rmdir "$LOCK_DIR" 2>/dev/null || true; fi
  if [ "$code" -ne 0 ] && [ "$code" -ne 3 ]; then
    log "FALHOU (código $code)"
    signal "$CURRENT_SIGNAL" /fail
  fi
}
trap finish EXIT

do_run() {
  CURRENT_SIGNAL="$HEARTBEAT_URL"
  [ -r "$ENV_FILE" ] || { log "arquivo de configuração do app não encontrado"; return 1; }
  # proteção contra apagar a pasta errada na limpeza
  case "$STAGING" in */trabalho) ;; *) log "STAGING precisa terminar em /trabalho"; return 1 ;; esac

  WORKING=1
  rm -rf -- "$STAGING"
  mkdir -p "$STAGING/files"

  log "gerando o dump do banco"
  dump_database >"$STAGING/db.sql"
  tail -n 5 "$STAGING/db.sql" | grep -q -- '-- Dump completed' || { log "dump incompleto"; return 1; }
  local tables
  tables="$(grep -c '^CREATE TABLE ' "$STAGING/db.sql" || true)"
  [ "$tables" -ge "$MIN_TABLES" ] || { log "dump com $tables tabelas (mínimo $MIN_TABLES)"; return 1; }

  log "copiando os arquivos enviados e a configuração"
  copy_files "$STAGING/files"
  cp -- "$ENV_FILE" "$STAGING/app.env"

  local migrations files
  migrations="$(query_database 'SELECT COUNT(*) FROM migrations' | tr -d '\r')"
  files="$(find "$STAGING/files" -type f | wc -l | tr -d ' ')"
  {
    echo "created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "tables=$tables"
    echo "migrations=$migrations"
    echo "files=$files"
    version_info
  } >"$STAGING/manifest.txt"

  log "enviando a cópia cifrada ($tables tabelas, $migrations migrations, $files arquivos)"
  (cd "$STAGING" && "$RESTIC" backup --quiet --host "$BACKUP_HOST" --tag viaobras .)

  log "backup concluído"
  signal "$HEARTBEAT_URL"
}

do_forget() {
  CURRENT_SIGNAL="$HEARTBEAT_URL"
  log "aplicando a retenção"
  "$RESTIC" forget --quiet --host "$BACKUP_HOST" --tag viaobras --group-by host,tags \
    --keep-within 48h --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
  log "retenção aplicada"
}

do_check() {
  CURRENT_SIGNAL="$HEARTBEAT_CHECK_URL"
  log "conferindo a integridade do repositório"
  "$RESTIC" check --quiet --read-data-subset=10%
  log "repositório íntegro"
  signal "$HEARTBEAT_CHECK_URL"
}

case "${1:-}" in
  run) acquire_lock; do_run ;;
  forget) acquire_lock; do_forget ;;
  check) acquire_lock; do_check ;;
  init) acquire_lock; "$RESTIC" init ;;
  *) echo "uso: $0 run|forget|check|init" >&2; exit 2 ;;
esac
