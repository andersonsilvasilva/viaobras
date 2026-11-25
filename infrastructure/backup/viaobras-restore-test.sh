#!/usr/bin/env bash
# Prova que a última cópia pode ser restaurada. NUNCA toca no banco de produção:
# sobe um MySQL temporário, sem rede e com memória limitada, importa, confere e apaga tudo.
#
# Uso: viaobras-restore-test.sh [id-da-cópia]      (padrão: a mais recente)
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

BACKUP_HOST="${BACKUP_HOST:-viaobras-vps}"
RESTIC="${RESTIC_BIN:-restic}"
SNAPSHOT="${1:-latest}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/viaobras-restauracao.XXXXXX")"
CONTAINER="viaobras-restore-test-$$"
STARTED=$(date +%s)

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# MySQL descartável. Os testes locais substituem estas três funções por RESTORE_HOOKS.
database_start() {
  local password
  password="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"
  docker run -d --rm --name "$CONTAINER" --network none --memory 1g \
    -e MYSQL_ROOT_PASSWORD="$password" -e MYSQL_DATABASE=restauracao mysql:8.4 \
    --character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci --default-time-zone=+00:00 >/dev/null
  local i
  for i in $(seq 1 90); do
    # pela porta TCP: o servidor de inicialização da imagem só atende pelo soquete
    if docker exec "$CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h127.0.0.1 -uroot -e "SELECT 1" restauracao' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  log "o MySQL temporário não ficou pronto"
  return 1
}
database_import() { docker exec -i "$CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -h127.0.0.1 -uroot --default-character-set=utf8mb4 restauracao' <"$1"; }
database_query() { docker exec "$CONTAINER" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -h127.0.0.1 -uroot -N -B -e "$1" restauracao' sh "$1" </dev/null; }
database_stop() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }

if [ -n "${RESTORE_HOOKS:-}" ]; then
  # shellcheck disable=SC1090
  . "$RESTORE_HOOKS"
fi

finish() {
  local code=$?
  database_stop
  rm -rf -- "$WORK"
  [ "$code" -eq 0 ] || log "RESTAURAÇÃO NÃO COMPROVADA (código $code)"
}
trap finish EXIT

log "baixando a cópia $SNAPSHOT"
"$RESTIC" restore "$SNAPSHOT" --quiet --host "$BACKUP_HOST" --tag viaobras --target "$WORK"

MANIFEST="$(find "$WORK" -type f -name manifest.txt -not -path '*/files/*' | head -n1)"
[ -n "$MANIFEST" ] || { log "a cópia não tem o registro (manifest.txt)"; exit 1; }
ROOT="$(dirname "$MANIFEST")"
value() { sed -n "s/^$1=//p" "$MANIFEST" | head -n1; }
log "cópia de $(value created_at), versão $(value commit)"

# um dump com USE ou CREATE DATABASE poderia escrever fora do banco temporário
if grep -qE '^(USE |CREATE DATABASE)' "$ROOT/db.sql"; then
  log "o dump escolhe o banco de destino: não será importado"
  exit 1
fi

log "importando em um MySQL temporário"
database_start
database_import "$ROOT/db.sql"

failures=0
compare() {
  if [ "$2" = "$3" ]; then log "ok    $1: $3"; else log "ERRO  $1: esperado $2, restaurado $3"; failures=$((failures + 1)); fi
}
compare "tabelas" "$(value tables)" "$(database_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'" | tr -d '\r')"
compare "migrations" "$(value migrations)" "$(database_query 'SELECT COUNT(*) FROM migrations' | tr -d '\r')"
compare "arquivos" "$(value files)" "$(find "$ROOT/files" -type f | wc -l | tr -d ' ')"
if grep -qE '^APP_KEY=.+' "$ROOT/app.env"; then log "ok    a configuração restaurada tem a APP_KEY"; else log "ERRO  configuração sem APP_KEY"; failures=$((failures + 1)); fi

[ "$failures" -eq 0 ] || exit 1
log "restauração comprovada em $(($(date +%s) - STARTED)) segundos"
