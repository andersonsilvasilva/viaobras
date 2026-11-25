<?php

use App\Models\AuditLog;
use App\Models\UserProjectAccess;
use App\Modules\Audit\AuditEvent;
use App\Modules\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Support\Browser;
use Tests\Support\Concerns;
use Tests\Support\Scenario;

/*
 * Fase 7A, etapa 2 — API das solicitações de materiais (FASE7A_MODELO.md, D-P100…D-P112): criação, filtros, indicadores,
 * permissões somadas ao acesso por obra, isolamento entre organizações, comparação com o planejamento e anexos.
 * Dados "DEMO".
 */

beforeEach(function () {
    $this->travelTo('2026-11-25 12:00:00');
    RateLimiter::clear('login');
    Scenario::catalog();
    $this->A = Scenario::tenant();
    $this->admin = Scenario::member($this->A, 'admin');
    $this->b = new Browser($this);
    $this->b->login($this->admin->email)->assertOk();
    $this->co = $this->b->post('/api/v1/companies', ['legal_name' => 'DEMO Construtora', 'document_number' => '11222333000181'])->json('data.uuid');
    $this->obra = $this->b->post('/api/v1/projects', ['company_uuid' => $this->co, 'name' => 'DEMO Obra', 'start_date' => '2026-03-02'])->assertCreated()->json('data.uuid');
    $this->unit = $this->b->post('/api/v1/units', ['code' => 'SC', 'name' => 'saco'])->assertCreated()->json('data.id');
});

/** Usuário com um papel só com as permissões dadas e (opcional) acesso à obra no nível dado; devolve o navegador dele. */
function supplyUser(object $t, array $permissions, ?string $level = 'edit', ?string $project = null): Browser
{
    static $n = 0;
    $role = 'demo-supply-'.(++$n);
    Concerns::role($t->A, $role, ['projects.view', ...$permissions]);
    $user = Scenario::member($t->A, $role);

    if ($level !== null) {
        app(TenantContext::class)->run($t->A, function () use ($t, $user, $level, $project): void {
            $access = new UserProjectAccess;
            $access->forceFill(['user_id' => $user->id, 'access_level' => $level, 'granted_by' => $t->admin->id,
                'project_id' => DB::table('projects')->where('uuid', $project ?? $t->obra)->value('id')])->save();
        });
    }

    $browser = new Browser($t);
    $browser->login($user->email)->assertOk();

    return $browser;
}

function supplyPayload(object $t, array $extra = []): array
{
    return ['project_uuid' => $t->obra, 'items' => [['description' => 'DEMO Areia', 'unit_code' => 'M3', 'quantity' => '10']], ...$extra];
}

function supplyCreate(object $t, ?Browser $as = null, array $extra = []): string
{
    return ($as ?? $t->b)->post('/api/v1/purchase-requests', supplyPayload($t, $extra))->assertCreated()->json('data.uuid');
}

function supplyAct(Browser $as, string $uuid, string $action, array $data = [])
{
    return $as->post("/api/v1/purchase-requests/{$uuid}/workflow/{$action}", $data);
}

it('cria com itens do catálogo e digitados e mostra o detalhe com o que o usuário pode fazer', function () {
    $cement = $this->b->post('/api/v1/resources', ['kind' => 'material', 'name' => 'DEMO Cimento', 'unit_id' => $this->unit, 'price' => '36.00'])->json('data.uuid');

    $this->b->post('/api/v1/purchase-requests', supplyPayload($this, ['priority' => 'high', 'needed_by' => '2026-12-01', 'notes' => 'DEMO obs', 'items' => [
        ['resource_uuid' => $cement, 'quantity' => 40],
        ['description' => 'DEMO Areia', 'unit_code' => 'M3', 'quantity' => '2.5'],
    ]]))->assertCreated()
        ->assertJsonPath('data.code', 'SOL-001/2026')->assertJsonPath('data.status', 'draft')->assertJsonPath('data.items_count', 2)
        ->assertJsonPath('data.items.0.resource_uuid', $cement)->assertJsonPath('data.items.0.description', 'DEMO Cimento')
        ->assertJsonPath('data.items.0.unit_code', 'SC')->assertJsonPath('data.items.0.quantity', '40.0000')
        ->assertJsonPath('data.items.1.resource_uuid', null)->assertJsonPath('data.requester.uuid', $this->admin->uuid)
        ->assertJsonPath('data.abilities', ['edit' => true, 'delete' => true, 'attach' => true, 'actions' => ['submit', 'cancel']])
        ->assertJsonMissingPath('data.id')->assertJsonMissingPath('data.project.id');
});

