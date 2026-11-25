# FASE 7A — SOLICITAÇÕES DE MATERIAIS E APROVAÇÃO: MODELO APROVADO

> **Aprovado em 2026-11-25** (D-P99 a D-P112 conforme a recomendação — A-63). **Homologado pelo responsável em 2026-11-25 (A-64).** Andamento em §11.
>
> **Base:**
> - mudança de ordem autorizada pelo responsável: a Fase 7 vem antes da 6C (A-62);
> - modelagem original ([DATABASE.md](DATABASE.md) §2.12);
> - telas do Brickup ([SCREEN_REFERENCES.md](SCREEN_REFERENCES.md), nº 13 e C1–C7);
> - o que já existe: obras e acesso por obra (Fase 3), catálogo de insumos (4C), cronograma e recursos das atividades (6A/6B), documentos (Fase 2) e o protótipo da tela Suprimentos (dados de demonstração).

## 1. Objetivo

A tela **Suprimentos** deixa de ser demonstração: a equipe da obra pede materiais, quem tem permissão aprova, e todos acompanham a situação até o atendimento.

### Divisão da Fase 7

| Parte | Entrega | Estado |
|---|---|---|
| **7A — Solicitações e aprovação** | Este modelo | homologada (A-64) |
| **7B — Cotações e pedidos** | Cotações por fornecedor, comparação, pedido de compra, alçadas por valor e aprovação em dois níveis (C7), avisos por e-mail (C6), painel em quadro (C5) | proposta futura |
| **7C — Recebimento e estoque** | Recebimento (total ou parcial), depósitos, movimentações e saldos | proposta futura |

**Ordem:** 7A → **6C (RDO)** → 7B → 7C. A posição da 7B e da 7C em relação à 6C é uma recomendação (D-P99).

### Fora da 7A

Preços, cotações, fornecedores na solicitação, pedido de compra, estoque, lançamentos financeiros, e-mails, quadro Kanban, relatório personalizado e PDF da solicitação.

## 2. Fluxo

```
Rascunho ──enviar──▶ Pendente ──aprovar──▶ Aprovada ──marcar como atendida──▶ Atendida
   ▲                    │                      │
   └──────devolver──────┤                      ├──desfazer aprovação──▶ Pendente
                        └──recusar──▶ Recusada │
Rascunho, Pendente ou Aprovada ──cancelar──▶ Cancelada
```

| De → para | Quem | Motivo |
|---|---|---|
| rascunho → pendente (enviar) | quem pode solicitar | — |
| pendente → aprovada | quem pode aprovar | opcional |
| pendente → rascunho (devolver para ajuste) | quem pode aprovar | **obrigatório** |
| pendente → recusada | quem pode aprovar | **obrigatório** |
| aprovada → pendente (desfazer aprovação) | quem pode aprovar | **obrigatório** |
| aprovada → atendida | quem pode aprovar | observação opcional, com data do atendimento |
| atendida → aprovada (desfazer atendimento) | quem pode aprovar | **obrigatório** |
| rascunho ou pendente → cancelada | quem criou (com permissão de solicitar) ou quem pode aprovar | **obrigatório** se estava pendente |
| aprovada → cancelada | quem pode aprovar | **obrigatório** |

Recusada e cancelada são finais. Cada mudança fica no histórico, que só recebe inclusões.

Na modelagem original, os status são `draft`, `pending`, `approved`, `rejected`, `quoting`, `ordered`, `received` e `canceled`. A 7A usa `draft`, `pending`, `approved`, `rejected`, `received` (na tela, **Atendida**) e `canceled`. `quoting` e `ordered` entram com a 7B.

## 3. Tabelas (3 novas + 1 ajuste)

| # | Tabela | Colunas principais | Regras |
|---|---|---|---|
| 1 | `purchase_requests` | `uuid`, `project_id`, `number`, `requester_id`, `priority` (`low`, `medium`, `high`, `urgent`), `status`, `needed_by` (opcional), `notes`, `submitted_at`, `decided_by`, `decided_at`, `fulfilled_on` | número único no tenant; empresa vem da obra; exclusão **lógica**, só do rascunho **nunca enviado** (o número continua ocupado) |
| 2 | `purchase_request_items` | `request_id`, `resource_id` (catálogo, opcional), `description`, `unit_code`, `quantity`, `approved_quantity` (opcional), `task_id` (atividade do cronograma, opcional), `notes`, `sort_order` | descrição e unidade **copiadas** do catálogo (D-08); quantidade > 0; quantidade aprovada entre 0 e a pedida (CHECK); itens só mudam em rascunho |
| 3 | `purchase_request_history` | `request_id`, `from_status`, `to_status`, `changed_by`, `reason`, `changed_at` | só inclusão, como o `contract_status_history` |
| ± | `document_links` | aceita `purchase_request` | anexos e fotos (disco privado) |

