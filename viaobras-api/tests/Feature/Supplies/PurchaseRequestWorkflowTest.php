<?php

use App\Models\AuditLog;
use App\Models\Project;
use App\Models\PurchaseRequest;
use App\Models\PurchaseRequestHistory;
use App\Models\Resource;
use App\Models\ScheduleTask;
use App\Modules\Audit\AuditEvent;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Shared\Exceptions\DomainRuleException;
use App\Modules\Supplies\Services\PurchaseRequestService;
use App\Modules\Supplies\Services\PurchaseRequestWorkflow;
use App\Modules\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Support\Browser;
use Tests\Support\Fx;
use Tests\Support\Scenario;

/*
 * Fase 7A, etapa 1 — solicitações de materiais: dados, numeração e fluxo de situações (FASE7A_MODELO.md, D-P100…D-P108).
 * Obra, catálogo e planejamento são criados pela API já existente; as regras novas são exercitadas pelos serviços.
 * A API da 7A (permissões e acesso à obra) é a etapa 2. Dados "DEMO".
 */

beforeEach(function () {
    $this->travelTo('2026-11-25 12:00:00');
    RateLimiter::clear('login');
    Scenario::catalog();
    $this->A = Scenario::tenant();
    $this->admin = Scenario::member($this->A, 'admin');
    $this->buyer = Scenario::member($this->A, 'member');
    $this->b = new Browser($this);
    $this->b->login($this->admin->email)->assertOk();
    $this->co = $this->b->post('/api/v1/companies', ['legal_name' => 'DEMO Construtora', 'document_number' => '11222333000181'])->json('data.uuid');
    $this->obra = $this->b->post('/api/v1/projects', ['company_uuid' => $this->co, 'name' => 'DEMO Obra', 'start_date' => '2026-03-02'])->assertCreated()->json('data.uuid');
    $this->unit = $this->b->post('/api/v1/units', ['code' => 'SC', 'name' => 'saco'])->assertCreated()->json('data.id');
});

/** Executa no tenant A, como o middleware faria numa requisição. */
function supplyTenant(object $t, Closure $fn): mixed
{
    return app(TenantContext::class)->run($t->A, $fn);
}

function supplyProjectId(object $t, ?string $uuid = null): int
{
    return supplyTenant($t, fn () => Project::query()->where('uuid', $uuid ?? $t->obra)->sole()->id);
}

function supplyCatalogId(object $t, string $kind = 'material', string $name = 'DEMO Cimento'): int
{
    $uuid = $t->b->post('/api/v1/resources', ['kind' => $kind, 'name' => $name, 'unit_id' => $t->unit, 'price' => '36.00'])->assertCreated()->json('data.uuid');

    return supplyTenant($t, fn () => Resource::query()->where('uuid', $uuid)->sole()->id);
}

/** @return int id de uma atividade do planejamento da obra */
function supplyTaskId(object $t, string $project): int
{
    $url = "/api/v1/projects/{$project}/schedule";
    $t->b->post($url, ['origin' => 'blank'])->assertCreated();
    $tasks = $t->b->post("{$url}/tasks", ['name' => 'DEMO Contrapiso', 'planned_start' => '2026-03-02', 'duration_days' => 3])->assertCreated()->json('data.tasks');

    return collect($tasks)->firstWhere('name', 'DEMO Contrapiso')['id'];
}

function supplyItem(string $description = 'DEMO Areia', string $quantity = '10', array $extra = []): array
{
    return ['description' => $description, 'unit_code' => 'M3', 'quantity' => $quantity, ...$extra];
}

function supplyRequest(object $t, array $data = [], ?object $actor = null): PurchaseRequest
{
    return supplyTenant($t, fn () => app(PurchaseRequestService::class)->create(
        ['project_id' => supplyProjectId($t), 'items' => [supplyItem()], ...$data], $actor ?? $t->buyer));
}

function supplyStep(object $t, PurchaseRequest $request, string $action, mixed ...$args): PurchaseRequest
{
    return supplyTenant($t, fn () => app(PurchaseRequestWorkflow::class)->run($request, $action, $args['actor'] ?? $t->admin,
        ...array_diff_key($args, ['actor' => null])));
}

