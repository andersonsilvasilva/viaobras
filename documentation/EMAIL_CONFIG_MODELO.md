# CONFIGURAÇÃO DE E-MAIL DA PLATAFORMA: MODELO APROVADO

> **Aprovado em 2026-11-25** (D-P113 a D-P121 conforme a recomendação — A-65). Pedido do responsável: configurar na plataforma a caixa postal e as mensagens padrão, para facilitar uma futura troca de provedor. A conta administradora foi indicada pelo responsável e fica só no `.env` de cada ambiente.
>
> **Situação atual:** o envio de produção foi configurado em 2026-11-25 por variáveis no `.env` do servidor (`MAIL_*`), e o teste foi aceito pelo servidor SMTP. **Faltam no front as páginas `/reset-password` e `/accept-invitation`**, para onde as duas mensagens atuais apontam.

## 1. Objetivo

1. Editar a caixa postal de envio sem acesso ao servidor.
2. Testar o envio pela própria tela antes de passar a usar a nova configuração.
3. Editar as mensagens padrão, com prévia e opção de voltar ao texto original.
4. Fazer os links das mensagens funcionarem.

## 2. Quem pode configurar (decisão principal)

A caixa postal vale para **todas** as organizações. Quem a controla pode desviar os links de recuperação de senha de qualquer usuário. Por isso ela **não** pode ser uma permissão do papel `admin` de uma organização.

Hoje não há administrador de plataforma: a decisão A-24 manteve o provisionamento só por linha de comando. Esta proposta altera esse ponto apenas para a configuração de e-mail.

## 3. Tabelas (2 novas, sem `tenant_id`: são da plataforma)

| Tabela | Colunas principais | Regras |
|---|---|---|
| `platform_mail_settings` | `host`, `port`, `encryption` (`ssl`, `tls`), `username`, `password` (cifrada), `from_address`, `from_name`, `active`, `last_tested_at`, `updated_by` | uma única linha; a senha é cifrada com a chave da aplicação e **nunca** volta para a tela nem vai para a auditoria |
| `platform_mail_templates` | `key` (`invitation`, `password_reset`), `subject`, `body`, `updated_by` | uma linha por mensagem alterada; sem linha, vale o texto padrão do sistema |

`users` não muda (ver D-P113).

## 4. Decisões para aprovação

| ID | Decisão | Recomendação |
|---|---|---|
| **D-P113** | **Quem é o administrador da plataforma** | Lista de e-mails no `.env` do servidor (`PLATFORM_ADMIN_EMAILS`). Só quem tem acesso ao servidor altera a lista. Sem tela nem migration para isso. Começa com a conta que o responsável indicar |
| **D-P114** | **Caixa por plataforma ou por organização** | **Uma da plataforma.** Caixa própria de cada cliente fica para depois, se houver demanda |
| **D-P115** | **Confirmação para alterar** | Pedir a **senha de quem está alterando** e enviar um **teste** para o e-mail dessa pessoa. A configuração nova só passa a valer se o teste for aceito |
| **D-P116** | **Sem configuração na tela** | Continua valendo o `.env` do servidor, que também é a volta de emergência: "voltar a usar a configuração do servidor" |
| **D-P117** | **Limites do servidor informado** | Só portas de e-mail (465 e 587, com criptografia obrigatória); endereços internos do servidor são recusados |
| **D-P118** | **Mensagens editáveis** | **Convite** e **recuperação de senha**: assunto e texto simples, com variáveis em lista fechada (ex.: `{{nome}}`, `{{organizacao}}`, `{{link}}`, `{{validade}}`). A variável `{{link}}` é obrigatória. Sem HTML livre nem código. Novas mensagens (cotações, 7B) entram na mesma tela depois |
| **D-P119** | **Mensagens por organização** | **Não por agora:** o texto é da plataforma |
| **D-P120** | **Páginas dos links** | Criar **Redefinir senha** e **Aceitar convite** no app. A API das duas já existe |
| **D-P121** | **Auditoria** | Registrar quem alterou, testou ou restaurou, sem a senha e sem o conteúdo das mensagens enviadas |

## 5. Tela

Menu **Plataforma → E-mail**, visível só para o administrador da plataforma.

- **Caixa postal:** servidor, porta, criptografia, usuário, senha (campo só de escrita: "definida" ou "alterar"), nome e e-mail do remetente; botão **Testar e salvar**; indicação de qual configuração está em uso (tela ou servidor) e do último teste.
- **Mensagens:** lista das mensagens, edição de assunto e texto, variáveis disponíveis, prévia com dados de exemplo, **Enviar teste para mim** e **Restaurar padrão**.

## 6. Etapas (após aprovação)

1. **Páginas dos links** (D-P120), porque sem elas a recuperação de senha e o convite não funcionam. Não dependem do restante.
2. **Banco e API:** migrations, administrador da plataforma, caixa postal com teste, modelos de mensagem, testes de permissão e de que a senha nunca é devolvida.
3. **Tela**, testes completos, banco local (com autorização) e homologação.

## 7. Riscos

- **Conta do administrador da plataforma invadida:** quem controlar a conta pode trocar a caixa postal. A senha de confirmação (D-P115) e a auditoria reduzem o risco. A verificação em duas etapas ainda não existe (Fase 10).
- **Chave da aplicação:** se a `APP_KEY` mudar, a senha cifrada precisa ser digitada de novo.
- **Texto editado que quebra o envio:** a validação das variáveis e a prévia evitam; "Restaurar padrão" desfaz.
- **Publicação:** o `docker-compose.yml` precisa das variáveis `MAIL_*` no repositório. Publicar um commit sem elas desligaria o envio.

## 8. Andamento

### Implementação (2026-11-25), nas três etapas

- **Páginas dos links (D-P120):** `/reset-password` e `/accept-invitation`, com a regra de senha da API. No convite, nome e senha só são pedidos a quem ainda não tem conta.
- **Banco:** migrations `2026_11_25_710001` (`platform_mail_settings`) e `710002` (`platform_mail_templates`), sem `tenant_id`.
- **Administrador (D-P113):** `PLATFORM_ADMIN_EMAILS`; rotas `/api/v1/platform/mail` só para ele e só por sessão (token recusado). `/auth/me` informa `is_platform_admin`.
- **Caixa postal:** teste antes de valer, senha da própria pessoa, senha da caixa cifrada e nunca devolvida, portas 465/587 com criptografia obrigatória e recusa de endereços internos. **Acréscimo à proposta:** a senha guardada só é reaproveitada se servidor, porta e usuário não mudarem, para não ser enviada a outro servidor.
- **Mensagens:** convite e recuperação de senha com variáveis fechadas, prévia, teste e restauração. A validade do convite passou a sair no fuso da organização (antes, em UTC).
- **Testes:** API 559/559 (`Feature/Platform/PlatformMailTest`, 27 casos, sem usar a rede); frontend 91/91. Percurso no navegador no ambiente descartável: redefinir senha, convite com conta nova, bloqueio do administrador de organização, caixa postal (erros) e mensagens. **Não testado no navegador:** salvar uma caixa postal real (coberto pelos testes com o envio simulado).
- **Pendente:** migrations no banco local (autorização), homologação e publicação.