Todas têm `tenant_id`, FKs compostas e `RESTRICT`, sem cascata. O histórico começa no primeiro envio ou cancelamento.

> **Ajuste na etapa 1:** a proposta previa exclusão física com `CASCADE`. O projeto não usa FK em cascata (há teste que a proíbe), e a exclusão física liberaria o número do último rascunho, contrariando a D-P100. A exclusão passou a ser lógica.

**O que muda em relação à modelagem original:**
- `budget_item_id` dá lugar a `task_id`, porque o planejamento já guarda os recursos de cada atividade;
- `inventory_item_id` fica para a 7C;
- `unit_id` dá lugar à cópia `unit_code`, como no planejamento;
- `purchase_approvals` fica para a 7B (pedidos e dois níveis). Na 7A, as decisões ficam no histórico.

## 4. Decisões para aprovação

| ID | Decisão | Recomendação |
|---|---|---|
| **D-P99** | **Ordem das partes** | **7A → 6C → 7B → 7C.** A 7A torna real o que a landing anuncia; a 6C fecha o Planejamento antes das compras |
| **D-P100** | **Numeração** | `SOL-001/2026`: sequência por organização e por ano, no estilo de `OB-001/2026`. Gerada pelo sistema ao criar, nunca reaproveitada (excluir um rascunho deixa um intervalo) |
| **D-P101** | **De onde vêm os itens** | **Materiais do catálogo** (4C, com busca e seleção de vários) ou **item digitado** (descrição, unidade e quantidade). Equipamentos, mão de obra e serviços ficam de fora: não são materiais |
| **D-P102** | **Ligação com o planejamento** | **Opcional por item:** escolher a atividade. A tela mostra o que o planejamento prevê daquele material e o que já foi pedido. É **informativo, não bloqueia**; a comparação vale só para itens do catálogo com a mesma unidade. Excluir uma atividade ligada a um item enviado só remove a ligação, com a descrição preservada no item |
| **D-P103** | **Aprovar a própria solicitação** | **Permitir**, para quem tem a permissão de aprovar, porque em empresa pequena a mesma pessoa pede e aprova. A tela e o histórico marcam **"aprovada por quem solicitou"**. Uma regra que proíba isso pode virar configuração na 7B |
| **D-P104** | **Aprovação parcial** | **Sim:** quem aprova pode reduzir a quantidade de um item ou zerá-lo, com motivo obrigatório. A quantidade pedida continua registrada. Com todos os itens zerados, use **recusar** |
| **D-P105** | **Aprovação por valor e em dois níveis** | **Fica para a 7B.** A 7A não tem preços: um nível de aprovação |
| **D-P106** | **Correção de erros** | **Desfazer aprovação** e **desfazer atendimento**, com motivo (mesma ideia de reabrir obra concluída, D-P27). Ao desfazer a aprovação, as quantidades aprovadas são limpas (os valores anteriores ficam na auditoria). Quando a 7B existir, não se desfaz aprovação com cotação ou pedido vinculado |
| **D-P107** | **Atendimento antes da 7C** | **"Marcar como atendida" manual**, com data e observação, para o acompanhamento ter fim. Sem atendimento parcial. Na 7C, o recebimento passa a controlar isso; as já atendidas ficam como estão |
| **D-P108** | **Prazo e atraso** | "Necessário até" é opcional. **Atrasada** = data passou e a situação é pendente ou aprovada. É calculado, não gravado |
| **D-P109** | **Avisos** | **Sem e-mail na 7A.** O menu mostra o número de pendentes para quem pode aprovar. E-mail (C6) fica para a 7B e depende do processador de filas e do envio de e-mail em produção |
| **D-P110** | **Anexos** | Documentos e fotos pelos documentos privados, com o limite de tamanho atual |
| **D-P111** | **Ligação futura com o RDO (6C)** | Na 6C, o material **recebido** no RDO poderá apontar o item da solicitação (opcional). Isso **não** marca a solicitação como atendida nem movimenta estoque. Na 7C, o recebimento será o único registro que movimenta estoque, para o material não ser contado duas vezes |
| **D-P112** | **Permissões e acesso** | Ver §5 |

