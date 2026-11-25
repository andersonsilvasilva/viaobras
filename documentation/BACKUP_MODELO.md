# BACKUP_MODELO.md: backup e restauração da produção

> **Situação: APROVADO em 2026-11-25** (D-P122…D-P129, A-66) e **em funcionamento desde 2026-11-25**: cópia na VPS a cada 6 horas para o Google Drive e cópia diária no computador. Scripts em `infrastructure/backup/` ([instalação](../infrastructure/backup/README.md), [restauração](BACKUP_RESTAURACAO.md)). **Pendente:** o monitor externo de falhas (D-P127), o teste do aviso de falha e a homologação.
>
> **Destinos escolhidos pelo responsável:** Google Drive (conta comercial da HighTech) **e** um computador dele, na pasta `D:\Backups\ViaObras` (D-P122).

## 1. O que existe hoje

| Item | Situação |
|---|---|
| Cópias da Hostinger | A VPS **tem backups da máquina inteira**: duas cópias disponíveis, de 12/11 e 19/11 (intervalo de uma semana) |
| Cópias do ViaObras | só manuais, antes de publicações, **guardadas na própria VPS** (`/opt/viaobras/backup`, 4 MB) |
| Agendamento próprio | não há (o usuário `root` não tem crontab; em `/etc/cron.d` há só `certbot` e `e2scrub_all`) |
| Banco | MySQL 8.4, 87 tabelas, cerca de 46 MB de dados e índices (volume com 338 MB) |
| Arquivos enviados | volume `viaobras_api_storage`, 1 arquivo |
| Log binário do MySQL | ligado, com retenção de 30 dias, **no mesmo disco do banco** |
| Disco | 70 GB livres de 97 GB |
| Ferramentas | `gpg` e `zstd` instalados; `restic` e `rclone` não |
| Restauração | **nunca foi testada** a partir de uma cópia da Hostinger |

### Por que a cópia da Hostinger não basta

- **Perda de até uma semana** de dados, no intervalo observado.
- **Restaura a máquina inteira.** A VPS é compartilhada: voltar a cópia para recuperar o ViaObras também faria os outros sistemas voltarem no tempo.
- Não permite recuperar **só o banco** ou **só um arquivo**.
- Fica no mesmo fornecedor e na mesma conta.
- Não foi conferido se o banco sobe íntegro a partir dela.

Ela continua útil para o caso de perda total da máquina. A proposta **acrescenta** um backup do ViaObras; não substitui o da Hostinger.

## 2. Objetivo

| Medida | Alvo proposto |
|---|---|
| Perda máxima de dados | 6 horas |
| Tempo para recuperar banco e arquivos | até 1 hora, com o procedimento escrito (confirmar no primeiro teste) |
| Cópia fora da VPS e fora da Hostinger | no Google Drive a cada 6 horas; no computador, diária quando ele estiver ligado |
| Cópia cifrada antes de sair do servidor | sempre |
| Restauração comprovada | na entrega e depois periodicamente |

## 3. O que entra

1. **Banco `viaobras`**: `mysqldump --single-transaction --routines`, sem parar o sistema, comprimido.
2. **Arquivos enviados** (`viaobras_api_storage`).
3. **Configuração**: `infrastructure/.env`. Contém a `APP_KEY`: **sem ela, os dados cifrados (como a senha da caixa postal) não podem ser lidos** depois de uma restauração. Só sai do servidor dentro da cópia cifrada.
4. **Registro da versão** publicada (commit), para restaurar com o código correspondente.

**Fica de fora:** Redis (sessões e cache), imagens Docker e código (estão no Git), e os **outros sistemas da VPS**.

> O banco do site da HighTech, onde ficam os **pedidos de proposta** (`viaobras_propostas`), está em outra hospedagem e **não é coberto** por este modelo. Os pedidos também chegam por e-mail. Se quiser, vira uma tarefa separada.

## 4. Como funcionaria