/** @return string código do erro de regra */
function supplyErrorCode(Closure $fn): string
{
    try {
        $fn();
    } catch (ApiException $e) {
        return $e->errorCode;
    }

    return 'sem erro';
}

it('numera por ano em sequência e não reaproveita o código de um rascunho excluído', function () {
    $first = supplyRequest($this);
    $second = supplyRequest($this);
    supplyTenant($this, fn () => app(PurchaseRequestService::class)->delete($second, $this->buyer));

    expect($first->code)->toBe('SOL-001/2026')
        ->and($second->code)->toBe('SOL-002/2026')
        ->and(supplyRequest($this)->code)->toBe('SOL-003/2026')
        ->and(supplyTenant($this, fn () => PurchaseRequest::query()->pluck('code')->all()))->not->toContain('SOL-002/2026');

    $this->travelTo('2027-01-04 12:00:00');

    expect(supplyRequest($this)->code)->toBe('SOL-001/2027');
});

it('copia nome e unidade do material do catálogo e mantém o item digitado como informado', function () {
    $cement = supplyCatalogId($this);
    $request = supplyRequest($this, ['priority' => 'urgent', 'needed_by' => '2026-12-01', 'items' => [
        ['resource_id' => $cement, 'description' => 'ignorada', 'unit_code' => 'XX', 'quantity' => '40'],
        supplyItem('DEMO Areia média', '3.5', ['notes' => 'DEMO lavada']),
    ]]);
    DB::table('resources')->where('id', $cement)->update(['name' => 'DEMO Cimento renomeado']);

    $items = supplyTenant($this, fn () => $request->items()->get(['description', 'unit_code', 'quantity', 'resource_id', 'notes'])->toArray());

    expect($request->only(['status', 'priority', 'requester_id']))->toBe(['status' => 'draft', 'priority' => 'urgent', 'requester_id' => $this->buyer->id])
        ->and($items[0])->toMatchArray(['description' => 'DEMO Cimento', 'unit_code' => 'SC', 'quantity' => '40.0000', 'resource_id' => $cement])
        ->and($items[1])->toMatchArray(['description' => 'DEMO Areia média', 'unit_code' => 'M3', 'quantity' => '3.5000', 'resource_id' => null, 'notes' => 'DEMO lavada']);
});

it('recusa item inválido e não grava a solicitação', function (array $item, string $message) {
    expect(fn () => supplyRequest($this, ['items' => [$item]]))->toThrow(DomainRuleException::class, $message);
    expect(DB::table('purchase_requests')->count())->toBe(0);
})->with([
    'sem descrição' => [['unit_code' => 'M3', 'quantity' => '1'], 'precisa de descrição e unidade'],
    'sem unidade' => [['description' => 'DEMO', 'quantity' => '1'], 'precisa de descrição e unidade'],
    'quantidade zero' => [supplyItem('DEMO', '0'), 'maior que zero'],
    'quantidade negativa' => [supplyItem('DEMO', '-1'), 'maior que zero'],
    'cinco casas decimais' => [supplyItem('DEMO', '1.00001'), 'até 4 casas'],
]);

it('aceita do catálogo somente material', function () {
    $service = supplyCatalogId($this, 'service', 'DEMO Frete');

    expect(fn () => supplyRequest($this, ['items' => [['resource_id' => $service, 'quantity' => '1']]]))
        ->toThrow(DomainRuleException::class, 'material ativo do catálogo');
});

it('liga o item só a uma atividade da mesma obra e solta a ligação quando a atividade é excluída', function () {
    $other = $this->b->post('/api/v1/projects', ['company_uuid' => $this->co, 'name' => 'DEMO Outra obra', 'start_date' => '2026-03-02'])->json('data.uuid');
    $mine = supplyTaskId($this, $this->obra);
    $foreign = supplyTaskId($this, $other);

    expect(fn () => supplyRequest($this, ['items' => [supplyItem('DEMO', '1', ['task_id' => $foreign])]]))
        ->toThrow(DomainRuleException::class, 'não é do planejamento desta obra');

    $request = supplyRequest($this, ['items' => [supplyItem('DEMO Brita', '2', ['task_id' => $mine])]]);
    supplyStep($this, $request, 'submit');
    $this->b->delete("/api/v1/projects/{$this->obra}/schedule/tasks/{$mine}")->assertOk();

    expect(supplyTenant($this, fn () => $request->items()->sole()->only(['task_id', 'description'])))->toBe(['task_id' => null, 'description' => 'DEMO Brita'])
        ->and(supplyTenant($this, fn () => ScheduleTask::query()->whereKey($mine)->exists()))->toBeFalse();
});