## 5. Permissões (3 novas: 37 → 40)

| Permissão | Uso | Acesso à obra exigido (D-P24) |
|---|---|---|
| `supplies.view` | ver solicitações | ver a obra |
| `supplies.request` | criar, editar, enviar e cancelar as próprias | nível `edit` |
| `supplies.approve` | aprovar, devolver, recusar, desfazer, marcar como atendida, cancelar | nível `edit` |

- Editar um rascunho: quem o criou, ou quem tem `supplies.approve`.
- Papéis de **organizações novas:** `admin` recebe as três; `member` recebe só `supplies.view`.
- Papéis de **organizações existentes** só mudam com autorização expressa.
- Buscar no catálogo exige `resources.view`. Sem ela, resta o item digitado.
- A 6C continua prevendo 3 permissões (`diary.*`), levando o catálogo a 43.

## 6. Segurança e auditoria

- O tenant vem do contexto autenticado. Obra, material, atividade e anexo são validados no mesmo tenant; a atividade também precisa ser da **mesma obra**.
- Outro tenant ou obra sem acesso → 404.
- Mudança de situação numa transação com bloqueio da linha, para duas pessoas não decidirem ao mesmo tempo.
- Auditoria: criação, edição e exclusão (`registry.*`), mais um evento para cada mudança de situação (`supplies.*`).

## 7. Telas

- **Menu Suprimentos** (sai a marca "DEMO" e saem os dados fictícios): todas as solicitações das obras que a pessoa pode ver.
  - Busca por número ou item; filtros por obra, situação, prioridade, solicitante, período e "atrasadas".
  - Indicadores: pendentes, aprovadas aguardando atendimento, atrasadas e urgentes.
  - Colunas: número, obra, solicitante, data, necessário até, itens, prioridade e situação.
- **Obra → aba Requisições:** a mesma lista, já filtrada pela obra.
- **Nova solicitação:** obra, prioridade, necessário até, observações e itens (do catálogo ou digitados, com atividade opcional); salvar rascunho ou enviar.
- **Detalhe:** dados, itens (pedido × aprovado), anexos, histórico e os botões permitidos para a pessoa e a situação.
- Estados de carregamento, vazio e erro; uso no celular.

O cartão "Solicitações pendentes" da **Visão geral** continua de demonstração, como o resto daquela tela.

## 8. Etapas

1. **Banco e regras:** migrations, modelos, numeração, fluxo de situações e testes.
2. **API:** solicitações, itens, decisões, anexos, filtros e indicadores; testes de permissão e de isolamento entre organizações.
3. **Telas:** lista, formulário, detalhe e aba na obra; retirada da demonstração.
4. **Testes completos, CI, banco local** (com autorização) e **homologação da 7A**.

## 9. Banco e publicação

- **Banco local `viaobras`** (precisa de autorização): 4 migrations (3 tabelas e o ajuste em `document_links`) e, se autorizado, as 3 permissões e o ajuste dos papéis da HighTech. Nenhuma solicitação é inserida. A lista exata será apresentada antes.
- **VPS:** nada é publicado sem pedido expresso.

## 10. Riscos

- **Numeração simultânea:** duas criações ao mesmo tempo. A sequência é reservada com bloqueio e protegida por índice único; há teste.
- **Atendimento manual:** pode divergir do que chegou de fato até a 7C existir.
- **Comparação com o planejamento:** itens digitados ou com outra unidade não entram na conta. A tela avisa.
- **Landing:** até a 7A ser publicada, o site apresenta Suprimentos como disponível, e a tela em produção segue como demonstração. A captura e o vídeo precisam ser refeitos quando as telas mudarem.

## 11. Andamento

### Etapa 1 — banco e regras (2026-11-25)

