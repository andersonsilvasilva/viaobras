<?php

namespace App\Modules\Supplies\Services;

use App\Models\PurchaseRequest;
use App\Models\PurchaseRequestHistory;
use App\Models\User;
use App\Modules\Audit\AuditEvent;
use App\Modules\Audit\AuditLogger;
use App\Modules\Shared\Exceptions\ApiException;
use App\Modules\Tenancy\TenantContext;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Ciclo de vida da solicitação de materiais (FASE7A_MODELO.md §2): rascunho → pendente → aprovada → atendida.
 * Quem aprova também devolve para ajuste, recusa e desfaz aprovação ou atendimento (D-P106). Cada passo: histórico +
 * auditoria na mesma transação, com a solicitação travada. Quem pode executar cada ação é decidido por quem chama.
 */
final class PurchaseRequestWorkflow
{
    /** ação => [situações de origem, destino] */
    private const STEPS = [
        'submit' => [['draft'], 'pending'],
        'approve' => [['pending'], 'approved'],
        'send_back' => [['pending'], 'draft'],
        'reject' => [['pending'], 'rejected'],
        'revoke_approval' => [['approved'], 'pending'],
        'fulfill' => [['approved'], 'received'],
        'revert_fulfillment' => [['received'], 'approved'],
        'cancel' => [['draft', 'pending', 'approved'], 'canceled'],
    ];

    public const ACTIONS = ['submit', 'approve', 'send_back', 'reject', 'revoke_approval', 'fulfill', 'revert_fulfillment', 'cancel'];

    /** @return list<string> ações que a situação permite (quem pode executá-las é o PurchaseRequestAccess) */
    public static function actionsFrom(string $status): array
    {
        return array_keys(array_filter(self::STEPS, fn (array $step) => in_array($status, $step[0], true)));
    }

    private const REASON_REQUIRED = ['send_back', 'reject', 'revoke_approval', 'revert_fulfillment'];

    private const LABELS = [
        'submit' => 'enviar', 'approve' => 'aprovar', 'send_back' => 'devolver', 'reject' => 'recusar',
        'revoke_approval' => 'desfazer a aprovação de', 'fulfill' => 'marcar como atendida',
        'revert_fulfillment' => 'desfazer o atendimento de', 'cancel' => 'cancelar',
    ];

    private const STATUS_LABELS = [
        'draft' => 'em rascunho', 'pending' => 'pendente', 'approved' => 'aprovada', 'rejected' => 'recusada',
        'received' => 'atendida', 'canceled' => 'cancelada',
    ];

    public function __construct(private readonly AuditLogger $audit, private readonly TenantContext $context) {}