it('valida os dados com 422', function (array $extra, string $field) {
    $this->b->post('/api/v1/purchase-requests', supplyPayload($this, $extra))->assertUnprocessable()->assertJsonValidationErrors($field, 'error.details');

    expect(DB::table('purchase_requests')->count())->toBe(0);
})->with([
    'sem obra' => [['project_uuid' => null], 'project_uuid'],
    'prioridade desconhecida' => [['priority' => 'agora'], 'priority'],
    'data inválida' => [['needed_by' => '01/12/2026'], 'needed_by'],
    'item sem descrição' => [['items' => [['unit_code' => 'M3', 'quantity' => '1']]], 'items.0.description'],
    'item sem unidade' => [['items' => [['description' => 'DEMO', 'quantity' => '1']]], 'items.0.unit_code'],
    'quantidade zero' => [['items' => [['description' => 'DEMO', 'unit_code' => 'M3', 'quantity' => '0']]], 'items.0.quantity'],
    'material inexistente' => [['items' => [['resource_uuid' => '00000000-0000-4000-8000-000000000000', 'quantity' => '1']]], 'items.0.resource_uuid'],
]);

it('edita, envia, aprova em parte e atende pela API, devolvendo o histórico', function () {
    $uuid = supplyCreate($this);
    $item = $this->b->put("/api/v1/purchase-requests/{$uuid}", ['items' => [['description' => 'DEMO Brita', 'unit_code' => 'M3', 'quantity' => '8']]])
        ->assertOk()->assertJsonPath('data.items.0.description', 'DEMO Brita')->json('data.items.0.id');

    supplyAct($this->b, $uuid, 'submit')->assertOk()->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.abilities.actions', ['approve', 'send_back', 'reject', 'cancel'])->assertJsonPath('data.abilities.edit', false);
    supplyAct($this->b, $uuid, 'approve', ['items' => [['id' => $item, 'approved_quantity' => '5']]])
        ->assertUnprocessable()->assertJsonPath('error.code', 'reason_required');
    supplyAct($this->b, $uuid, 'approve', ['reason' => 'DEMO estoque parcial', 'items' => [['id' => $item, 'approved_quantity' => '5']]])
        ->assertOk()->assertJsonPath('data.status', 'approved')->assertJsonPath('data.items.0.approved_quantity', '5.0000')
        ->assertJsonPath('data.approved_by_requester', true)->assertJsonPath('data.decided_by.uuid', $this->admin->uuid);
    supplyAct($this->b, $uuid, 'fulfill', ['fulfilled_on' => '2026-11-25'])->assertOk()
        ->assertJsonPath('data.status', 'received')->assertJsonPath('data.fulfilled_on', '2026-11-25')
        ->assertJsonPath('data.history.0.action', 'submit')->assertJsonPath('data.history.1.reason', 'DEMO estoque parcial')
        ->assertJsonPath('data.history.2.to', 'received')->assertJsonPath('data.abilities.actions', ['revert_fulfillment']);

    $this->b->put("/api/v1/purchase-requests/{$uuid}", ['notes' => 'x'])->assertUnprocessable()->assertJsonPath('error.code', 'domain_rule');
    $this->b->delete("/api/v1/purchase-requests/{$uuid}")->assertUnprocessable();
});

it('lista com filtros, busca por número ou material e devolve os indicadores', function () {
    $late = supplyCreate($this, extra: ['priority' => 'urgent', 'needed_by' => '2026-11-20', 'items' => [['description' => 'DEMO Cimento CP-II', 'unit_code' => 'SC', 'quantity' => '1']]]);
    $approved = supplyCreate($this);
    $draft = supplyCreate($this);
    supplyAct($this->b, $late, 'submit')->assertOk();
    supplyAct($this->b, $approved, 'submit')->assertOk();
    supplyAct($this->b, $approved, 'approve')->assertOk();

    $uuids = fn (string $query) => $this->b->get("/api/v1/purchase-requests?{$query}")->assertOk()->json('data.*.uuid');

    expect($uuids(''))->toBe([$draft, $approved, $late])
        ->and($uuids('status=pending'))->toBe([$late])
        ->and($uuids('priority=urgent'))->toBe([$late])
        ->and($uuids('late=1'))->toBe([$late])
        ->and($uuids('q=cp-ii'))->toBe([$late])
        ->and($uuids('q=SOL-002'))->toBe([$approved])
        ->and($uuids('q=%25'))->toBe([]) // curinga digitado é texto, não "tudo"
        ->and($uuids("project_uuid={$this->obra}&from=2026-11-25&to=2026-11-25"))->toHaveCount(3)
        ->and($uuids('from=2026-11-26'))->toBe([])
        ->and($uuids("requester_uuid={$this->admin->uuid}"))->toHaveCount(3);

    $this->b->get('/api/v1/purchase-requests/summary')->assertOk()
        ->assertJsonPath('data.pending', 1)->assertJsonPath('data.approved', 1)->assertJsonPath('data.late', 1)->assertJsonPath('data.urgent', 1)
        ->assertJsonPath('data.awaiting_my_approval', 1)->assertJsonPath('data.requesters.0.uuid', $this->admin->uuid);
});

