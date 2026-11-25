<?php

namespace App\Models;

use App\Modules\Tenancy\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Item da solicitação de materiais (7A): descrição e unidade são CÓPIA do catálogo no momento (D-08) ou digitadas.
 * A quantidade aprovada é gravada só pelo PurchaseRequestWorkflow.
 */
class PurchaseRequestItem extends Model
{
    use BelongsToTenant;

    protected $fillable = ['request_id', 'resource_id', 'task_id', 'description', 'unit_code', 'quantity', 'notes', 'sort_order'];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:4', 'approved_quantity' => 'decimal:4', 'sort_order' => 'integer'];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequest::class, 'request_id');
    }

    public function resource(): BelongsTo
    {
        return $this->belongsTo(Resource::class);
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(ScheduleTask::class, 'task_id');
    }
}
