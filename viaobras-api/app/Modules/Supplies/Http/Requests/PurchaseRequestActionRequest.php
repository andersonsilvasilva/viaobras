<?php

namespace App\Modules\Supplies\Http\Requests;

use App\Modules\Teams\Http\Requests\TenantRequest;

/**
 * POST /purchase-requests/{uuid}/workflow/{action}. Motivo obrigatório e limites da aprovação parcial são regras do
 * PurchaseRequestWorkflow.
 */
class PurchaseRequestActionRequest extends TenantRequest
{
    public function rules(): array
    {
        $approving = $this->route('action') === 'approve';

        return [
            'reason' => ['nullable', 'string', 'max:1000'],
            'items' => [$approving ? 'sometimes' : 'prohibited', 'array', 'max:200'],
            'items.*.id' => ['required', 'integer', 'distinct'],
            'items.*.approved_quantity' => ['required', 'numeric', 'min:0', 'max:99999999999.9999', 'decimal:0,4'],
            'fulfilled_on' => [$this->route('action') === 'fulfill' ? 'nullable' : 'prohibited', 'date_format:Y-m-d'],
        ];
    }

    /** @return array<int, string> id do item => quantidade aprovada */
    public function approvedQuantities(): array
    {
        return collect($this->validated('items', []))
            ->mapWithKeys(fn (array $item) => [(int) $item['id'] => (string) $item['approved_quantity']])->all();
    }

    public function attributes(): array
    {
        return ['reason' => 'motivo', 'items.*.approved_quantity' => 'quantidade aprovada', 'fulfilled_on' => 'data do atendimento'];
    }
}