it('permite apagar o planejamento inteiro mesmo com atividade ligada a uma solicitação', function () {
    $request = supplyRequest($this, ['items' => [supplyItem('DEMO', '1', ['task_id' => supplyTaskId($this, $this->obra)])]]);

    $this->b->delete("/api/v1/projects/{$this->obra}/schedule")->assertSuccessful();

    expect(supplyTenant($this, fn () => $request->items()->sole()->task_id))->toBeNull();
});

it('altera e exclui só o rascunho; o que já foi enviado se cancela', function () {
    $request = supplyRequest($this);
    $service = fn () => app(PurchaseRequestService::class);
    $updated = supplyTenant($this, fn () => $service()->update($request, ['priority' => 'high', 'items' => [supplyItem('DEMO Novo', '7')]], $this->buyer));

    expect($updated->priority)->toBe('high')
        ->and(supplyTenant($this, fn () => $updated->items()->pluck('description')->all()))->toBe(['DEMO Novo']);

    supplyStep($this, $request, 'submit');

    expect(fn () => supplyTenant($this, fn () => $service()->update($request, ['priority' => 'low'], $this->buyer)))->toThrow(DomainRuleException::class, 'em rascunho')
        ->and(fn () => supplyTenant($this, fn () => $service()->delete($request, $this->buyer)))->toThrow(DomainRuleException::class, 'em rascunho');

    supplyStep($this, $request, 'send_back', reason: 'DEMO ajustar quantidade');

    expect(fn () => supplyTenant($this, fn () => $service()->delete($request, $this->buyer)))->toThrow(DomainRuleException::class, 'já enviada');
});

it('percorre envio, aprovação e atendimento, guardando o histórico de cada passo', function () {
    $request = supplyRequest($this);

    $request = supplyStep($this, $request, 'submit', actor: $this->buyer);
    expect($request->status)->toBe('pending')->and($request->submitted_at)->not->toBeNull();

    $request = supplyStep($this, $request, 'approve');
    expect($request->status)->toBe('approved')->and($request->decided_by)->toBe($this->admin->id)
        ->and($request->wasApprovedByRequester())->toBeFalse()
        ->and(supplyTenant($this, fn () => $request->items()->sole()->approved_quantity))->toBe('10.0000');

    $request = supplyStep($this, $request, 'fulfill', reason: 'DEMO entregue no canteiro');
    expect($request->status)->toBe('received')->and($request->fulfilled_on->toDateString())->toBe('2026-11-25');

    $history = supplyTenant($this, fn () => $request->history()->get()->map(fn ($h) => [$h->action, $h->from_status, $h->to_status, $h->changed_by])->all());
    expect($history)->toBe([
        ['submit', 'draft', 'pending', $this->buyer->id],
        ['approve', 'pending', 'approved', $this->admin->id],
        ['fulfill', 'approved', 'received', $this->admin->id],
    ])->and(AuditLog::query()->where('event', AuditEvent::SUPPLIES_STATUS_CHANGED)->where('tenant_id', $this->A->id)->count())->toBe(3);
});

it('permite aprovar a própria solicitação e sinaliza', function () {
    $request = supplyRequest($this, actor: $this->admin);
    supplyStep($this, $request, 'submit');
    $request = supplyStep($this, $request, 'approve');

    expect($request->wasApprovedByRequester())->toBeTrue()
        ->and(AuditLog::query()->where('event', AuditEvent::SUPPLIES_STATUS_CHANGED)->latest('id')->first()->metadata['approved_by_requester'])->toBeTrue();
});