it('responde 404 a quem não vê a obra e não conta nem lista nada dela', function () {
    $uuid = supplyCreate($this);
    supplyAct($this->b, $uuid, 'submit')->assertOk();
    $outsider = supplyUser($this, ['supplies.view', 'supplies.request', 'supplies.approve'], level: null);

    $outsider->get("/api/v1/purchase-requests/{$uuid}")->assertNotFound();
    supplyAct($outsider, $uuid, 'approve')->assertNotFound();
    $outsider->post('/api/v1/purchase-requests', supplyPayload($this))->assertNotFound();
    $outsider->get("/api/v1/purchase-requests/planning?project_uuid={$this->obra}")->assertForbidden(); // sem schedules.view
    $outsider->get('/api/v1/purchase-requests')->assertOk()->assertJsonPath('meta.total', 0);
    $outsider->get('/api/v1/purchase-requests/summary')->assertOk()->assertJsonPath('data.pending', 0)
        ->assertJsonPath('data.awaiting_my_approval', 0)->assertJsonPath('data.requesters', []);
});

it('recusa com 403 quem não tem supplies.view', function () {
    $nobody = supplyUser($this, []);

    $nobody->get('/api/v1/purchase-requests')->assertForbidden();
    $nobody->post('/api/v1/purchase-requests', supplyPayload($this))->assertForbidden();
});

it('exige nível de edição na obra para escrever, mesmo com todas as permissões', function () {
    $uuid = supplyCreate($this);
    supplyAct($this->b, $uuid, 'submit')->assertOk();
    $reader = supplyUser($this, ['supplies.view', 'supplies.request', 'supplies.approve'], level: 'view');

    $reader->get("/api/v1/purchase-requests/{$uuid}")->assertOk()
        ->assertJsonPath('data.abilities', ['edit' => false, 'delete' => false, 'attach' => false, 'actions' => []]);
    $reader->post('/api/v1/purchase-requests', supplyPayload($this))->assertForbidden();
    supplyAct($reader, $uuid, 'approve')->assertForbidden();
    $reader->get('/api/v1/purchase-requests/summary')->assertJsonPath('data.pending', 1)->assertJsonPath('data.awaiting_my_approval', 0);
});

it('quem só solicita cuida das próprias, não decide e não mexe nas de outra pessoa', function () {
    $requester = supplyUser($this, ['supplies.view', 'supplies.request']);
    $colleague = supplyUser($this, ['supplies.view', 'supplies.request']);
    $mine = supplyCreate($this, $requester);

    $colleague->put("/api/v1/purchase-requests/{$mine}", ['notes' => 'x'])->assertForbidden();
    $colleague->delete("/api/v1/purchase-requests/{$mine}")->assertForbidden();
    supplyAct($colleague, $mine, 'submit')->assertForbidden();

    supplyAct($requester, $mine, 'submit')->assertOk()->assertJsonPath('data.abilities.actions', ['cancel']);
    foreach (['approve', 'send_back', 'reject'] as $decision) {
        supplyAct($requester, $mine, $decision, ['reason' => 'DEMO'])->assertForbidden();
    }
    supplyAct($colleague, $mine, 'cancel', ['reason' => 'DEMO'])->assertForbidden();

    // depois de aprovada, quem pediu já não cancela
    supplyAct($this->b, $mine, 'approve')->assertOk()->assertJsonPath('data.approved_by_requester', false);
    supplyAct($requester, $mine, 'cancel', ['reason' => 'DEMO'])->assertForbidden();
    $requester->get("/api/v1/purchase-requests/{$mine}")->assertJsonPath('data.abilities.actions', []);

    expect(DB::table('purchase_requests')->where('uuid', $mine)->value('status'))->toBe('approved');
});

