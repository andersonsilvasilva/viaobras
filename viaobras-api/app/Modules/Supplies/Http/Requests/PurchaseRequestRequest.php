<?php

namespace App\Modules\Supplies\Http\Requests;

use App\Models\Project;
use App\Models\PurchaseRequest;
use App\Models\Resource;
use App\Modules\Teams\Http\Requests\TenantRequest;
use Illuminate\Validation\Rule;

/**
 * POST /purchase-requests e PUT /purchase-requests/{uuid}. A obra só vai na criação. Em `items` vem a lista inteira:
 * material do catálogo (`resource_uuid`) ou item digitado (descrição e unidade). "Só material" e "atividade da mesma
 * obra" são regras do PurchaseRequestService.
 */
class PurchaseRequestRequest extends TenantRequest
{
    protected array $uuidRefs = ['project_uuid' => [Project::class, 'project_id']];

    public function rules(): array
    {
        $creating = $this->isMethod('post');

        return [
            'project_uuid' => [$creating ? 'required' : 'prohibited', 'uuid', $this->existsInTenant('projects')],
            'priority' => ['sometimes', Rule::in(PurchaseRequest::PRIORITIES)],
            'needed_by' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'items' => ['sometimes', 'array', 'max:200'],
            'items.*.resource_uuid' => ['nullable', 'uuid', $this->existsInTenant('resources')],
            'items.*.description' => ['required_without:items.*.resource_uuid', 'nullable', 'string', 'max:500'],
            'items.*.unit_code' => ['required_without:items.*.resource_uuid', 'nullable', 'string', 'max:20'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0', 'max:99999999999.9999', 'decimal:0,4'],
            'items.*.task_id' => ['nullable', 'integer'],
            'items.*.notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    /** Algum item foi buscado no catálogo? (exige `resources.view`) */
    public function usesCatalog(): bool
    {
        return collect($this->validated('items', []))->contains(fn (array $item) => ! empty($item['resource_uuid']));
    }

    /** Dados para o serviço: obra e materiais com os ids internos do tenant ativo. */
    public function payload(): array
    {
        $data = parent::payload();

        if (array_key_exists('items', $data)) {
            $ids = Resource::query()->whereIn('uuid', collect($data['items'])->pluck('resource_uuid')->filter())->pluck('id', 'uuid');
            $data['items'] = array_map(function (array $item) use ($ids) {
                $item['resource_id'] = empty($item['resource_uuid']) ? null : $ids[$item['resource_uuid']];
                $item['quantity'] = (string) $item['quantity'];
                unset($item['resource_uuid']);

                return $item;
            }, array_values($data['items']));
        }

        return $data;
    }

    public function attributes(): array
    {
        return [
            'project_uuid' => 'obra', 'priority' => 'prioridade', 'needed_by' => 'necessário até', 'notes' => 'observações',
            'items' => 'itens', 'items.*.resource_uuid' => 'material', 'items.*.description' => 'descrição',
            'items.*.unit_code' => 'unidade', 'items.*.quantity' => 'quantidade', 'items.*.task_id' => 'atividade',
            'items.*.notes' => 'observação do item',
        ];
    }
}