```
a cada 6 horas (agendador do próprio servidor)
  1. gera o dump em uma pasta temporária (root, 700) e confere se terminou por completo
  2. envia dump, arquivos, .env e versão, cifrados, para o armazenamento externo
  3. apaga os temporários
  4. avisa o monitor que terminou bem
     (o destino do passo 2 é o Google Drive)
uma vez por dia
  5. aplica a retenção
uma vez por semana
  6. confere a integridade do repositório
```

- **Ferramenta:** `restic` (cifra no servidor, envia só o que mudou, aplica retenção e verifica integridade).
- **Agendamento:** um arquivo próprio em `/etc/cron.d/viaobras-backup`. Não depende do agendador do Laravel, que a produção não executa, e funciona mesmo se o app estiver fora do ar.
- **VPS compartilhada:** só acrescenta o pacote `restic`, uma pasta em `/opt/viaobras` e esse agendamento. Não altera nginx, contêineres nem os outros sistemas.
- **Sem duas execuções ao mesmo tempo** (trava) e com limite de tempo.
- **Scripts versionados** em `infrastructure/backup/`, sem nenhum segredo. O mesmo script passa a fazer o backup antes de cada publicação.

### 4.1 Google Drive (primeira cópia externa)

- **restic grava no Drive por meio do `rclone`.** O que chega lá está cifrado: nomes e conteúdo originais não ficam visíveis.
- **Identificação própria no Google (`client_id`).** A documentação do rclone informa que a identificação compartilhada dele **deixa de funcionar durante 2026**. Criamos uma do projeto, na sua conta.
- **Permissão mínima (`drive.file`):** o rclone só lê e altera os arquivos e pastas que ele mesmo criou; não enxerga o restante do seu Drive. O Google classifica essa permissão como **não sensível**.
- **Publicar o aplicativo no Google.** Em modo de teste, a autorização expira em 7 dias e o backup pararia. A verificação que o Google pede nesse caso será conferida na hora de configurar, e o monitor avisa se a autorização cair.
- **Conta:** a gratuita tem 15 GB, divididos com Gmail e Fotos. O volume atual é muito pequeno, mas **a conta cheia faria o backup falhar** (o monitor avisa). Proteger a conta com verificação em duas etapas.
- **A lixeira não é proteção suficiente:** o rclone manda os excluídos para a lixeira por padrão, mas quem tiver a autorização de acesso pode conseguir apagar em definitivo. Por isso a proteção contra exclusão é o computador (4.2).

### 4.2 Computador do responsável (segunda cópia, protegida contra exclusão)

- **O computador busca; a VPS não tem acesso a ele.** Assim, uma invasão da VPS não alcança o que já foi copiado.
- Usa `restic copy` do Google Drive para um repositório local, também cifrado. A cópia **só acrescenta**: apagar no Drive não apaga no computador. A retenção do computador é aplicada por ele mesmo.
- Agendador de Tarefas do Windows: uma vez por dia e, se o computador estiver desligado no horário, assim que possível.
- **A pasta não pode ficar dentro do Google Drive sincronizado** (uma exclusão se propagaria) nem dentro do projeto.
- Aviso próprio no monitor se passar **7 dias** sem cópia no computador.
- **Antes de aplicar a retenção**, o script procura sinais de adulteração (datas no futuro ou antigas, quantidade anormal, Drive esvaziado). Ao encontrar, **para de apagar** até uma pessoa conferir.
- Para rodar sozinho, a senha fica no computador protegida pela conta do Windows. Ela precisa existir **também em outro lugar** (cofre de senhas), caso o computador se perca.
- O computador passa a guardar dados de clientes, ainda que cifrados: manter o Windows com senha e atualizado.
- Limite: protege até a **última cópia feita**. Com o computador desligado por vários dias, essa camada fica atrasada.

## 5. Segredos