it('quem pode aprovar edita o rascunho de outra pessoa; quem só vê não cria', function () {
    $requester = supplyUser($this, ['supplies.view', 'supplies.request']);
    $approver = supplyUser($this, ['supplies.view', 'supplies.approve']);
    $viewer = supplyUser($this, ['supplies.view']);
    $uuid = supplyCreate($this, $requester);

    $approver->put("/api/v1/purchase-requests/{$uuid}", ['priority' => 'low'])->assertOk()->assertJsonPath('data.priority', 'low');
    $approver->post('/api/v1/purchase-requests', supplyPayload($this))->assertForbidden(); // aprovar não é solicitar
    $viewer->post('/api/v1/purchase-requests', supplyPayload($this))->assertForbidden();
});

it('recusa material do catálogo para quem não pode ver o catálogo', function () {
    $cement = $this->b->post('/api/v1/resources', ['kind' => 'material', 'name' => 'DEMO Cimento', 'unit_id' => $this->unit, 'price' => '36.00'])->json('data.uuid');
    $requester = supplyUser($this, ['supplies.view', 'supplies.request']);

    $requester->post('/api/v1/purchase-requests', supplyPayload($this, ['items' => [['resource_uuid' => $cement, 'quantity' => '1']]]))->assertForbidden();
    $requester->post('/api/v1/purchase-requests', supplyPayload($this))->assertCreated();
});

it('isola as organizações: não lê, não altera e não usa obra ou material da outra', function () {
    $uuid = supplyCreate($this);
    $cement = $this->b->post('/api/v1/resources', ['kind' => 'material', 'name' => 'DEMO Cimento', 'unit_id' => $this->unit, 'price' => '36.00'])->json('data.uuid');

    $other = Scenario::tenant();
    $stranger = Scenario::member($other, 'admin');
    $sb = new Browser($this);
    $sb->login($stranger->email)->assertOk();
    $company = $sb->post('/api/v1/companies', ['legal_name' => 'DEMO B', 'document_number' => '11444777000161'])->json('data.uuid');
    $theirProject = $sb->post('/api/v1/projects', ['company_uuid' => $company, 'name' => 'DEMO Obra B'])->assertCreated()->json('data.uuid');

    $sb->get("/api/v1/purchase-requests/{$uuid}")->assertNotFound();
    $sb->put("/api/v1/purchase-requests/{$uuid}", ['notes' => 'x'])->assertNotFound();
    $sb->delete("/api/v1/purchase-requests/{$uuid}")->assertNotFound();
    supplyAct($sb, $uuid, 'submit')->assertNotFound();
    $sb->get('/api/v1/purchase-requests')->assertJsonPath('meta.total', 0);
    $sb->get("/api/v1/purchase-requests/planning?project_uuid={$this->obra}")->assertNotFound();
    $sb->post('/api/v1/purchase-requests', supplyPayload($this))->assertUnprocessable()->assertJsonValidationErrors('project_uuid', 'error.details');
    $sb->post('/api/v1/purchase-requests', ['project_uuid' => $theirProject, 'items' => [['resource_uuid' => $cement, 'quantity' => '1']]])
        ->assertUnprocessable()->assertJsonValidationErrors('items.0.resource_uuid', 'error.details');
    // a numeração é por organização
    $sb->post('/api/v1/purchase-requests', ['project_uuid' => $theirProject])->assertCreated()->assertJsonPath('data.code', 'SOL-001/2026');

    expect(DB::table('purchase_requests')->where('uuid', $uuid)->value('status'))->toBe('draft');
});

