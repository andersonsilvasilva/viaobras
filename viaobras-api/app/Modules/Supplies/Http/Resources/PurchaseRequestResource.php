<?php

namespace App\Modules\Supplies\Http\Resources;

use App\Models\PurchaseRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Solicitação de materiais. Quantidades como TEXTO exato. `abilities` = o que quem consulta pode fazer agora (o
 * frontend mostra os botões; a API confere de novo). Itens e histórico só no detalhe.
 *
 * @mixin PurchaseRequest
 */
class PurchaseRequestResource extends JsonResource
{
    /** @var array<string, mixed>|null */
    public ?array $abilities = null;

    public function withAbilities(array $abilities): static
    {
        $this->abilities = $abilities;

        return $this;
    }

    public function toArray(Request $request): array
    {
        return [
            'uuid' => $this->uuid,
            'code' => $this->code,
            'status' => $this->status,
            'priority' => $this->priority,
            'needed_by' => $this->needed_by?->toDateString(),
            'late' => $this->isLate(),
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'decided_at' => $this->decided_at?->toIso8601String(),
            'fulfilled_on' => $this->fulfilled_on?->toDateString(),
            'approved_by_requester' => $this->wasApprovedByRequester(),
            'project' => $this->whenLoaded('project', fn () => $this->project?->only(['uuid', 'code', 'name'])),
            'requester' => $this->whenLoaded('requester', fn () => $this->requester?->only(['uuid', 'name'])),
            'decided_by' => $this->whenLoaded('decider', fn () => $this->decider?->only(['uuid', 'name'])),
            'items_count' => $this->when($this->items_count !== null, fn () => (int) $this->items_count),
            'documents_count' => $this->when($this->documents_count !== null, fn () => (int) $this->documents_count),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($i) => [
                'id' => $i->id, 'resource_uuid' => $i->resource?->uuid, 'description' => $i->description, 'unit_code' => $i->unit_code,
                'quantity' => (string) $i->quantity,
                'approved_quantity' => $i->approved_quantity === null ? null : (string) $i->approved_quantity,
                'notes' => $i->notes,
                'task' => $i->task ? ['id' => $i->task->id, 'wbs' => $i->task->wbs_code, 'name' => $i->task->name] : null,
            ])->values()),
            'history' => $this->whenLoaded('history', fn () => $this->history->map(fn ($h) => [
                'action' => $h->action, 'from' => $h->from_status, 'to' => $h->to_status, 'reason' => $h->reason,
                'at' => $h->changed_at?->toIso8601String(), 'by' => $h->changer?->only(['uuid', 'name']),
            ])->values()),
            'abilities' => $this->when($this->abilities !== null, fn () => $this->abilities),
        ];
    }
}
