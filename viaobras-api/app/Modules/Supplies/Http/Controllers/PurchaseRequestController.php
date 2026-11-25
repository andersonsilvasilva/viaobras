<?php

namespace App\Modules\Supplies\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\DocumentLink;
use App\Models\Project;
use App\Models\PurchaseRequest;
use App\Models\User;
use App\Modules\Projects\Services\ProjectAccess;
use App\Modules\Registry\Http\Controllers\Concerns\ListsRecords;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Supplies\Http\Requests\PurchaseRequestActionRequest;
use App\Modules\Supplies\Http\Requests\PurchaseRequestRequest;
use App\Modules\Supplies\Http\Resources\PurchaseRequestResource;
use App\Modules\Supplies\Services\LocalDay;
use App\Modules\Supplies\Services\PlannedMaterials;
use App\Modules\Supplies\Services\PurchaseRequestAccess;
use App\Modules\Supplies\Services\PurchaseRequestService;
use App\Modules\Supplies\Services\PurchaseRequestWorkflow;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Solicitações de materiais (Fase 7A). Autorização em duas camadas: `supplies.view` na rota e PurchaseRequestAccess
 * por solicitação (permissão da ação + acesso por obra). Solicitação invisível → 404.
 */
class PurchaseRequestController extends Controller
{
    use ListsRecords;

    private const LIST_RELATIONS = ['project', 'requester', 'decider'];

    private const DETAIL_RELATIONS = [...self::LIST_RELATIONS, 'items.resource', 'items.task', 'history.changer'];

    public function __construct(
        private readonly PurchaseRequestService $requests,
        private readonly PurchaseRequestWorkflow $workflow,
        private readonly PurchaseRequestAccess $access,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = $this->access->visible(PurchaseRequest::query()->with(self::LIST_RELATIONS)->withCount('items')
            ->selectSub(DocumentLink::query()->selectRaw('count(*)')->where('linkable_type', 'purchase_request')->whereColumn('linkable_id', 'purchase_requests.id'), 'documents_count')
            ->addSelect('purchase_requests.*'), $request->user())->orderByDesc('id');
        $this->filter($query, $request);

        return $this->paginated($query, $request, PurchaseRequestResource::class);
    }

    /** Indicadores do topo (respeitam a obra filtrada), solicitantes para o filtro e o número do menu. */
    public function summary(Request $request): JsonResponse
    {
        $base = function () use ($request): Builder {
            $query = $this->access->visible(PurchaseRequest::query(), $request->user());
            if ($request->filled('project_uuid')) {
                $this->ofProject($query, (string) $request->query('project_uuid'));
            }

            return $query;
        };

        return response()->json(['data' => [
            'pending' => $base()->where('status', 'pending')->count(),
            'approved' => $base()->where('status', 'approved')->count(),
            'late' => $base()->late()->count(),
            'urgent' => $base()->whereIn('status', PurchaseRequest::OPEN_STATUSES)->where('priority', 'urgent')->count(),
            'awaiting_my_approval' => $this->access->awaitingApproval($request->user()),
            'requesters' => User::query()->whereIn('id', $base()->select('requester_id'))->orderBy('name')->get(['uuid', 'name']),
        ]]);
    }

    /** Atividades da obra com o previsto e o já pedido de cada material (D-P102). */
    public function planning(Request $request, PlannedMaterials $planned, ProjectAccess $projects): JsonResponse
    {
        $uuid = $request->validate(['project_uuid' => ['required', 'uuid']])['project_uuid'];
        $project = Project::query()->where('uuid', $uuid)->firstOrFail();
        if (! $projects->allows($request->user(), $project, 'view')) {
            throw ApiException::notFound();
        }

        return response()->json(['data' => $planned->forProject($project)]);
    }

    public function show(Request $request, string $uuid): JsonResponse
    {
        return $this->respond($request, $this->find($request, $uuid));
    }

    public function store(PurchaseRequestRequest $request, ProjectAccess $projects): JsonResponse
    {
        $data = $request->payload();
        $project = Project::query()->findOrFail($data['project_id']);
        if (! $projects->allows($request->user(), $project, 'view')) {
            throw ApiException::notFound();
        }
        if (! $this->access->canCreate($request->user(), $project)) {
            throw ApiException::forbidden('forbidden', 'Você não tem permissão para solicitar materiais nesta obra.');
        }
        $this->assertCatalog($request);

        return $this->respond($request, $this->requests->create($data, $request->user()), 201);
    }