    /**
     * @param  array<int, string>  $approvedQuantities  só em `approve`: id do item => quantidade aprovada (os demais
     *                                                  são aprovados por inteiro, D-P104)
     * @param  ?string  $fulfilledOn  só em `fulfill`: data do atendimento (hoje, se omitida)
     */
    public function run(PurchaseRequest $request, string $action, User $actor, ?string $reason = null, array $approvedQuantities = [], ?string $fulfilledOn = null): PurchaseRequest
    {
        [$from, $to] = self::STEPS[$action];
        $reason = trim((string) $reason) ?: null;

        return DB::transaction(function () use ($request, $action, $from, $to, $actor, $reason, $approvedQuantities, $fulfilledOn) {
            $request = PurchaseRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();
            $old = $request->status;

            if (! in_array($old, $from, true)) {
                throw ApiException::unprocessable('invalid_transition', 'Não é possível '.self::LABELS[$action].' uma solicitação '.self::STATUS_LABELS[$old].'.');
            }
            // cancelar um rascunho não pede motivo; cancelar o que já foi enviado, sim
            if ($reason === null && (in_array($action, self::REASON_REQUIRED, true) || ($action === 'cancel' && $old !== 'draft'))) {
                throw ApiException::unprocessable('reason_required', 'Informe o motivo.');
            }

            $changes = ['status' => $to];
            $quantities = null;

            switch ($action) {
                case 'submit':
                    if (! $request->items()->exists()) {
                        throw ApiException::unprocessable('empty_request', 'Inclua ao menos um item antes de enviar.');
                    }
                    $changes['submitted_at'] = now();
                    break;
                case 'approve':
                    $quantities = $this->approveItems($request, $approvedQuantities, $reason);
                    $changes += ['decided_by' => $actor->getKey(), 'decided_at' => now()];
                    break;
                case 'reject':
                    $changes += ['decided_by' => $actor->getKey(), 'decided_at' => now()];
                    break;
                case 'revoke_approval':
                    $quantities = $this->clearApproval($request);
                    $changes += ['decided_by' => null, 'decided_at' => null];
                    break;
                case 'fulfill':
                    $changes['fulfilled_on'] = $this->fulfillmentDate($request, $fulfilledOn);
                    break;
                case 'revert_fulfillment':
                    $changes['fulfilled_on'] = null;
                    break;
            }

            $oldValues = ['status' => $old, 'fulfilled_on' => $request->fulfilled_on?->toDateString()];
            $request->forceFill($changes)->save();

            $history = new PurchaseRequestHistory;
            $history->forceFill(['request_id' => $request->id, 'action' => $action, 'from_status' => $old, 'to_status' => $to,
                'changed_by' => $actor->getKey(), 'reason' => $reason])->save();

            $this->audit->record(AuditEvent::SUPPLIES_STATUS_CHANGED, tenantId: $this->context->idOrFail(), userId: $actor->getKey(),
                entityType: 'purchase_request', entityId: $request->id, old: $oldValues,
                new: ['status' => $to, 'fulfilled_on' => $request->fulfilled_on?->toDateString()],
                metadata: array_filter([
                    'action' => $action, 'reason' => $reason, 'quantities' => $quantities,
                    'approved_by_requester' => $action === 'approve' && (int) $request->requester_id === (int) $actor->getKey(),
                ]));

            return $request->refresh();
        });
    }

    /**
     * @param  array<int, string>  $approved
     * @return list<array{item_id: int, requested: string, approved: string}>
     */
    private function approveItems(PurchaseRequest $request, array $approved, ?string $reason): array
    {
        $items = $request->items()->get();

        if (array_diff(array_keys($approved), $items->modelKeys()) !== []) {
            throw ApiException::unprocessable('unknown_item', 'Há item que não pertence a esta solicitação.');
        }

        $final = $items->mapWithKeys(function ($item) use ($approved) {
            $value = (string) ($approved[$item->id] ?? $item->quantity);
            if (preg_match('/^\d{1,11}(\.\d{1,4})?$/', $value) !== 1 || bccomp($value, (string) $item->quantity, 4) === 1) {
                throw ApiException::unprocessable('invalid_approved_quantity', 'A quantidade aprovada deve ficar entre zero e a quantidade pedida.');
            }

            return [$item->id => $value];
        });

        if ($final->every(fn (string $value) => bccomp($value, '0', 4) === 0)) {
            throw ApiException::unprocessable('nothing_approved', 'Nenhum item foi aprovado: use "recusar".');
        }
        if ($reason === null && $items->contains(fn ($item) => bccomp($final[$item->id], (string) $item->quantity, 4) !== 0)) {
            throw ApiException::unprocessable('reason_required', 'Informe o motivo da aprovação parcial.');
        }

        foreach ($items as $item) {
            $item->forceFill(['approved_quantity' => $final[$item->id]])->save();
        }

        return $this->quantities($items);
    }

    /** Limpa as quantidades aprovadas; os valores anteriores ficam na auditoria. */
    private function clearApproval(PurchaseRequest $request): array
    {
        $items = $request->items()->get();
        $previous = $this->quantities($items);

        foreach ($items as $item) {
            $item->forceFill(['approved_quantity' => null])->save();
        }

        return $previous;
    }

    private function quantities(Collection $items): array
    {
        return $items->map(fn ($item) => [
            'item_id' => $item->id, 'requested' => (string) $item->quantity, 'approved' => (string) $item->approved_quantity,
        ])->values()->all();
    }

    private function fulfillmentDate(PurchaseRequest $request, ?string $date): string
    {
        $today = LocalDay::today();
        $on = $date ?? $today;

        if ($on > $today || $on < LocalDay::of($request->submitted_at)) {
            throw ApiException::unprocessable('invalid_fulfillment_date', 'A data do atendimento deve ficar entre o envio da solicitação e hoje.');
        }

        return $on;
    }
}