it('aprova em parte somente com motivo, dentro do pedido e sem zerar tudo', function () {
    $request = supplyRequest($this, ['items' => [supplyItem('DEMO A', '10'), supplyItem('DEMO B', '4')]]);
    supplyStep($this, $request, 'submit');
    [$a, $b] = supplyTenant($this, fn () => $request->items()->pluck('id')->all());
    $approve = fn (array $quantities, ?string $reason = 'DEMO motivo') => supplyErrorCode(fn () => supplyStep($this, $request, 'approve', reason: $reason, approvedQuantities: $quantities));

    expect($approve([$a => '6'], null))->toBe('reason_required')
        ->and($approve([$a => '10.0001']))->toBe('invalid_approved_quantity')
        ->and($approve([$a => '-1']))->toBe('invalid_approved_quantity')
        ->and($approve([$a => '0', $b => '0']))->toBe('nothing_approved')
        ->and($approve([999999 => '1']))->toBe('unknown_item')
        ->and(supplyTenant($this, fn () => $request->fresh()->status))->toBe('pending')
        ->and($approve([$a => '6', $b => '0']))->toBe('sem erro')
        ->and(supplyTenant($this, fn () => $request->items()->get()->map(fn ($i) => [$i->quantity, $i->approved_quantity])->all()))
        ->toBe([['10.0000', '6.0000'], ['4.0000', '0.0000']]);
});

it('desfaz aprovação e atendimento com motivo, limpando o que foi decidido e guardando os valores na auditoria', function () {
    $request = supplyRequest($this);
    supplyStep($this, $request, 'submit');
    $itemId = supplyTenant($this, fn () => $request->items()->sole()->id);
    supplyStep($this, $request, 'approve', reason: 'DEMO parte', approvedQuantities: [$itemId => '8']);
    supplyStep($this, $request, 'fulfill', fulfilledOn: '2026-11-25');

    $request = supplyStep($this, $request, 'revert_fulfillment', reason: 'DEMO não chegou');
    expect($request->status)->toBe('approved')->and($request->fulfilled_on)->toBeNull();

    $request = supplyStep($this, $request, 'revoke_approval', reason: 'DEMO aprovada por engano');
    expect($request->only(['status', 'decided_by', 'decided_at']))->toBe(['status' => 'pending', 'decided_by' => null, 'decided_at' => null])
        ->and(supplyTenant($this, fn () => $request->items()->sole()->approved_quantity))->toBeNull()
        ->and(AuditLog::query()->where('event', AuditEvent::SUPPLIES_STATUS_CHANGED)->latest('id')->first()->metadata['quantities'][0]['approved'])->toBe('8.0000');
});

it('exige motivo nos passos que voltam, recusam ou cancelam algo já enviado', function (array $path, string $action) {
    $request = supplyRequest($this);
    foreach ($path as $previous) {
        supplyStep($this, $request, $previous);
    }

    expect(supplyErrorCode(fn () => supplyStep($this, $request, $action, reason: '   ')))->toBe('reason_required');
})->with([
    'devolver' => [['submit'], 'send_back'],
    'recusar' => [['submit'], 'reject'],
    'desfazer aprovação' => [['submit', 'approve'], 'revoke_approval'],
    'desfazer atendimento' => [['submit', 'approve', 'fulfill'], 'revert_fulfillment'],
    'cancelar pendente' => [['submit'], 'cancel'],
    'cancelar aprovada' => [['submit', 'approve'], 'cancel'],
]);

it('cancela rascunho sem motivo e não sai de recusada nem de cancelada', function () {
    $draft = supplyRequest($this);
    $rejected = supplyRequest($this);
    supplyStep($this, $rejected, 'submit');
    supplyStep($this, $rejected, 'reject', reason: 'DEMO sem verba');

    expect(supplyStep($this, $draft, 'cancel')->status)->toBe('canceled');

    foreach (PurchaseRequestWorkflow::ACTIONS as $action) {
        expect(supplyErrorCode(fn () => supplyStep($this, $draft, $action, reason: 'DEMO')))->toBe('invalid_transition')
            ->and(supplyErrorCode(fn () => supplyStep($this, $rejected, $action, reason: 'DEMO')))->toBe('invalid_transition');
    }
});

it('não envia solicitação sem itens', function () {
    $request = supplyRequest($this, ['items' => []]);

    expect(supplyErrorCode(fn () => supplyStep($this, $request, 'submit')))->toBe('empty_request');
});