    public function update(PurchaseRequestRequest $request, string $uuid): JsonResponse
    {
        $purchase = $this->changeable($request, $uuid);
        $this->assertCatalog($request);

        return $this->respond($request, $this->requests->update($purchase, $request->payload(), $request->user()));
    }

    public function destroy(Request $request, string $uuid): JsonResponse
    {
        $this->requests->delete($this->changeable($request, $uuid), $request->user());

        return response()->json(null, 204);
    }

    public function workflow(PurchaseRequestActionRequest $request, string $uuid, string $action): JsonResponse
    {
        $found = $this->find($request, $uuid);

        // a permissão depende da situação (cancelar uma aprovada é diferente): confere com a solicitação já travada
        $purchase = DB::transaction(function () use ($request, $found, $action) {
            $locked = PurchaseRequest::query()->whereKey($found->id)->lockForUpdate()->firstOrFail();
            if (! $this->access->canRun($request->user(), $locked, $action)) {
                throw ApiException::forbidden('forbidden', 'Você não tem permissão para esta ação nesta solicitação.');
            }

            return $this->workflow->run($locked, $action, $request->user(), $request->validated('reason'),
                $request->approvedQuantities(), $request->validated('fulfilled_on'));
        });

        return $this->respond($request, $purchase);
    }

    // ------------------------------------------------------------ apoio

    private function filter(Builder $query, Request $request): void
    {
        $term = trim((string) $request->query('q', ''));
        if ($term !== '') {
            $like = '%'.addcslashes(mb_substr($term, 0, 100), '%_\\').'%';
            $query->where(fn (Builder $w) => $w->where('code', 'like', $like)
                ->orWhereHas('items', fn (Builder $items) => $items->where('description', 'like', $like)));
        }
        foreach (['status' => PurchaseRequest::STATUSES, 'priority' => PurchaseRequest::PRIORITIES] as $field => $allowed) {
            if (in_array($request->query($field), $allowed, true)) {
                $query->where($field, $request->query($field));
            }
        }
        if ($request->filled('project_uuid')) {
            $this->ofProject($query, (string) $request->query('project_uuid'));
        }
        if ($request->filled('requester_uuid')) {
            $query->where('requester_id', User::query()->where('uuid', $request->query('requester_uuid'))->value('id') ?? 0);
        }
        $period = $request->validate(['from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d']]);
        if (! empty($period['from'])) {
            $query->where('purchase_requests.created_at', '>=', LocalDay::startUtc($period['from']));
        }
        if (! empty($period['to'])) {
            $query->where('purchase_requests.created_at', '<', LocalDay::startUtc($period['to'])->addDay());
        }
        if ($request->boolean('late')) {
            $query->late();
        }
    }

    private function ofProject(Builder $query, string $uuid): void
    {
        $query->where('project_id', Project::query()->where('uuid', $uuid)->value('id') ?? 0);
    }

    private function find(Request $request, string $uuid): PurchaseRequest
    {
        $purchase = PurchaseRequest::query()->where('uuid', $uuid)->firstOrFail();
        if (! $this->access->canView($request->user(), $purchase)) {
            throw ApiException::notFound();
        }

        return $purchase;
    }

    private function changeable(Request $request, string $uuid): PurchaseRequest
    {
        $purchase = $this->find($request, $uuid);
        if (! $this->access->canChange($request->user(), $purchase)) {
            throw ApiException::forbidden('forbidden', 'Você não tem permissão para alterar esta solicitação.');
        }

        return $purchase;
    }

    private function assertCatalog(PurchaseRequestRequest $request): void
    {
        if ($request->usesCatalog() && ! $request->user()->can('resources.view')) {
            throw ApiException::forbidden('forbidden', 'Você não tem permissão para buscar no catálogo: informe o item digitado.');
        }
    }

    private function respond(Request $request, PurchaseRequest $purchase, int $status = 200): JsonResponse
    {
        $purchase->load(self::DETAIL_RELATIONS)->loadCount('items');
        $purchase->setAttribute('documents_count', DocumentLink::query()->where('linkable_type', 'purchase_request')->where('linkable_id', $purchase->id)->count());
        $resource = (new PurchaseRequestResource($purchase))->withAbilities($this->access->abilities($request->user(), $purchase));

        return response()->json(['data' => $resource], $status);
    }
}