- **Senha do repositório e chave do armazenamento:** em um arquivo no servidor, só para `root` (600), fora do Git.
- **A senha do repositório precisa também estar com você, fora da VPS** (cofre de senhas). **Se ela se perder, o backup não pode ser recuperado por ninguém.**
- Nenhum segredo é enviado por conversa: você mesmo os digita no servidor, com um comando que eu preparo.
- **Se a VPS for invadida**, quem tiver a autorização do Drive e a senha poderia tentar apagar as cópias de lá. A proteção é a cópia do computador, que a VPS não alcança (4.2).

## 6. Aviso de falha

Um backup que para sem avisar é o problema mais comum. Proposta: um **monitor externo de sinal de vida**. O script avisa quando termina bem; se o aviso não chegar no prazo, o monitor manda e-mail. Assim também se descobre o caso de a VPS estar desligada. O sinal não leva dados do sistema.

## 7. Restauração

**Nunca sobre o banco de produção sem ordem expressa.**

| Quando | O quê |
|---|---|
| Na entrega (condição para considerar pronto) | restaurar a última cópia em um MySQL **temporário e isolado**, sem porta aberta; conferir tabelas, migrations (95 hoje), contagens principais e os arquivos; medir o tempo; apagar o ambiente |
| Mensal | a mesma conferência |
| A cada três meses | ensaio completo seguindo só o documento, incluindo a leitura de um dado cifrado com a `APP_KEY` restaurada, **partindo da cópia do computador** |
| Mensal, no computador | conferência de integridade do repositório local, lendo os dados |

O MySQL temporário usa memória da VPS (hoje há cerca de 4 GB disponíveis): rodar fora do horário de uso, com limite de memória.

Entrega junto: `documentation/BACKUP_RESTAURACAO.md`, com o passo a passo para três casos: apagar um registro por engano, perder o banco ou os arquivos, e perder a VPS.

## 8. Retenção e LGPD

Proposta: **7 cópias diárias, 4 semanais e 6 mensais** (mantendo todas as das últimas 48 horas).

Consequência: um dado excluído no sistema **continua nas cópias por até cerca de 6 meses**. A Política de Privacidade precisa dizer isso, e a restauração não deve trazer de volta, sem tratamento, dados cuja exclusão foi pedida. Incluir na revisão jurídica.

## 9. Decisões

| ID | Decisão | Recomendação |
|---|---|---|
| **D-P122** | Onde guardar a cópia externa | **Escolhido pelo responsável:** Google Drive **e** computador próprio. Descartados: serviço de armazenamento de objetos e a hospedagem do site da HighTech |
| **D-P123** | Frequência | **A cada 6 horas.** Alternativa: uma vez por dia |
| **D-P124** | Retenção | **7 diárias, 4 semanais, 6 mensais** |
| **D-P125** | Ferramenta e cifra | **restic**, cifrado no servidor. Alternativa: `gpg` + `rclone`, com mais código próprio |
| **D-P126** | Proteção contra exclusão | **Pela cópia do computador**, que busca os dados e não é acessível pela VPS (o Drive não oferece, nesta configuração, um bloqueio contra exclusão) |
| **D-P127** | Aviso de falha | **Monitor externo de sinal de vida com e-mail** |
| **D-P128** | Testes de restauração | **Na entrega, mensal e ensaio trimestral** |
| **D-P129** | Manter o backup da Hostinger | **Sim**, como segunda camada. Conferir no painel a frequência contratada |

## 10. Etapas depois da aprovação

1. Você escolhe a conta Google e a pasta no computador e cria a conta do monitor. Eu preparo o passo a passo da identificação própria no Google; você autoriza o acesso e digita as senhas.
2. Scripts testados no ambiente local, com banco descartável.
3. Instalação na VPS (`restic` e `rclone`) e no computador; você digita os segredos.
4. Primeira execução, primeira cópia no computador e **primeiro teste de restauração**, com o tempo medido.
5. Teste do aviso de falha (interromper de propósito).
6. Documento de restauração, e homologação por você.

**Sem mudança no banco, no código do app ou nas telas.**

## 11. Fora deste modelo

- Recuperação para um instante exato (usando o log binário fora do servidor).
- Segundo servidor de reserva.
- Backup dos outros sistemas da VPS e do banco do site da HighTech.