it('aceita a data do atendimento somente entre o envio e hoje', function (string $date) {
    $request = supplyRequest($this);
    supplyStep($this, $request, 'submit');
    supplyStep($this, $request, 'approve');

    expect(supplyErrorCode(fn () => supplyStep($this, $request, 'fulfill', fulfilledOn: $date)))->toBe('invalid_fulfillment_date');
})->with(['antes do envio' => '2026-11-24', 'no futuro' => '2026-11-26']);

it('marca como atrasada só a pendente ou aprovada com a data vencida', function () {
    $late = supplyRequest($this, ['needed_by' => '2026-11-24']);
    $today = supplyRequest($this, ['needed_by' => '2026-11-25']);
    $draft = supplyRequest($this, ['needed_by' => '2026-11-01']);
    supplyStep($this, $late, 'submit');
    supplyStep($this, $today, 'submit');

    expect(supplyTenant($this, fn () => PurchaseRequest::query()->late()->pluck('code')->all()))->toBe([$late->code])
        ->and(supplyTenant($this, fn () => [$late->fresh()->isLate(), $today->fresh()->isLate(), $draft->isLate()]))->toBe([true, false, false]);
});

it('usa o dia da organização, não o do servidor, para atraso, atendimento e ano do código', function () {
    $this->travelTo('2026-11-26 01:30:00'); // 22:30 de 25/11 em São Paulo
    $request = supplyRequest($this, ['needed_by' => '2026-11-25']);
    supplyStep($this, $request, 'submit');

    expect(supplyTenant($this, fn () => $request->fresh()->isLate()))->toBeFalse()
        ->and(supplyTenant($this, fn () => PurchaseRequest::query()->late()->count()))->toBe(0);

    supplyStep($this, $request, 'approve');
    expect(supplyStep($this, $request, 'fulfill')->fulfilled_on->toDateString())->toBe('2026-11-25');

    $this->travelTo('2027-01-01 02:00:00'); // ainda 31/12/2026 no fuso da organização

    expect(supplyRequest($this)->code)->toBe('SOL-002/2026');
});

it('mantém o histórico somente de inclusão', function () {
    $request = supplyRequest($this);
    supplyStep($this, $request, 'submit');

    expect(fn () => supplyTenant($this, fn () => PurchaseRequestHistory::query()->update(['reason' => 'x'])))->toThrow(LogicException::class)
        ->and(fn () => supplyTenant($this, fn () => $request->history()->first()->delete()))->toThrow(LogicException::class);
});

it('o banco recusa vínculo com obra de outra organização e dados incoerentes', function () {
    $request = supplyRequest($this);
    $tenantB = Scenario::tenant();
    $userB = Scenario::member($tenantB, 'admin');
    $row = fn (array $extra) => fn () => DB::table('purchase_requests')->insert(['tenant_id' => $this->A->id, 'uuid' => (string) Str::uuid(),
        'code' => 'SOL-900/2026', 'project_id' => $request->project_id, 'requester_id' => $this->buyer->id, ...$extra]);

    expect(Fx::errno($row(['tenant_id' => $tenantB->id, 'requester_id' => $userB->id])))->toBe(1452) // obra de outro tenant
        ->and(Fx::errno($row(['status' => 'approved', 'submitted_at' => now()])))->toBe(3819) // aprovada sem quem decidiu
        ->and(Fx::errno($row(['status' => 'pending'])))->toBe(3819) // pendente sem data de envio
        ->and(Fx::errno(fn () => DB::table('purchase_request_items')->where('request_id', $request->id)->update(['approved_quantity' => '11'])))->toBe(3819)
        ->and(fn () => DB::table('purchase_requests')->where('id', $request->id)->update(['status' => 'pending', 'submitted_at' => now(), 'deleted_at' => now()]))
        ->toThrow(QueryException::class);
});

it('aceita anexo ligado a uma solicitação no banco', function () {
    $document = Fx::document($this->A->id, $this->admin->id);

    DB::table('document_links')->insert(['tenant_id' => $this->A->id, 'document_id' => $document, 'linkable_type' => 'purchase_request', 'linkable_id' => 1]);

    expect(DB::table('document_links')->where('linkable_type', 'purchase_request')->count())->toBe(1);
});
