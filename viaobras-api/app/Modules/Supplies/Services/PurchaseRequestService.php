<?php

namespace App\Modules\Supplies\Services;

use App\Models\PurchaseRequest;
use App\Models\PurchaseRequestItem;
use App\Models\Resource;
use App\Models\Schedule;
use App\Models\ScheduleTask;
use App\Models\User;
use App\Modules\Registry\Services\RegistryService;
use App\Modules\Shared\Exceptions\DomainRuleException;
use App\Modules\Shared\Support\YearlyCodeGenerator;
use Illuminate\Support\Facades\DB;

/**
 * Escrita das solicitações de materiais (Fase 7A). Quem pode fazer o quê é decidido por quem chama (permissão e acesso
 * à obra); aqui ficam as regras do dado:
 * - código SOL-NNN/AAAA por tenant e ano da criação (D-P100);
 * - só o rascunho é editável; a obra é fixada na criação;
 * - item do catálogo (só material, copiando nome e unidade) ou digitado (D-P101);
 * - atividade ligada ao item precisa ser do planejamento da MESMA obra (D-P102);
 * - excluir só o rascunho que nunca foi enviado.
 */
final class PurchaseRequestService
{
    private const HEADER = ['priority', 'needed_by', 'notes'];

    public function __construct(
        private readonly RegistryService $registry,
        private readonly YearlyCodeGenerator $codes,
    ) {}

    /**
     * @param  array{project_id: int, priority?: string, needed_by?: ?string, notes?: ?string, items?: list<array<string, mixed>>}  $data
     */
    public function create(array $data, User $actor): PurchaseRequest
    {
        return DB::transaction(function () use ($data, $actor) {
            $request = new PurchaseRequest;
            $request->forceFill(['requester_id' => $actor->getKey()]);

            $this->registry->create($request, [
                'project_id' => $data['project_id'],
                'code' => $this->codes->next(PurchaseRequest::class, 'SOL', (int) substr(LocalDay::today(), 0, 4)),
                ...array_intersect_key($data, array_flip(self::HEADER)),
            ], $actor);

            $this->addItems($request, $data['items'] ?? [], $actor);

            return $request->refresh();
        }, attempts: 3);
    }

    /**
     * Altera o rascunho. Quando `items` vem, substitui a lista inteira.
     *
     * @param  array{priority?: string, needed_by?: ?string, notes?: ?string, items?: list<array<string, mixed>>}  $data
     */
    public function update(PurchaseRequest $request, array $data, User $actor): PurchaseRequest
    {
        return DB::transaction(function () use ($request, $data, $actor) {
            $request = $this->lockDraft($request);
            $this->registry->update($request, array_intersect_key($data, array_flip(self::HEADER)), $actor);

            if (array_key_exists('items', $data)) {
                foreach ($request->items()->get() as $item) {
                    $this->registry->delete($item, $actor);
                }
                $this->addItems($request, $data['items'], $actor);
            }

            return $request->refresh();
        });
    }

    public function delete(PurchaseRequest $request, User $actor): void
    {
        DB::transaction(function () use ($request, $actor) {
            $request = $this->lockDraft($request);
            if ($request->submitted_at !== null) {
                throw new DomainRuleException('Solicitação já enviada não pode ser excluída: cancele, informando o motivo.');
            }
            $this->registry->delete($request, $actor); // lógica: o código continua ocupado
        });
    }

    private function lockDraft(PurchaseRequest $request): PurchaseRequest
    {
        $locked = PurchaseRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
        if (! $locked->isDraft()) {
            throw new DomainRuleException('Só é possível alterar ou excluir uma solicitação em rascunho.');
        }

        return $locked;
    }

    /** @param list<array<string, mixed>> $items */
    private function addItems(PurchaseRequest $request, array $items, User $actor): void
    {
        foreach (array_values($items) as $position => $item) {
            $this->registry->create(new PurchaseRequestItem, [
                'request_id' => $request->id,
                'task_id' => $this->taskOfProject($item['task_id'] ?? null, $request->project_id),
                'quantity' => $this->positiveQuantity((string) ($item['quantity'] ?? '')),
                'notes' => $item['notes'] ?? null,
                'sort_order' => $position + 1,
                ...$this->material($item),
            ], $actor);
        }
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array{resource_id: ?int, description: string, unit_code: string}
     */
    private function material(array $item): array
    {
        if (! empty($item['resource_id'])) {
            $resource = Resource::query()->with('unit:id,code')->find($item['resource_id']);
            if ($resource === null || $resource->kind !== 'material' || $resource->status !== 'active') {
                throw new DomainRuleException('Escolha um material ativo do catálogo.');
            }

            return ['resource_id' => $resource->id, 'description' => $resource->name, 'unit_code' => $resource->unit?->code ?? 'UN'];
        }

        $description = trim((string) ($item['description'] ?? ''));
        $unit = trim((string) ($item['unit_code'] ?? ''));
        if ($description === '' || $unit === '') {
            throw new DomainRuleException('Item digitado precisa de descrição e unidade.');
        }

        return ['resource_id' => null, 'description' => $description, 'unit_code' => $unit];
    }

    private function taskOfProject(mixed $taskId, int $projectId): ?int
    {
        if (empty($taskId)) {
            return null;
        }
        $belongs = ScheduleTask::query()->whereKey($taskId)
            ->whereIn('schedule_id', Schedule::query()->select('id')->where('project_id', $projectId))
            ->exists();
        if (! $belongs) {
            throw new DomainRuleException('A atividade escolhida não é do planejamento desta obra.');
        }

        return (int) $taskId;
    }

    private function positiveQuantity(string $quantity): string
    {
        if (preg_match('/^\d{1,11}(\.\d{1,4})?$/', $quantity) !== 1 || bccomp($quantity, '0', 4) !== 1) {
            throw new DomainRuleException('A quantidade deve ser maior que zero, com até 4 casas decimais.');
        }

        return $quantity;
    }
}