- **Migrations** `2026_11_25_700001` a `700004`: `purchase_requests`, `purchase_request_items`, `purchase_request_history` e `document_links` aceitando `purchase_request`. O número fica na coluna `code`, como nas obras e orçamentos.
- **Regras do banco:** domínios de prioridade, situação e ação; enviada guarda a data do envio; aprovada, recusada e atendida guardam quem decidiu; atendida tem data de atendimento; só rascunho nunca enviado pode ser excluído; quantidade maior que zero; aprovada entre zero e a pedida.
- **Serviços:** `PurchaseRequestService` (criar, alterar, excluir rascunho) e `PurchaseRequestWorkflow` (as 8 ações, com histórico e auditoria `supplies.status_changed`). **Quem** pode executar cada ação (permissão e acesso à obra) entra na etapa 2, junto com a API.
- **Planejamento:** excluir atividade ou o planejamento inteiro solta a ligação dos itens (D-P102).
- **Anexos:** o banco já aceita o vínculo; a API de documentos passa a aceitá-lo na etapa 2.
- **Testes:** `Feature/Supplies/PurchaseRequestWorkflowTest` (29 casos). Suíte da API 511/511. A numeração simultânea é protegida por trava e índice único, mas **não** há teste com duas criações ao mesmo tempo.
- **Banco local `viaobras`:** as 4 migrations foram aplicadas em 2026-11-25 com autorização (93 migrations; backup prévio em `C:\laragon\backup-viaobras`). Nenhum dado inserido.

### Etapa 2 — API e permissões (2026-11-25)

- **Permissões:** `supplies.view`, `supplies.request` e `supplies.approve` no catálogo (40). O `member` de organizações novas recebe `supplies.view`. No banco local, instaladas em 2026-11-25 com autorização: `admin` da HighTech com as três e `member` com `supplies.view`.
- **Quem pode:** classe única `PurchaseRequestAccess` (permissão + acesso à obra). A permissão de cada ação é conferida com a solicitação travada.
- **Rotas** em `/api/v1/purchase-requests`: lista (filtros `q`, `status`, `priority`, `project_uuid`, `requester_uuid`, `from`, `to`, `late`), `summary` (pendentes, aprovadas, atrasadas, urgentes, pendentes aguardando minha decisão e solicitantes), `planning?project_uuid=` (previsto × pedido por atividade; exige também `schedules.view`), ver, criar, alterar, excluir e `workflow/{action}`.
- **Resposta:** quantidades como texto e `abilities` (editar, excluir, anexar e ações disponíveis para quem consulta).
- **Anexos:** a API de documentos aceita `purchase_request`. Vincular um documento continua exigindo permissão de editar o documento (regra dos documentos): quem não tem `documents.manage` pode não conseguir anexar.
- **Testes:** `Feature/Supplies/PurchaseRequestApiTest` (20 casos), com permissões, acesso por obra e isolamento entre organizações. Suíte da API 531/531.

### Etapa 3 — telas (2026-11-25)

- **Menu Suprimentos:** exige `supplies.view`, sem a marca "DEMO". Mostra o número de pendentes para quem pode aprovar. A demonstração (tela, dados fictícios e serviço) foi removida.
- **Lista** (menu e aba **Requisições** da obra): quatro indicadores, busca por número ou material, filtros por obra, situação, prioridade, solicitante, período e atrasadas, e paginação no servidor.
- **Nova solicitação e edição:** materiais do catálogo ou digitados, quantidade com vírgula ("1.500" é mil e quinhentos), atividade opcional com o previsto × já pedido, "Salvar rascunho" e "Salvar e enviar".
- **Detalhe:** dados, itens (pedido × aprovado), anexos, histórico, aviso de devolução e somente os botões que a API permite.
- **Fuso horário:** "hoje" (atraso, atendimento, ano do código e filtro por período) passou a usar o fuso da organização (`LocalDay`). Antes, no Brasil, o dia virava às 21h.
- **Verificação no navegador** (banco `viaobras_testing`, portas separadas, dados "DEMO"): criar, enviar, aprovar em parte, atender, anexar, devolver, editar, excluir, filtrar, aba da obra e largura de celular (sem rolagem horizontal da página), sem erros no console. Não foi testado com um usuário sem permissão de aprovar na tela (as regras estão cobertas pelos testes da API).
- **Testes:** API 532/532; frontend 67/67. O navegador simulado dos testes passou a usar o relógio da aplicação (com a data fixa, os testes perdiam a sessão depois de certo horário).
- **Homologada pelo responsável em 2026-11-25 (A-64).** A próxima parte é a 6C (RDO), que começa pela proposta.
- A captura e o vídeo da landing ainda mostram a demonstração antiga.