it('mostra o previsto no planejamento e o já pedido, contando só pendente, aprovada e atendida', function () {
    $cement = $this->b->post('/api/v1/resources', ['kind' => 'material', 'name' => 'DEMO Cimento', 'unit_id' => $this->unit, 'price' => '36.00'])->json('data.uuid');
    $url = "/api/v1/projects/{$this->obra}/schedule";
    $this->b->post($url, ['origin' => 'blank'])->assertCreated();
    $task = $this->b->post("{$url}/tasks", ['name' => 'DEMO Contrapiso', 'planned_start' => '2026-03-02', 'duration_days' => 3, 'unit_code' => 'M2', 'quantity' => '10'])
        ->json('data.tasks.0.id');
    $this->b->post("{$url}/tasks/{$task}/items", ['source' => 'catalog', 'resource_uuids' => [$cement], 'quantity_per_unit' => '0.5'])->assertCreated();
    $items = fn (string $quantity) => ['items' => [['resource_uuid' => $cement, 'quantity' => $quantity, 'task_id' => $task]]];

    $pending = supplyCreate($this, extra: $items('2'));
    supplyAct($this->b, $pending, 'submit')->assertOk();
    $partial = supplyCreate($this, extra: $items('3'));
    $itemId = supplyAct($this->b, $partial, 'submit')->json('data.items.0.id');
    supplyAct($this->b, $partial, 'approve', ['reason' => 'DEMO', 'items' => [['id' => $itemId, 'approved_quantity' => '1']]])->assertOk();
    supplyCreate($this, extra: $items('100')); // rascunho não conta
    $rejected = supplyCreate($this, extra: $items('50'));
    supplyAct($this->b, $rejected, 'submit')->assertOk();
    supplyAct($this->b, $rejected, 'reject', ['reason' => 'DEMO'])->assertOk();

    $this->b->get("/api/v1/purchase-requests/planning?project_uuid={$this->obra}")->assertOk()
        ->assertJsonPath('data.0.id', $task)->assertJsonPath('data.0.name', 'DEMO Contrapiso')
        ->assertJsonPath('data.0.materials', [['resource_uuid' => $cement, 'description' => 'DEMO Cimento', 'unit_code' => 'SC',
            'planned' => '5.0000', 'requested' => '3.0000']]); // previsto 10 × 0,5; pedido 2 (pendente) + 1 (aprovado em parte)
});

it('anexa documentos à solicitação respeitando quem pode alterá-la', function () {
    $uuid = supplyCreate($this);
    $doc = $this->b->post('/api/v1/documents', ['title' => 'DEMO Foto do local'])->assertCreated()->json('data.uuid');

    $this->b->post("/api/v1/documents/{$doc}/links", ['linkable_type' => 'purchase_request', 'linkable_key' => $uuid])->assertCreated();
    $this->b->get("/api/v1/documents?linkable_type=purchase_request&linkable_key={$uuid}")->assertOk()->assertJsonPath('data.0.uuid', $doc);
    $this->b->get("/api/v1/purchase-requests/{$uuid}")->assertJsonPath('data.documents_count', 1);
    $this->b->get('/api/v1/purchase-requests')->assertJsonPath('data.0.documents_count', 1);

    // gerencia documentos, mas só lê a obra: vê o anexo e não consegue vincular outro
    $reader = supplyUser($this, ['supplies.view', 'supplies.approve', 'documents.view', 'documents.manage'], level: 'view');
    $other = $reader->post('/api/v1/documents', ['title' => 'DEMO Outro'])->assertCreated()->json('data.uuid');
    $reader->get("/api/v1/documents?linkable_type=purchase_request&linkable_key={$uuid}")->assertJsonPath('meta.total', 1);
    $reader->post("/api/v1/documents/{$other}/links", ['linkable_type' => 'purchase_request', 'linkable_key' => $uuid])->assertNotFound();

    // sem acesso à obra, a busca pela solicitação não revela nada
    supplyUser($this, ['supplies.view', 'documents.view'], level: null)
        ->get("/api/v1/documents?linkable_type=purchase_request&linkable_key={$uuid}")->assertOk()->assertJsonPath('meta.total', 0);
});

it('audita a criação, a alteração, a exclusão e as mudanças de situação na organização certa', function () {
    $uuid = supplyCreate($this);
    $this->b->put("/api/v1/purchase-requests/{$uuid}", ['priority' => 'low'])->assertOk();
    $this->b->delete("/api/v1/purchase-requests/{$uuid}")->assertNoContent();
    supplyAct($this->b, supplyCreate($this), 'submit')->assertOk();

    $events = AuditLog::query()->where('entity_type', 'purchase_request')->get();

    expect($events->pluck('event')->unique()->sort()->values()->all())
        ->toBe([AuditEvent::REGISTRY_CREATED, AuditEvent::REGISTRY_DELETED, AuditEvent::REGISTRY_UPDATED, AuditEvent::SUPPLIES_STATUS_CHANGED])
        ->and($events->pluck('tenant_id')->unique()->all())->toBe([$this->A->id])
        ->and(array_diff(AuditEvent::phase7(), $events->pluck('event')->all()))->toBe([]);
    $this->b->get("/api/v1/purchase-requests/{$uuid}")->assertNotFound();
});
