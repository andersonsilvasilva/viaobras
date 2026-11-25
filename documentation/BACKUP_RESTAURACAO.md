# BACKUP_RESTAURACAO.md: como recuperar o ViaObras

> **Situação: rascunho.** A restauração automática foi comprovada em 2026-11-25. Os três casos abaixo, feitos por uma pessoa, só valem como comprovados depois do primeiro ensaio completo.

**Regras antes de qualquer coisa**
1. **Não restaure sobre o banco de produção sem decisão expressa do responsável.**
2. Antes de mudar a produção, faça uma cópia do estado atual: `viaobras-backup.sh run`.
3. Nunca use `docker compose down -v` (apaga os volumes).
4. Restaurar traz de volta dados que podem ter sido excluídos a pedido (LGPD): conferir os pedidos de exclusão feitos depois da data da cópia.

## Onde estão as cópias

| Origem | Como acessar |
|---|---|
| Google Drive | no servidor, com a configuração em `/etc/viaobras-backup/config` |
| Computador do responsável | repositório `D:\Backups\ViaObras\repositorio` |
| Hostinger (máquina inteira) | painel da VPS. **Volta todos os sistemas da máquina**: só em perda total e com os demais responsáveis avisados |

Listar as cópias (no servidor):

```bash
set -a; . /etc/viaobras-backup/config; set +a
restic snapshots --host viaobras-vps --tag viaobras
```

Baixar uma cópia para uma pasta protegida (contém dados em claro: apagar ao terminar):

```bash
install -d -m 700 /root/recuperacao
restic restore <id-ou-latest> --host viaobras-vps --tag viaobras --target /root/recuperacao
```

Dentro dela: `db.sql`, `files/`, `app.env` e `manifest.txt` (data, versão do código e contagens).

## Caso 1: um registro ou arquivo apagado por engano
**Não restaurar o banco inteiro.**
1. Escolher a cópia anterior ao erro e baixá-la.
2. Importar o `db.sql` em um MySQL **temporário** (o mesmo que o `viaobras-restore-test.sh` sobe).
3. Extrair só os registros necessários, **da organização correta** (conferir `tenant_id`), com os vínculos (chaves estrangeiras).
4. Revisar o que será inserido antes de aplicar na produção, em uma transação.
5. Para um arquivo: copiar só ele de `files/` para o volume `viaobras_api_storage`, mantendo o caminho e o dono.
6. Apagar `/root/recuperacao` e o MySQL temporário.

## Caso 2: banco ou arquivos perdidos ou corrompidos (VPS funcionando)
1. Conferir antes que a cópia restaura: `viaobras-restore-test.sh <id>`.
2. Parar a aplicação, mantendo o banco: `cd /opt/viaobras/infrastructure && docker compose stop nginx api web`.
3. Guardar o estado atual, mesmo corrompido (dump ou cópia do volume).
4. Criar um banco **vazio** com o mesmo nome e importar o `db.sql` nele:
   `docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --default-character-set=utf8mb4 "$MYSQL_DATABASE"' < /root/recuperacao/db.sql`
   Recriar o banco apaga o atual: **só com a decisão expressa** e depois do passo 3. Conferir conjunto de caracteres `utf8mb4` e collation `utf8mb4_0900_ai_ci`, e que o usuário do app continua com acesso.
5. Restaurar `files/` no volume `viaobras_api_storage`, preservando dono e permissões.
6. Usar o código da versão registrada no `manifest.txt` (ou mais nova, aplicando as migrations que faltarem).
7. `docker compose up -d`, depois `docker compose restart nginx`.
8. Conferir: saúde da API, login, uma obra, um anexo e o envio de e-mail.
9. Informar aos usuários **a partir de que horário os dados se perderam** (a data da cópia).
10. Apagar `/root/recuperacao`.

## Caso 3: a VPS foi perdida
1. Preparar um servidor novo com Docker e nginx (ver a publicação do app).
2. Do cofre: **senha do backup**, `client_id` e `client_secret` do Google.
3. Instalar `restic` e `rclone` e refazer o acesso `gdrive` (README, A3). Se o Drive não estiver disponível, usar o repositório do computador.
4. Baixar a cópia mais recente; colocar `app.env` como `infrastructure/.env`. **Manter a mesma `APP_KEY`**: com outra, os dados cifrados (como a senha da caixa postal) ficam ilegíveis.
5. Publicar o código da versão do `manifest.txt` e seguir o caso 2 a partir do passo 4.
6. Apontar o DNS, emitir os certificados e reinstalar o backup.
7. Se houve invasão: **trocar todos os segredos**. Trocar a `APP_KEY` exige regravar os dados cifrados.

## Ensaio trimestral
Partindo da cópia **do computador**, seguir este documento e anotar o que faltou ou estava errado. Incluir a leitura de um dado cifrado com a `APP_KEY` restaurada. Registrar abaixo.

| Data | Tipo | Tempo | Resultado |
|---|---|---|---|
| 2026-11-25 | primeiro teste de restauração na VPS, **a partir do Google Drive**, em MySQL 8.4 isolado | 51 s | aprovado: 87 tabelas, 95 migrations, 4 arquivos, `APP_KEY` presente |
