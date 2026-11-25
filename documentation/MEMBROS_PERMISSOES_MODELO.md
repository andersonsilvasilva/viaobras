# MEMBROS_PERMISSOES_MODELO.md: tela "Membros e permissões"

> **Situação: APROVADO** (D-P130…D-P138, A-68) e **implementado no ambiente local** em 2026-11-25. **Homologado** pelo responsável (A-69). Andamento em §8.

## 1. Por que

Só existe a tela de **Convites**, em que o papel é escolhido ao convidar. Não há como ver os membros, mudar o papel de quem já entrou, criar papéis ou suspender alguém. Em 2026-11-25, para liberar orçamentos a um membro, o papel `Orcamentista` precisou ser criado e atribuído por comando na produção.

## 2. O que o servidor já faz

| Função | Rota | Permissão |
|---|---|---|
| listar membros, com situação e papéis | `GET /members` | `members.view` |
| suspender, reativar, remover | `POST /members/{id}/suspend`, `/reactivate`, `DELETE /members/{id}` | `members.manage` |
| atribuir e retirar papel | `POST /members/{id}/roles`, `DELETE /members/{id}/roles/{papel}` | `roles.manage` |
| listar permissões e papéis | `GET /permissions`, `GET /roles` | `roles.view` |
| criar, alterar, excluir papel | `POST`, `PUT`, `DELETE /roles` | `roles.manage` |

Proteções que já existem: papéis de sistema (`admin`, `member`, `viewer`) não podem ser alterados nem excluídos; ninguém concede permissão que não tem; o último administrador não pode ser suspenso, removido nem perder o papel; papel em uso (por pessoa ou convite) não é excluído; um vínculo removido só volta por novo convite; tudo é auditado.

### Limitações encontradas
1. **Nome de papel sem acentos:** a validação aceita só letras sem acento, números, espaço, ponto, hífen e sublinhado. Por isso ficou `Orcamentista`.
2. **Retirar papel não confere se quem retira possui as permissões dele** (conceder confere). Quem tem `roles.manage` pode retirar qualquer papel de outra pessoa, respeitada a regra do último administrador.
3. Não há consulta das **obras a que uma pessoa tem acesso**; o acesso é visto obra por obra, na aba **Acesso**.

## 3. A tela

Menu **Membros** (junto de Convites), com duas abas.

**Aba Pessoas** (`members.view`): nome, e-mail, situação e papéis. Ações conforme a permissão: **Alterar papéis**, **Suspender**, **Reativar**, **Remover**. Cada ação pede confirmação e diz o efeito.

**Aba Papéis** (`roles.view`): lista com quantidade de pessoas e o que cada papel permite. Com `roles.manage`: **criar**, **duplicar**, **alterar** e **excluir** papéis da organização.

As permissões aparecem **em português, agrupadas por módulo** (ex.: Orçamentos: *Consultar*, *Criar e editar*, *Aprovar*), nunca pelos códigos. Marcar *Criar e editar* ou *Aprovar* marca também *Consultar*.

Um aviso permanente explica o acesso por obra: o papel diz **o que** a pessoa pode fazer; a aba **Acesso** da obra diz **em quais obras**.

## 4. Decisões

| ID | Decisão | Recomendação |
|---|---|---|
| **D-P130** | Onde fica | **Menu "Membros"**, com as abas Pessoas e Papéis. Convites continua como está |
| **D-P131** | Vários papéis por pessoa | **Sim** (o sistema já permite): valem somadas as permissões de todos. A tela mostra o resultado somado |
| **D-P132** | Ações sobre a própria conta | **Bloquear na tela e no servidor** suspender, remover ou mudar os papéis de si mesmo |
| **D-P133** | Quem pode agir sobre um administrador | **Só quem é administrador** pode suspender, remover ou retirar o papel de um administrador. Exige ajuste no servidor |
| **D-P134** | Limitação 2 (retirar papel) | **Corrigir:** retirar um papel exige possuir as permissões dele, como ao conceder. Ajuste no servidor |
| **D-P135** | Acentos no nome do papel | **Permitir** letras acentuadas e renomear `Orcamentista` para `Orçamentista` pela própria tela |
| **D-P136** | Modelos prontos de papel | **Oferecer como ponto de partida**, sem criar sozinho: *Orçamentista* (consulta + criar e editar orçamentos), *Engenharia de obra* (orçamentos, planejamento e solicitar materiais) e *Compras* (consulta + aprovar solicitações). As listas exatas são conferidas na tela antes de salvar |
| **D-P137** | Obras de cada pessoa | **Mostrar, só para leitura,** as obras e o nível de cada pessoa, com atalho para a aba Acesso. Exige uma consulta nova no servidor |
| **D-P138** | Nomes dos papéis de sistema | Exibir **Administrador**, **Membro (consulta)** e **Somente organização**, deixando claro que o Membro não edita |

## 5. O que muda

- **Interface:** a tela nova e o item no menu.
- **Servidor:** D-P132, D-P133, D-P134, D-P135 e D-P137, com testes de autorização e de isolamento entre organizações.
- **Banco:** nenhuma migration. **Nenhuma permissão nova.**
- **Papéis existentes:** nenhum é alterado pela implantação.

## 6. Fora deste modelo

Permissões individuais por pessoa (fora de papéis), cópia de acessos entre obras, verificação em duas etapas e aplicação do limite de usuários dos planos.

## 7. Homologação

Com uma conta de administrador e uma de membro: atribuir o papel de orçamentista e conferir que a pessoa cria um orçamento e **não** consegue aprovar; retirar o papel e conferir que perde o acesso; suspender e reativar; tentar agir sobre a própria conta e sobre o último administrador.

## 8. Andamento (2026-11-25)

- **Feito:** tela **Membros** (abas Pessoas e Papéis), ajustes D-P132 a D-P135 no servidor e a consulta de obras (D-P137). Sem migration e sem permissão nova.
- **Acréscimo ao modelo:** a proteção da D-P133 também vale para **reativar** um administrador suspenso (reativar devolve o acesso de administrador).
- **Testes antigos ajustados:** dois testes presumiam ação sobre a própria conta (agora proibida). As garantias foram mantidas, e um deles passou a exigir também que não se torne outra pessoa administradora.
- **Resultado:** API 572/572; interface 141/141. No navegador, em ambiente descartável: bloqueios da própria conta e do administrador, modelo de papel, atribuir (criar orçamento passa de 403 a 201), retirar (volta a 403), suspender e reativar; no mesmo orçamento, quem edita recebe 403 ao aprovar e o administrador aprova.
- **Depois da publicação:** renomear `Orcamentista` para `Orçamentista` pela tela (D-P135).
